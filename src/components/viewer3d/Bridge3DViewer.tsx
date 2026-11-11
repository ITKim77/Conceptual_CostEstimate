// src/components/viewer3d/Bridge3DViewer.tsx
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useBridgeStore } from '../../store/useBridgeStore';
import {
  Layers,
  Eye,
  Maximize2,
  Compass,
  Sparkles,
  Mountain,
  Waves,
  Ruler
} from 'lucide-react';
import {
  calculateOriginalGround,
  calculateFormationGround,
  DEFAULT_TERRAIN,
  DEFAULT_ALIGNMENT
} from '../../domain/engine/terrain_alignment_calculator';

export const Bridge3DViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const bridgeGroupRef = useRef<THREE.Group | null>(null);
  const terrainGroupRef = useRef<THREE.Group | null>(null);
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });

  const { bridgeParams, cameraPreset, setCameraPreset } = useBridgeStore();
  const [wireframe, setWireframe] = useState(false);
  const [showPiles, setShowPiles] = useState(true);
  const [showTerrain, setShowTerrain] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);

  // 1. Scene & Renderer Initialization
  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || 520;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0F172A); // Slate 900
    scene.fog = new THREE.FogExp2(0x0F172A, 0.0018);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
    camera.position.set(160, 65, 150);
    camera.lookAt(new THREE.Vector3(120, 15, 0));
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xFFFBEB, 1.3);
    dirLight.position.set(200, 300, 150);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 1000;
    dirLight.shadow.camera.left = -300;
    dirLight.shadow.camera.right = 300;
    dirLight.shadow.camera.top = 300;
    dirLight.shadow.camera.bottom = -300;
    scene.add(dirLight);

    const hemiLight = new THREE.HemisphereLight(0x93C5FD, 0x1E293B, 0.6);
    scene.add(hemiLight);

    // Groups
    const terrainGroup = new THREE.Group();
    scene.add(terrainGroup);
    terrainGroupRef.current = terrainGroup;

    const bridgeGroup = new THREE.Group();
    scene.add(bridgeGroup);
    bridgeGroupRef.current = bridgeGroup;

    // Mouse Orbit & Pan Handlers
    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !cameraRef.current) return;
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;

      if (e.buttons === 1) {
        // Orbit
        const target = new THREE.Vector3(120, 15, 0);
        const offset = cameraRef.current.position.clone().sub(target);
        const radius = offset.length();
        let theta = Math.atan2(offset.x, offset.z) - deltaX * 0.006;
        let phi = Math.acos(Math.max(-1, Math.min(1, offset.y / radius))) + deltaY * 0.006;
        phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, phi));

        cameraRef.current.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
        cameraRef.current.position.y = target.y + radius * Math.cos(phi);
        cameraRef.current.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
        cameraRef.current.lookAt(target);
      } else if (e.buttons === 2) {
        // Pan
        cameraRef.current.position.x -= deltaX * 0.3;
        cameraRef.current.position.y += deltaY * 0.3;
      }

      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!cameraRef.current) return;
      const zoomFactor = e.deltaY * 0.15;
      const target = new THREE.Vector3(120, 15, 0);
      const dir = cameraRef.current.position.clone().sub(target).normalize();
      cameraRef.current.position.addScaledVector(dir, zoomFactor);
    };

    const dom = containerRef.current;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());

    // Resize Observer
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight || 520;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Render Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current && rendererRef.current.domElement) {
        dom.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, []);

  // 2. Camera Preset Controls
  useEffect(() => {
    if (!cameraRef.current) return;
    const target = new THREE.Vector3(120, 15, 0);
    switch (cameraPreset) {
      case 'iso':
        cameraRef.current.position.set(160, 65, 150);
        break;
      case 'elevation':
        cameraRef.current.position.set(120, 25, 200);
        break;
      case 'cross':
        cameraRef.current.position.set(-60, 30, 0);
        break;
      case 'plan':
        cameraRef.current.position.set(120, 240, 0.1);
        break;
    }
    cameraRef.current.lookAt(target);
  }, [cameraPreset]);

  // 3. 🌟 지형(Terrain Mesh) 및 교량 구조물 동적 3D 파라메트릭 빌드
  useEffect(() => {
    if (!bridgeGroupRef.current || !terrainGroupRef.current) return;
    const bGroup = bridgeGroupRef.current;
    const tGroup = terrainGroupRef.current;

    // Clear previous objects
    while (bGroup.children.length > 0) {
      const obj = bGroup.children[0];
      bGroup.remove(obj);
    }
    while (tGroup.children.length > 0) {
      const obj = tGroup.children[0];
      tGroup.remove(obj);
    }

    const {
      bridge_length,
      bridge_width,
      spans,
      piers,
      abutments,
      terrain = DEFAULT_TERRAIN,
      alignment = DEFAULT_ALIGNMENT
    } = bridgeParams;

    const totalBridgeLen = bridge_length || spans.reduce((sum, s) => sum + s.span_length, 0);

    // =========================================================================
    // 1. 지형 메쉬 (Terrain Mesh) 생성 (Step 1.2)
    // =========================================================================
    if (showTerrain) {
      const xMargin = 60;
      const xStart = -xMargin;
      const xEnd = totalBridgeLen + xMargin;
      const xSpan = xEnd - xStart;
      const zSpan = 180; // 폭원 방향 지형 폭
      const xSegments = 80;
      const zSegments = 30;

      const terrainGeo = new THREE.PlaneGeometry(xSpan, zSpan, xSegments, zSegments);
      terrainGeo.rotateX(-Math.PI / 2); // XZ 평면으로 눕힘
      terrainGeo.translate(xStart + xSpan / 2, 0, 0);

      const posAttr = terrainGeo.attributes.position;
      let minWaterY = Infinity;

      for (let i = 0; i < posAttr.count; i++) {
        const vx = posAttr.getX(i);
        const vz = posAttr.getZ(i);

        // 중심선 상의 지반고
        const { groundElevation, isWater, waterSurfaceElevation } = calculateOriginalGround(
          vx,
          totalBridgeLen,
          terrain,
          alignment
        );

        // 횡단 방향(Z축) 완만한 자연 구릉 경사 가미 (산악 계곡감 연출)
        const zDist = Math.abs(vz);
        const sideSlope = (zDist / (zSpan / 2)) * 3.5;
        const vy = groundElevation + sideSlope;

        posAttr.setY(i, vy);

        if (isWater && waterSurfaceElevation !== null) {
          minWaterY = Math.min(minWaterY, waterSurfaceElevation);
        }
      }

      terrainGeo.computeVertexNormals();

      // 지형 재질 (자연스러운 토사/잔디 텍스처 컬러)
      const terrainMat = new THREE.MeshStandardMaterial({
        color: 0x334D36, // 차분한 딥 포레스트 그린 / 올리브 토사
        roughness: 0.9,
        metalness: 0.05,
        wireframe
      });
      const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
      terrainMesh.receiveShadow = true;
      tGroup.add(terrainMesh);

      // 하천 수면 메쉬 (River Water Plane)
      if (terrain.type === 'RIVER_CROSSING' && minWaterY !== Infinity) {
        const waterWidth = terrain.river_width + 10;
        const waterGeo = new THREE.PlaneGeometry(waterWidth, zSpan);
        waterGeo.rotateX(-Math.PI / 2);
        waterGeo.translate(totalBridgeLen / 2, minWaterY, 0);

        const waterMat = new THREE.MeshStandardMaterial({
          color: 0x0284C7, // 청록빛 하천 수면
          roughness: 0.15,
          metalness: 0.2,
          transparent: true,
          opacity: 0.72
        });
        const waterMesh = new THREE.Mesh(waterGeo, waterMat);
        tGroup.add(waterMesh);
      }
    } else {
      // 심플 모드 바닥 그리드
      const grid = new THREE.GridHelper(600, 60, 0x475569, 0x1E293B);
      grid.position.y = -0.1;
      tGroup.add(grid);
    }

    // =========================================================================
    // 2. 상부 구조 (Superstructure) 및 경간 빌드
    // =========================================================================
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, roughness: 0.6, metalness: 0.1, wireframe });
    const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.9, wireframe });
    const steelBoxMat = new THREE.MeshStandardMaterial({ color: 0x3B82F6, roughness: 0.35, metalness: 0.75, wireframe });
    const pierMat = new THREE.MeshStandardMaterial({ color: 0xCBD5E1, roughness: 0.7, wireframe });
    const pileMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, roughness: 0.4, metalness: 0.6, wireframe });

    let currentX = 0;
    spans.forEach((span, idx) => {
      const spanLen = span.span_length;
      const spanGroup = new THREE.Group();

      // 시작점 및 끝점 계획고
      const fgStart = calculateFormationGround(currentX, alignment);
      const fgEnd = calculateFormationGround(currentX + spanLen, alignment);
      const avgDeckY = (fgStart + fgEnd) / 2;

      // 1. Deck Slab & Pavement
      const slabThick = 0.45;
      const deckGeo = new THREE.BoxGeometry(spanLen - 0.2, slabThick, bridge_width);
      const deckMesh = new THREE.Mesh(deckGeo, concreteMat);
      deckMesh.position.set(currentX + spanLen / 2, avgDeckY, 0);
      deckMesh.castShadow = true;
      deckMesh.receiveShadow = true;
      spanGroup.add(deckMesh);

      // Pavement
      const paveGeo = new THREE.BoxGeometry(spanLen - 0.2, 0.08, bridge_width - 1.2);
      const paveMesh = new THREE.Mesh(paveGeo, asphaltMat);
      paveMesh.position.set(currentX + spanLen / 2, avgDeckY + slabThick / 2 + 0.04, 0);
      spanGroup.add(paveMesh);

      // Guardrails
      const railGeo = new THREE.BoxGeometry(spanLen - 0.2, 1.1, 0.4);
      const railLeft = new THREE.Mesh(railGeo, concreteMat);
      railLeft.position.set(currentX + spanLen / 2, avgDeckY + slabThick / 2 + 0.55, bridge_width / 2 - 0.25);
      const railRight = railLeft.clone();
      railRight.position.z = -bridge_width / 2 + 0.25;
      spanGroup.add(railLeft);
      spanGroup.add(railRight);

      // 2. 형식별 거더 지오메트리 차별화 (Step 1.4 지오메트리 고도화 연계)
      const isSteel = span.type.includes('STEEL') || span.type === 'STEEL_BOX_CONTINUOUS_80M';
      const isArch = span.type === 'STEEL_ARCH';

      if (isSteel) {
        // 강박스 거더: 2~3열 스틸 박스
        const boxCount = bridge_width >= 24 ? 3 : 2;
        const boxSpacing = (bridge_width - 6) / Math.max(1, boxCount - 1);
        for (let b = 0; b < boxCount; b++) {
          const bz = (b - (boxCount - 1) / 2) * boxSpacing;
          const girderGeo = new THREE.BoxGeometry(spanLen - 0.4, 2.4, 2.2);
          const girderMesh = new THREE.Mesh(girderGeo, steelBoxMat);
          girderMesh.position.set(currentX + spanLen / 2, avgDeckY - slabThick / 2 - 1.2, bz);
          girderMesh.castShadow = true;
          spanGroup.add(girderMesh);
        }
      } else {
        // PSC 빔 거더: 4~6열 I형 거더
        const girderCount = bridge_width >= 24 ? 5 : 4;
        const gSpacing = (bridge_width - 3.5) / Math.max(1, girderCount - 1);
        for (let g = 0; g < girderCount; g++) {
          const gz = (g - (girderCount - 1) / 2) * gSpacing;
          const gGeo = new THREE.BoxGeometry(spanLen - 0.3, 2.0, 0.7);
          const gMesh = new THREE.Mesh(gGeo, concreteMat);
          gMesh.position.set(currentX + spanLen / 2, avgDeckY - slabThick / 2 - 1.0, gz);
          gMesh.castShadow = true;
          spanGroup.add(gMesh);
        }
      }

      // 강아치교 특수 리브
      if (isArch) {
        const archCurveLeft = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(currentX, avgDeckY, bridge_width / 2 - 1),
          new THREE.Vector3(currentX + spanLen / 2, avgDeckY + 32, bridge_width / 2 - 1),
          new THREE.Vector3(currentX + spanLen, avgDeckY, bridge_width / 2 - 1)
        );
        const tubeGeo = new THREE.TubeGeometry(archCurveLeft, 32, 0.9, 8, false);
        const archMesh = new THREE.Mesh(tubeGeo, steelBoxMat);
        spanGroup.add(archMesh);
      }

      bGroup.add(spanGroup);
      currentX += spanLen;
    });

    // =========================================================================
    // 3. 교대 (A1 & A2) 빌드 (지형 표면 안착)
    // =========================================================================
    const createAbutment = (xPos: number, isStart: boolean) => {
      const abutGroup = new THREE.Group();
      const fg = calculateFormationGround(xPos, alignment);
      const { groundElevation: og } = calculateOriginalGround(xPos, totalBridgeLen, terrain, alignment);

      const abutHeight = Math.max(6, fg - og);

      // Backwall & Stem
      const stemGeo = new THREE.BoxGeometry(4.0, abutHeight, bridge_width + 2);
      const stemMesh = new THREE.Mesh(stemGeo, concreteMat);
      stemMesh.position.set(xPos, og + abutHeight / 2, 0);
      stemMesh.castShadow = true;
      abutGroup.add(stemMesh);

      // Footing (지반고 OG에 딱 안착)
      const footingGeo = new THREE.BoxGeometry(8.0, 2.0, bridge_width + 4);
      const footingMesh = new THREE.Mesh(footingGeo, concreteMat);
      footingMesh.position.set(xPos + (isStart ? -2 : 2), og + 1.0, 0);
      footingMesh.castShadow = true;
      abutGroup.add(footingMesh);

      bGroup.add(abutGroup);
    };

    createAbutment(0, true);
    createAbutment(totalBridgeLen, false);

    // =========================================================================
    // 4. 교각 (P1, P2...) 빌드 (지형 지반고 OG에 완벽 결합)
    // =========================================================================
    let spanCumX = 0;
    piers.forEach((pier, idx) => {
      if (idx < spans.length - 1) {
        spanCumX += spans[idx].span_length;
      } else {
        spanCumX = (totalBridgeLen / (piers.length + 1)) * (idx + 1);
      }

      const pierGroup = new THREE.Group();
      const fg = calculateFormationGround(spanCumX, alignment);
      const { groundElevation: og } = calculateOriginalGround(spanCumX, totalBridgeLen, terrain, alignment);

      // 상부고(거더/받침) 차감한 상단 표고
      const topPierY = fg - 2.5;
      const footingTopY = og + 1.5; // 지반고 위 푸팅 상단
      const columnHeight = Math.max(5, topPierY - footingTopY);
      const diam = pier.diameter || 2.8;

      // 1. Coping (T-Head)
      const copingGeo = new THREE.BoxGeometry(4.5, 2.2, bridge_width - 1.0);
      const copingMesh = new THREE.Mesh(copingGeo, pierMat);
      copingMesh.position.set(spanCumX, topPierY - 1.1, 0);
      copingMesh.castShadow = true;
      pierGroup.add(copingMesh);

      // 2. Pier Column (지반선 푸팅까지 수직 연장)
      if (bridge_width >= 24) {
        const colGeo = new THREE.CylinderGeometry(diam / 2, diam / 2, columnHeight, 24);
        const col1 = new THREE.Mesh(colGeo, pierMat);
        col1.position.set(spanCumX, footingTopY + columnHeight / 2, bridge_width / 4);
        col1.castShadow = true;
        const col2 = col1.clone();
        col2.position.z = -bridge_width / 4;
        pierGroup.add(col1);
        pierGroup.add(col2);
      } else {
        const colGeo = new THREE.CylinderGeometry(diam / 2, diam / 2, columnHeight, 24);
        const colMesh = new THREE.Mesh(colGeo, pierMat);
        colMesh.position.set(spanCumX, footingTopY + columnHeight / 2, 0);
        colMesh.castShadow = true;
        pierGroup.add(colMesh);
      }

      // 3. Footing (지표면 OG에 정확히 안착)
      const footingGeo = new THREE.BoxGeometry(diam * 2.6, 2.0, bridge_width * 0.85);
      const footingMesh = new THREE.Mesh(footingGeo, concreteMat);
      footingMesh.position.set(spanCumX, og + 1.0, 0);
      footingMesh.castShadow = true;
      pierGroup.add(footingMesh);

      bGroup.add(pierGroup);
    });

    // =========================================================================
    // 5. 강관말뚝 기초 (지표면 OG에서 암반 지지층까지 관입)
    // =========================================================================
    if (showPiles) {
      const pileRadius = 0.254; // D508 / 2 = 0.254m
      const pileGroups: { x: number; baseY: number; len: number; count: number }[] = [];

      // A1 교대 말뚝
      if (abutments[0]?.foundation === 'PILE') {
        const { groundElevation: og0 } = calculateOriginalGround(0, totalBridgeLen, terrain, alignment);
        pileGroups.push({
          x: 0,
          baseY: og0,
          len: abutments[0].pile_len || 15,
          count: Math.min(36, abutments[0].pile_count || 40)
        });
      }

      // 교각 말뚝
      let pCumX = 0;
      piers.forEach((p, pIdx) => {
        if (pIdx < spans.length - 1) {
          pCumX += spans[pIdx].span_length;
        } else {
          pCumX = (totalBridgeLen / (piers.length + 1)) * (pIdx + 1);
        }
        if (p.foundation === 'PILE') {
          const { groundElevation: ogP } = calculateOriginalGround(pCumX, totalBridgeLen, terrain, alignment);
          pileGroups.push({
            x: pCumX,
            baseY: ogP,
            len: p.pile_len || 15,
            count: Math.min(36, p.pile_count || 50)
          });
        }
      });

      // A2 교대 말뚝
      if (abutments[1]?.foundation === 'PILE') {
        const { groundElevation: ogEnd } = calculateOriginalGround(totalBridgeLen, totalBridgeLen, terrain, alignment);
        pileGroups.push({
          x: totalBridgeLen,
          baseY: ogEnd,
          len: abutments[1].pile_len || 15,
          count: Math.min(36, abutments[1].pile_count || 40)
        });
      }

      const totalInstances = pileGroups.reduce((sum, g) => sum + g.count, 0);

      if (totalInstances > 0) {
        const unitPileGeo = new THREE.CylinderGeometry(pileRadius, pileRadius, 1, 12);
        const instancedPiles = new THREE.InstancedMesh(unitPileGeo, pileMat, totalInstances);
        const dummy = new THREE.Object3D();
        let pileIdx = 0;

        pileGroups.forEach((g) => {
          const cols = 3;
          const rows = Math.ceil(g.count / cols);
          const colSpacing = 2.2;
          const rowSpacing = Math.min(3.5, (bridge_width * 0.7) / Math.max(1, rows - 1));

          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              if (pileIdx >= totalInstances) break;
              const zPos = (r - (rows - 1) / 2) * rowSpacing;
              const xPos = g.x + (c - (cols - 1) / 2) * colSpacing;
              dummy.position.set(xPos, g.baseY - g.len / 2, zPos);
              dummy.scale.set(1, g.len, 1);
              dummy.updateMatrix();
              instancedPiles.setMatrixAt(pileIdx++, dummy.matrix);
            }
          }
        });

        instancedPiles.instanceMatrix.needsUpdate = true;
        bGroup.add(instancedPiles);
      }
    }
  }, [bridgeParams, showPiles, showTerrain, wireframe]);

  return (
    <div className="relative w-full h-[520px] rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shadow-inner flex flex-col">
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="w-full flex-1 cursor-grab active:cursor-grabbing" />

      {/* Control Bar Overlay (Left Top) */}
      <div className="absolute top-3 left-3 flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-white shadow-lg">
        <span className="font-bold flex items-center gap-1.5 text-sky-400">
          <Layers className="w-3.5 h-3.5" />
          BIM 3D View
        </span>
        <span className="text-slate-600">|</span>
        <span className="font-mono text-slate-200">L={bridgeParams.bridge_length}m</span>
        <span className="font-mono text-slate-200">B={bridgeParams.bridge_width}m</span>
        <span className="text-slate-400">({bridgeParams.spans.length}경간)</span>
        {bridgeParams.terrain && (
          <span className="text-[10px] bg-indigo-900/70 text-indigo-200 px-1.5 py-0.5 rounded border border-indigo-700/50">
            {bridgeParams.terrain.type === 'RIVER_CROSSING' ? '하천횡단' : bridgeParams.terrain.type === 'VALLEY' ? '계곡지형' : '평지교차'}
          </span>
        )}
      </div>

      {/* View Options Toggle Controls (Bottom Left) */}
      <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md p-1 rounded-lg border border-slate-700 text-xs text-white shadow-lg">
        <button
          onClick={() => setShowTerrain(!showTerrain)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
            showTerrain ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
          title="3D 계곡/하천 지형 메쉬 렌더링 전환"
        >
          <Mountain className="w-3.5 h-3.5" />
          <span>지형 {showTerrain ? 'ON' : 'OFF'}</span>
        </button>

        <button
          onClick={() => setShowPiles(!showPiles)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
            showPiles ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
          title="지중 강관말뚝 기초 투시 렌더링 전환"
        >
          <Layers className="w-3.5 h-3.5" />
          <span>말뚝기초</span>
        </button>

        <button
          onClick={() => setWireframe(!wireframe)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
            wireframe ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
          }`}
          title="와이어프레임 구조 투영"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>와이어</span>
        </button>
      </div>

      {/* Camera View Switcher Buttons (Top Right) */}
      <div className="absolute top-3 right-3 flex items-center gap-1 bg-slate-900/85 backdrop-blur-md p-1 rounded-lg border border-slate-700 shadow-lg">
        <button
          onClick={() => setCameraPreset('iso')}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
            cameraPreset === 'iso' ? 'bg-sky-500 text-white shadow' : 'text-slate-300 hover:text-white'
          }`}
          title="3D 투시도 뷰"
        >
          3D 투시
        </button>
        <button
          onClick={() => setCameraPreset('elevation')}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
            cameraPreset === 'elevation' ? 'bg-sky-500 text-white shadow' : 'text-slate-300 hover:text-white'
          }`}
          title="정면 측면도 (교각/지반 프로파일 확인)"
        >
          정면도
        </button>
        <button
          onClick={() => setCameraPreset('cross')}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
            cameraPreset === 'cross' ? 'bg-sky-500 text-white shadow' : 'text-slate-300 hover:text-white'
          }`}
          title="교축 횡단면도"
        >
          횡단도
        </button>
        <button
          onClick={() => setCameraPreset('plan')}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
            cameraPreset === 'plan' ? 'bg-sky-500 text-white shadow' : 'text-slate-300 hover:text-white'
          }`}
          title="상공 평면도 (항공 조감)"
        >
          평면도
        </button>
      </div>
    </div>
  );
};
