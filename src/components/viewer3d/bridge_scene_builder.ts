// src/components/viewer3d/bridge_scene_builder.ts
import * as THREE from 'three';
import { BridgeParameters } from '../../domain/models/bridge';
import {
  calculateOriginalGround,
  DEFAULT_TERRAIN,
  DEFAULT_ALIGNMENT
} from '../../domain/engine/terrain_alignment_calculator';
import { createAlignmentEvaluator } from '../../domain/engine/alignment_3d';
import {
  BridgeMaterialSet,
  buildApproachHighwayEarthwork,
  buildHighLodAbutment,
  buildHighLodPier,
  buildHighLodSuperstructure,
  classifySuperstructure,
  createAsphaltMarkingTexture,
  getGirderStructuralDepth
} from './bridge_geometry_builders';
import { generateKoreaAerialOrthophotoCanvas } from '../../domain/constants/korea_terrain_presets';
import { loadRealWorldTerrain, RealWorldTerrainData } from '../../domain/gis/terrain_dem_loader';
import { KOREA_POI_DATABASE } from '../../domain/gis/korea_geocoding';

export interface PopulateBridgeSceneParams {
  bridgeGroup: THREE.Group;
  terrainGroup: THREE.Group;
  bridgeParams: BridgeParameters;
  realTerrain: RealWorldTerrainData | null;
  terrainVerticalScale: number;
  showTerrain: boolean;
  showAlignment: boolean;
  showEarthwork: boolean;
  showPiles: boolean;
  wireframe: boolean;
}

/**
 * 교량 제원에서 실제 지형/위성 조회용 대표 좌표·방위각 추출 (뷰어·보고서 공통)
 */
export function resolveBridgeLocationLatLng(bridgeParams: BridgeParameters): {
  lat: number;
  lng: number;
  azimuthDeg: number;
} {
  let lat = 36.3852;
  let lng = 127.4241;

  if (bridgeParams.coordinates?.lat && bridgeParams.coordinates?.lng) {
    lat = bridgeParams.coordinates.lat;
    lng = bridgeParams.coordinates.lng;
  } else {
    const foundPOI = KOREA_POI_DATABASE.find(
      (p) =>
        bridgeParams.name?.includes(p.name.split(' ')[0]) ||
        bridgeParams.locationName?.includes(p.name.split(' ')[0])
    );
    if (foundPOI) {
      lat = foundPOI.lat;
      lng = foundPOI.lng;
    }
  }

  return {
    lat,
    lng,
    azimuthDeg: bridgeParams.alignmentEndpoints?.azimuthDeg ?? 90
  };
}

/**
 * Three.js 그룹 내 지오메트리·재질·텍스처 안전 해제
 */
function disposeGroupResources(group: THREE.Group): void {
  const disposedGeos = new Set<THREE.BufferGeometry>();
  const disposedMats = new Set<THREE.Material>();
  const disposedTexs = new Set<THREE.Texture>();

  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry && !disposedGeos.has(mesh.geometry)) {
      mesh.geometry.dispose();
      disposedGeos.add(mesh.geometry);
    }
    const mat = mesh.material;
    if (mat) {
      const matList = Array.isArray(mat) ? mat : [mat];
      matList.forEach((m) => {
        if (!disposedMats.has(m)) {
          const std = m as THREE.MeshStandardMaterial;
          if (std.map && !disposedTexs.has(std.map)) {
            std.map.dispose();
            disposedTexs.add(std.map);
          }
          m.dispose();
          disposedMats.add(m);
        }
      });
    }
  });

  while (group.children.length > 0) {
    group.remove(group.children[0]);
  }
}

/**
 * 지형(실측 DEM + 위성 정사영상), 도로 선형, 고(高)LOD 교량, 교대 후방 토공을 한 번에 구성
 * - Bridge3DViewer 및 보고서용 오프스크린 스틸컷 렌더러가 100% 동일 엔진 공유
 */
export function populateBridgeScene({
  bridgeGroup,
  terrainGroup,
  bridgeParams,
  realTerrain,
  terrainVerticalScale,
  showTerrain,
  showAlignment,
  showEarthwork,
  showPiles,
  wireframe
}: PopulateBridgeSceneParams): () => void {
  disposeGroupResources(bridgeGroup);
  disposeGroupResources(terrainGroup);

  const {
    bridge_length,
    bridge_width,
    spans,
    piers,
    abutments,
    terrain = DEFAULT_TERRAIN,
    alignment = DEFAULT_ALIGNMENT
  } = bridgeParams;

  const spansTotalLen = spans.reduce((sum, s) => sum + s.span_length, 0);
  const totalBridgeLen = spansTotalLen > 0 ? spansTotalLen : bridge_length || 200;

  const xSpan = realTerrain ? realTerrain.widthMeters : Math.max(700, totalBridgeLen * 2.4);
  const zSpan = realTerrain ? realTerrain.depthMeters : Math.round(xSpan * 0.72);
  const xStart = totalBridgeLen / 2 - xSpan / 2;

  const clampedSkewDeg = Math.max(-60, Math.min(60, bridgeParams.skew_angle || 0));
  const skewRad = (clampedSkewDeg * Math.PI) / 180;

  const getActualGroundY = (x: number, z: number = 0): number => {
    if (realTerrain && realTerrain.elevationGrid.length > 0) {
      const rows = realTerrain.elevationGrid.length;
      const cols = realTerrain.elevationGrid[0].length;
      const normX = Math.max(0, Math.min(1, (x - xStart) / xSpan));
      const normZ = Math.max(0, Math.min(1, (z + zSpan / 2) / zSpan));
      const gx = normX * (cols - 1);
      const gz = normZ * (rows - 1);
      const x0 = Math.floor(gx);
      const z0 = Math.floor(gz);
      const x1 = Math.min(cols - 1, x0 + 1);
      const z1 = Math.min(rows - 1, z0 + 1);
      const tx = gx - x0;
      const tz = gz - z0;

      const e00 = realTerrain.elevationGrid[z0][x0];
      const e10 = realTerrain.elevationGrid[z0][x1];
      const e01 = realTerrain.elevationGrid[z1][x0];
      const e11 = realTerrain.elevationGrid[z1][x1];
      const rawElev =
        e00 * (1 - tx) * (1 - tz) +
        e10 * tx * (1 - tz) +
        e01 * (1 - tx) * tz +
        e11 * tx * tz;

      return 15 + (rawElev - realTerrain.centerElevation) * terrainVerticalScale;
    }
    const { groundElevation } = calculateOriginalGround(x, totalBridgeLen, terrain, alignment);
    const zDist = Math.abs(z);
    const sideSlope = (zDist / (zSpan / 2)) * 3.5;
    return 15 + (groundElevation - 15 + sideSlope) * terrainVerticalScale;
  };

  const preEvaluator = createAlignmentEvaluator(totalBridgeLen, alignment, 0);
  let bridgeVerticalLift = 0;
  if (realTerrain && realTerrain.hasRealDem) {
    let maxCorridorGroundY = -Infinity;
    let minBridgeFG = Infinity;
    for (let s = 0; s <= 12; s++) {
      const st = (totalBridgeLen * s) / 12;
      const sample = preEvaluator(st);
      const sy = getActualGroundY(sample.position.x, sample.position.z);
      if (sy > maxCorridorGroundY) maxCorridorGroundY = sy;
      if (sample.position.y < minBridgeFG) minBridgeFG = sample.position.y;
    }
    if (maxCorridorGroundY + 5.0 > minBridgeFG) {
      bridgeVerticalLift = maxCorridorGroundY + 5.0 - minBridgeFG;
    }
  }

  const evaluator = createAlignmentEvaluator(totalBridgeLen, alignment, bridgeVerticalLift);

  let terrainTexture: THREE.Texture | null = null;
  if (showTerrain) {
    const xSegments = 100;
    const zSegments = 60;

    const terrainGeo = new THREE.PlaneGeometry(xSpan, zSpan, xSegments, zSegments);
    terrainGeo.rotateX(-Math.PI / 2);
    terrainGeo.translate(xStart + xSpan / 2, 0, 0);

    const posAttr = terrainGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      posAttr.setY(i, getActualGroundY(vx, vz));
    }
    terrainGeo.computeVertexNormals();

    if (realTerrain && realTerrain.satelliteCanvas) {
      terrainTexture = new THREE.CanvasTexture(realTerrain.satelliteCanvas);
    } else {
      const orthoCanvas = generateKoreaAerialOrthophotoCanvas(terrain.type, 1024, 512);
      terrainTexture = new THREE.CanvasTexture(orthoCanvas);
    }
    terrainTexture.wrapS = THREE.ClampToEdgeWrapping;
    terrainTexture.wrapT = THREE.ClampToEdgeWrapping;
    terrainTexture.anisotropy = 8;

    const terrainMat = new THREE.MeshStandardMaterial({
      map: terrainTexture,
      roughness: 0.85,
      metalness: 0.05,
      wireframe
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    terrainGroup.add(terrainMesh);
  } else {
    const grid = new THREE.GridHelper(600, 60, 0x475569, 0x1e293b);
    grid.position.y = -0.1;
    terrainGroup.add(grid);
  }

  if (showAlignment) {
    const alignPts: THREE.Vector3[] = [];
    const steps = 96;
    for (let s = 0; s <= steps; s++) {
      const st = (s / steps) * totalBridgeLen;
      const sample = evaluator(st);
      alignPts.push(sample.position.clone().addScaledVector(sample.up, 0.35));
    }
    const alignGeo = new THREE.BufferGeometry().setFromPoints(alignPts);
    const alignMat = new THREE.LineDashedMaterial({
      color: 0xfbbf24,
      linewidth: 3,
      dashSize: 4,
      gapSize: 2
    });
    const alignLine = new THREE.Line(alignGeo, alignMat);
    alignLine.computeLineDistances();
    bridgeGroup.add(alignLine);
  }

  const asphaltTexture = createAsphaltMarkingTexture(bridge_width);
  const mats: BridgeMaterialSet = {
    concrete: new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.62, metalness: 0.08, wireframe }),
    concreteDark: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.78, metalness: 0.1, wireframe }),
    asphalt: new THREE.MeshStandardMaterial({ map: asphaltTexture, roughness: 0.88, metalness: 0.05, wireframe }),
    steelBox: new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.36, metalness: 0.68, wireframe }),
    steelLight: new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.42, metalness: 0.65, wireframe }),
    pier: new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.68, metalness: 0.06, wireframe }),
    pile: new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4, metalness: 0.6, wireframe }),
    cable: new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.75, wireframe }),
    bearing: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.5, wireframe }),
    lampPole: new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.35, metalness: 0.8, wireframe }),
    lampGlow: new THREE.MeshBasicMaterial({ color: 0xfef08a, wireframe })
  };

  buildHighLodSuperstructure(
    bridgeGroup,
    spans,
    bridge_width,
    totalBridgeLen,
    evaluator,
    mats,
    showPiles,
    skewRad
  );

  const startType = spans[0]?.type || 'PSC_BEAM';
  const endType = spans[spans.length - 1]?.type || startType;
  const startDepth = getGirderStructuralDepth(startType, spans[0]?.span_length || 40);
  const endDepth = getGirderStructuralDepth(endType, spans[spans.length - 1]?.span_length || 40);
  const startCat = classifySuperstructure(startType);
  const endCat = classifySuperstructure(endType);

  const ptA1 = evaluator(0);
  const ogA1 = getActualGroundY(ptA1.position.x, ptA1.position.z);
  buildHighLodAbutment(
    bridgeGroup,
    0,
    true,
    bridge_width,
    skewRad,
    startDepth,
    ogA1,
    abutments[0],
    evaluator,
    mats,
    showPiles,
    startCat === 'RC_RAHMEN' || startCat === 'RC_BOX'
  );

  const ptA2 = evaluator(totalBridgeLen);
  const ogA2 = getActualGroundY(ptA2.position.x, ptA2.position.z);
  buildHighLodAbutment(
    bridgeGroup,
    totalBridgeLen,
    false,
    bridge_width,
    skewRad,
    endDepth,
    ogA2,
    abutments[1],
    evaluator,
    mats,
    showPiles,
    endCat === 'RC_RAHMEN' || endCat === 'RC_BOX'
  );

  if (showEarthwork) {
    buildApproachHighwayEarthwork({
      group: bridgeGroup,
      totalBridgeLen,
      bridgeWidth: bridge_width,
      skewRad,
      evaluator,
      getGroundY: getActualGroundY,
      terrainBounds: { xStart, xSpan, zSpan },
      mats,
      wireframe
    });
  }

  let spanCumS = 0;
  piers.forEach((pier, idx) => {
    if (idx < spans.length - 1) {
      spanCumS += spans[idx].span_length;
    } else {
      spanCumS = (totalBridgeLen / (piers.length + 1)) * (idx + 1);
    }
    const leftSpan = spans[Math.min(idx, spans.length - 1)];
    const pierGirderDepth = getGirderStructuralDepth(
      leftSpan?.type || startType,
      leftSpan?.span_length || 40
    );
    const ptPier = evaluator(spanCumS);
    const ogPier = getActualGroundY(ptPier.position.x, ptPier.position.z);
    buildHighLodPier(
      bridgeGroup,
      spanCumS,
      pier,
      bridge_width,
      skewRad,
      pierGirderDepth,
      ogPier,
      evaluator,
      mats,
      showPiles
    );
  });

  return () => {
    asphaltTexture.dispose();
    if (terrainTexture) terrainTexture.dispose();
  };
}

export interface BimAlternativeSnapshot {
  isoDataUrl: string;
  elevationDataUrl: string;
}

/**
 * 등록된 대안별 3D BIM 모델 스틸컷(3D 투시 조감 + 측면 종단도) 일괄 오프스크린 렌더링
 * - 단일 WebGL 컨텍스트를 순차 재사용해 브라우저 컨텍스트 한계 초과 방지
 */
export async function captureAlternativeBimSnapshots(
  items: Array<{ id: string; bridgeParams: BridgeParameters }>,
  options?: {
    terrainVerticalScale?: number;
    onProgress?: (completed: number, total: number, currentName: string) => void;
  }
): Promise<Record<string, BimAlternativeSnapshot>> {
  const results: Record<string, BimAlternativeSnapshot> = {};
  if (items.length === 0) return results;

  const width = 960;
  const height = 540;
  const vScale = options?.terrainVerticalScale ?? 1.0;

  let renderer: THREE.WebGLRenderer | null = null;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      alpha: false
    });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  } catch (err) {
    console.warn('오프스크린 WebGL 스틸컷 렌더러 생성 실패:', err);
    return results;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b132b);

  const camera = new THREE.PerspectiveCamera(45, width / height, 1, 6000);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.78);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.38);
  dirLight.position.set(420, 280, 220);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  dirLight.shadow.camera.near = 10;
  dirLight.shadow.camera.far = 2500;
  dirLight.shadow.camera.left = -600;
  dirLight.shadow.camera.right = 600;
  dirLight.shadow.camera.top = 600;
  dirLight.shadow.camera.bottom = -600;
  scene.add(dirLight);

  const dirLight2 = new THREE.DirectionalLight(0x93c5fd, 0.42);
  dirLight2.position.set(-300, 350, -220);
  scene.add(dirLight2);

  const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x334155, 0.55);
  scene.add(hemiLight);

  const terrainGroup = new THREE.Group();
  const bridgeGroup = new THREE.Group();
  scene.add(terrainGroup);
  scene.add(bridgeGroup);

  try {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      options?.onProgress?.(i, items.length, item.bridgeParams.name || `대안 ${i + 1}`);

      const { lat, lng, azimuthDeg } = resolveBridgeLocationLatLng(item.bridgeParams);
      const totalLen =
        item.bridgeParams.spans.reduce((s, sp) => s + sp.span_length, 0) ||
        item.bridgeParams.bridge_length ||
        200;

      let realTerrain: RealWorldTerrainData | null = null;
      try {
        realTerrain = await loadRealWorldTerrain(lat, lng, totalLen, azimuthDeg, 100, 60);
      } catch {
        realTerrain = null;
      }

      const cleanup = populateBridgeScene({
        bridgeGroup,
        terrainGroup,
        bridgeParams: item.bridgeParams,
        realTerrain,
        terrainVerticalScale: vScale,
        showTerrain: true,
        showAlignment: true,
        showEarthwork: true,
        showPiles: true,
        wireframe: false
      });

      const centerX = totalLen / 2;
      const distScale = Math.max(0.95, totalLen / 190);
      const hasTallTower = item.bridgeParams.spans.some(
        (sp) => sp.type === 'CABLE_STAYED' || sp.type === 'EXTRADOSED' || sp.type === 'STEEL_ARCH'
      );
      const targetY = hasTallTower ? 22 : 15;

      // 1) 3D 투시 조감 스틸컷
      camera.position.set(
        centerX + 68 * distScale,
        (hasTallTower ? 78 : 62) * distScale,
        150 * distScale
      );
      camera.lookAt(centerX, targetY, 0);
      renderer.render(scene, camera);
      const isoDataUrl = renderer.domElement.toDataURL('image/jpeg', 0.9);

      // 2) 측면 정면(종단) 스틸컷
      camera.position.set(
        centerX,
        (hasTallTower ? 36 : 24) * distScale,
        195 * distScale
      );
      camera.lookAt(centerX, targetY, 0);
      renderer.render(scene, camera);
      const elevationDataUrl = renderer.domElement.toDataURL('image/jpeg', 0.9);

      results[item.id] = { isoDataUrl, elevationDataUrl };
      cleanup();
      disposeGroupResources(bridgeGroup);
      disposeGroupResources(terrainGroup);
    }
    options?.onProgress?.(items.length, items.length, '완료');
  } finally {
    renderer.dispose();
  }

  return results;
}

