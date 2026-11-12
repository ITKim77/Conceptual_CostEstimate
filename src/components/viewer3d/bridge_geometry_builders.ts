// src/components/viewer3d/bridge_geometry_builders.ts
import * as THREE from 'three';
import {
  AlignmentEvaluator,
  createSweptProfileGeometry,
  createSweptRibbonGeometry,
  generateStationSamples
} from '../../domain/engine/alignment_3d';
import { AbutmentItem, PierItem, SpanItem, SuperstructureType } from '../../domain/models/bridge';

export interface BridgeMaterialSet {
  concrete: THREE.MeshStandardMaterial;
  concreteDark: THREE.MeshStandardMaterial;
  asphalt: THREE.MeshStandardMaterial;
  steelBox: THREE.MeshStandardMaterial;
  steelLight: THREE.MeshStandardMaterial;
  pier: THREE.MeshStandardMaterial;
  pile: THREE.MeshStandardMaterial;
  cable: THREE.MeshStandardMaterial;
  bearing: THREE.MeshStandardMaterial;
  lampPole: THREE.MeshStandardMaterial;
  lampGlow: THREE.MeshBasicMaterial;
}

/**
 * 아스팔트 포장 + 중앙선/차선/길어깨 차선 도색 고해상도 절차적 텍스처 생성
 */
export function createAsphaltMarkingTexture(bridgeWidth: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // 1. 아스팔트 베이스 + 미세 골재 질감
    ctx.fillStyle = '#1E242E';
    ctx.fillRect(0, 0, 512, 512);

    for (let i = 0; i < 4500; i++) {
      const x = (i * 97) % 512;
      const y = (i * 193) % 512;
      const shade = 26 + (i % 18);
      ctx.fillStyle = `rgb(${shade}, ${shade + 4}, ${shade + 10})`;
      ctx.fillRect(x, y, 2, 2);
    }

    // 2. 좌/우측 흰색 길어깨 실선
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(26, 0, 8, 512);
    ctx.fillRect(478, 0, 8, 512);

    // 3. 폭원에 따른 왕복 차로 수 계산 및 점선 차선 구획
    const usableW = Math.max(6, bridgeWidth - 2);
    const totalLanes = Math.max(2, Math.round(usableW / 3.5));
    const lanesPerDir = Math.max(1, Math.floor(totalLanes / 2));

    // 중앙선 (왕복 4차로 이상: 황색 복선)
    ctx.fillStyle = '#FACC15';
    if (bridgeWidth >= 18) {
      ctx.fillRect(247, 0, 6, 512);
      ctx.fillRect(259, 0, 6, 512);
    } else {
      ctx.fillRect(252, 0, 8, 512);
    }

    // 편도 다차로 흰색 점선 차선
    if (lanesPerDir > 1) {
      ctx.fillStyle = '#E2E8F0';
      const halfSpanPx = 216;
      for (let l = 1; l < lanesPerDir; l++) {
        const offsetPx = (l / lanesPerDir) * halfSpanPx;
        const leftLaneX = 250 - offsetPx - 3;
        const rightLaneX = 262 + offsetPx - 3;
        // 14m 반복 주기 내 2구간 점선
        for (let dashY = 24; dashY < 512; dashY += 256) {
          ctx.fillRect(leftLaneX, dashY, 6, 128);
          ctx.fillRect(rightLaneX, dashY, 6, 128);
        }
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

export type SuperstructureCategory =
  | 'ARCH'
  | 'CABLE_STAYED'
  | 'EXTRADOSED'
  | 'PSC_BOX_FCM'
  | 'PSC_BOX'
  | 'STEEL_BOX'
  | 'RATIONALIZED_PLATE'
  | 'STEEL_PLATE'
  | 'RC_RAHMEN'
  | 'RC_BOX'
  | 'PSC_LOW_DEPTH'
  | 'PSC_U_TROUGH'
  | 'PSC_GIRDER_HAUNCHED'
  | 'PSC_GIRDER_I';

/**
 * 상부형식 세부 공종 카테고리 판별 (공법·단면 특화 3D 형상 매핑)
 */
export function classifySuperstructure(type: SuperstructureType): SuperstructureCategory {
  if (type === 'STEEL_ARCH') return 'ARCH';
  if (type === 'CABLE_STAYED') return 'CABLE_STAYED';
  if (type === 'EXTRADOSED') return 'EXTRADOSED';
  if (type === 'PSC_BOX_FCM') return 'PSC_BOX_FCM';
  if (type.startsWith('PSC_BOX')) return 'PSC_BOX';
  if (type.startsWith('STEEL_BOX')) return 'STEEL_BOX';
  if (type === 'RATIONALIZED_PLATE') return 'RATIONALIZED_PLATE';
  if (type === 'STEEL_PLATE') return 'STEEL_PLATE';
  if (type === 'RC_RAHMEN') return 'RC_RAHMEN';
  if (type === 'RC_BOX') return 'RC_BOX';
  if (
    type === 'PF_BEAM' ||
    type === 'RPF_BEAM' ||
    type === 'Precom_GIRDER' ||
    type === 'Turnover_GIRDER' ||
    type === 'IH_GIRDER' ||
    type === 'IT_GIRDER'
  ) {
    return 'PSC_LOW_DEPTH';
  }
  if (type === 'BICON_GIRDER' || type === 'UDPC' || type === 'PCT_GIRDER') {
    return 'PSC_U_TROUGH';
  }
  if (
    type === 'MODIFIED_PSC_BEAM' ||
    type === 'DR_GIRDER' ||
    type === 'SPLICED_GIRDER_G' ||
    type === 'SPLICED_GIRDER_B' ||
    type === 'OPTIMIZED_GIRDER' ||
    type === 'TOP_GIRDER'
  ) {
    return 'PSC_GIRDER_HAUNCHED';
  }
  return 'PSC_GIRDER_I';
}

/**
 * 2D 표준 단면 폴리곤 생성 헬퍼 [yLocal, zLocal]
 */
function buildIProfile(topW: number, botW: number, webW: number, totalH: number, topY: number): Array<[number, number]> {
  const flangeH = Math.max(0.18, totalH * 0.16);
  const slopeH = Math.max(0.12, totalH * 0.11);
  const ht = topW / 2;
  const hb = botW / 2;
  const hw = webW / 2;
  const yTop = topY;
  const yFlangeBot = topY - flangeH;
  const yWebTop = yFlangeBot - slopeH;
  const yBot = topY - totalH;
  const yBotFlangeTop = yBot + flangeH;
  const yWebBot = yBotFlangeTop + slopeH;

  return [
    [yTop, ht],
    [yTop, -ht],
    [yFlangeBot, -ht],
    [yWebTop, -hw],
    [yWebBot, -hw],
    [yBotFlangeTop, -hb],
    [yBot, -hb],
    [yBot, hb],
    [yBotFlangeTop, hb],
    [yWebBot, hw],
    [yWebTop, hw],
    [yFlangeBot, ht]
  ];
}

function buildTrapezoidBoxProfile(topW: number, botW: number, depth: number, topY: number): Array<[number, number]> {
  const ht = topW / 2;
  const hb = botW / 2;
  return [
    [topY, ht],
    [topY, -ht],
    [topY - depth, -hb],
    [topY - depth, hb]
  ];
}

function buildUTroughProfile(topW: number, botW: number, depth: number, wallT: number, topY: number): Array<[number, number]> {
  const ht = topW / 2;
  const hb = botW / 2;
  const hti = Math.max(0.25, ht - wallT);
  const hbi = Math.max(0.2, hb - wallT);
  const innerFloorY = topY - depth + Math.max(0.24, depth * 0.18);
  return [
    [topY, ht],
    [topY, hti],
    [innerFloorY, hbi],
    [innerFloorY, -hbi],
    [topY, -hti],
    [topY, -ht],
    [topY - depth, -hb],
    [topY - depth, hb]
  ];
}

/**
 * 지점부(교각·교대 받침 위치) 기준 상판 하부 총 구조고 (하부공 받침부 높이 정합용)
 */
export function getGirderStructuralDepth(type: SuperstructureType, maxSpanLen: number): number {
  const cat = classifySuperstructure(type);
  if (cat === 'PSC_BOX_FCM') return Math.max(2.9, Math.min(5.2, maxSpanLen * 0.056));
  if (cat === 'PSC_BOX') return Math.max(2.3, Math.min(3.8, maxSpanLen * 0.044));
  if (cat === 'STEEL_BOX') return Math.max(2.2, Math.min(3.8, maxSpanLen * 0.042));
  if (cat === 'RATIONALIZED_PLATE') return Math.max(2.2, Math.min(3.6, maxSpanLen * 0.046));
  if (cat === 'STEEL_PLATE') return Math.max(1.9, Math.min(3.1, maxSpanLen * 0.04));
  if (cat === 'RC_RAHMEN') return 1.8;
  if (cat === 'RC_BOX') return Math.max(2.8, Math.min(4.2, maxSpanLen * 0.14));
  if (cat === 'CABLE_STAYED') return 2.2;
  if (cat === 'EXTRADOSED') return Math.max(2.5, Math.min(3.8, maxSpanLen * 0.036));
  if (cat === 'PSC_LOW_DEPTH') return Math.max(1.45, Math.min(2.25, maxSpanLen * 0.036));
  if (cat === 'PSC_GIRDER_HAUNCHED') return Math.max(2.1, Math.min(3.1, maxSpanLen * 0.052));
  if (cat === 'PSC_U_TROUGH') return Math.max(1.9, Math.min(2.8, maxSpanLen * 0.046));
  return Math.max(1.8, Math.min(2.7, maxSpanLen * 0.046));
}

/**
 * 선형 기반 연속 고(高)LOD 상부구조물 생성
 * - 곡선/종단/편경사를 완벽히 추종하는 연속 바닥판, 헌치 캔틸레버, 아스팔트 차선, 콘크리트 방호벽, 중앙분리대, 신축이음, 가로등
 * - 교량 형식별(PSC I거더+가로보 / 강박스+격벽 / PSC박스+변단면 / 아치교+행어 / 사장교+주탑+케이블 / 라멘) 특화 지오메트리
 */
export function buildHighLodSuperstructure(
  group: THREE.Group,
  spans: SpanItem[],
  bridgeWidth: number,
  totalLength: number,
  evaluator: AlignmentEvaluator,
  mats: BridgeMaterialSet,
  showPiles: boolean,
  skewRad: number = 0
): void {
  void showPiles;
  const clampedSkew = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, skewRad || 0));
  const skewTan = Math.tan(clampedSkew);
  const cosSkew = Math.max(0.5, Math.cos(clampedSkew));
  const applySkewBasis = (mesh: THREE.Object3D, pt: ReturnType<AlignmentEvaluator>) => {
    const c = Math.cos(clampedSkew);
    const s = Math.sin(clampedSkew);
    const tSkew = pt.tangent.clone().multiplyScalar(c).addScaledVector(pt.right, -s).normalize();
    const rSkew = pt.tangent.clone().multiplyScalar(s).addScaledVector(pt.right, c).normalize();
    const uSkew = new THREE.Vector3().crossVectors(rSkew, tSkew).normalize();
    mesh.setRotationFromMatrix(new THREE.Matrix4().makeBasis(tSkew, uSkew, rSkew));
  };

  const B = Math.max(8, bridgeWidth);
  const halfB = B / 2;
  const fullStations = generateStationSamples(0, totalLength, 3.5);

  const slabThick = 0.34;
  const overhangDrop = 0.18;
  const cantileverStartZ = halfB * 0.72;

  // 1. 캔틸레버 헌치 바닥판 (Deck Slab with sloped overhangs + 사각 단부 보정)
  const deckProfile: Array<[number, number]> = [
    [0.05, halfB],
    [0.05, -halfB],
    [-overhangDrop, -halfB],
    [-slabThick, -cantileverStartZ],
    [-slabThick, cantileverStartZ],
    [-overhangDrop, halfB]
  ];
  const deckMesh = new THREE.Mesh(
    createSweptProfileGeometry(deckProfile, fullStations, evaluator, {
      uvLengthScale: 8,
      skewTan
    }),
    mats.concrete
  );
  deckMesh.castShadow = true;
  deckMesh.receiveShadow = true;
  group.add(deckMesh);

  // 2. 아스팔트 포장 및 차선 도색 리본
  const curbInset = 0.55;
  const paveGeo = createSweptRibbonGeometry(
    -(halfB - curbInset),
    halfB - curbInset,
    0.09,
    fullStations,
    evaluator,
    14,
    skewTan
  );
  const paveMesh = new THREE.Mesh(paveGeo, mats.asphalt);
  paveMesh.receiveShadow = true;
  group.add(paveMesh);

  // 3. 좌·우측 콘크리트 Jersey 방호벽 (실제 단차 및 경사면 포함)
  const barrierProfile: Array<[number, number]> = [
    [1.12, 0.22],
    [1.12, 0.0],
    [0.36, -0.08],
    [0.18, -0.22],
    [0.04, -0.22],
    [0.04, 0.22]
  ];
  const barrierRight = new THREE.Mesh(
    createSweptProfileGeometry(barrierProfile, fullStations, evaluator, {
      offsetZ: halfB - 0.22,
      skewTan
    }),
    mats.concrete
  );
  barrierRight.castShadow = true;
  group.add(barrierRight);

  const barrierLeftProfile: Array<[number, number]> = barrierProfile.map(([y, z]) => [y, -z]);
  const barrierLeft = new THREE.Mesh(
    createSweptProfileGeometry(barrierLeftProfile, fullStations, evaluator, {
      offsetZ: -(halfB - 0.22),
      skewTan
    }),
    mats.concrete
  );
  barrierLeft.castShadow = true;
  group.add(barrierLeft);

  // 왕복 4차로 이상(B >= 18m) 중앙분리대
  if (B >= 18) {
    const medianProfile: Array<[number, number]> = [
      [0.98, 0.14],
      [0.98, -0.14],
      [0.30, -0.24],
      [0.05, -0.32],
      [0.05, 0.32],
      [0.30, 0.24]
    ];
    const medianMesh = new THREE.Mesh(
      createSweptProfileGeometry(medianProfile, fullStations, evaluator, { skewTan }),
      mats.concrete
    );
    medianMesh.castShadow = true;
    group.add(medianMesh);
  }

  // 4. 시·종점 신축이음장치 (Expansion Joints - 사각선 평행)
  [0.25, totalLength - 0.25].forEach((sJoint) => {
    const jointStations = generateStationSamples(
      Math.max(0, sJoint - 0.2),
      Math.min(totalLength, sJoint + 0.2),
      0.4
    );
    const jointGeo = createSweptProfileGeometry(
      [
        [0.12, halfB - curbInset],
        [0.12, -(halfB - curbInset)],
        [0.04, -(halfB - curbInset)],
        [0.04, halfB - curbInset]
      ],
      jointStations,
      evaluator,
      { skewTan }
    );
    const jointMesh = new THREE.Mesh(jointGeo, mats.concreteDark);
    group.add(jointMesh);
  });

  // 5. 교량 가로등 (약 35m 간격, 선형 곡선 및 사각 좌우 방호벽 상단 배치)
  const poleCount = Math.max(2, Math.floor(totalLength / 36));
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, 6.2, 8);
  const armGeo = new THREE.BoxGeometry(0.09, 0.09, 2.2);
  const lampHeadGeo = new THREE.BoxGeometry(0.35, 0.14, 0.8);

  for (let p = 0; p <= poleCount; p++) {
    const sPole = 8 + ((totalLength - 16) * p) / Math.max(1, poleCount);
    [-1, 1].forEach((side) => {
      // 양쪽 교대 배치 혹은 4차로 이상 양측 대칭
      if (B < 18 && (p + (side > 0 ? 1 : 0)) % 2 !== 0) return;

      const zSide = side * (halfB - 0.2);
      const sPoleSkewed = sPole + zSide * skewTan;
      if (sPoleSkewed <= 1.2 || sPoleSkewed >= totalLength - 1.2) return;
      const sample = evaluator(sPoleSkewed);

      const poleGroup = new THREE.Group();
      const basePos = sample.position
        .clone()
        .addScaledVector(sample.up, 1.1)
        .addScaledVector(sample.right, zSide);
      poleGroup.position.copy(basePos);
      poleGroup.rotation.y = sample.yawRad;

      const pole = new THREE.Mesh(poleGeo, mats.lampPole);
      pole.position.set(0, 3.1, 0);
      poleGroup.add(pole);

      const arm = new THREE.Mesh(armGeo, mats.lampPole);
      arm.position.set(0, 6.1, -side * 1.0);
      arm.rotation.x = side * 0.12;
      poleGroup.add(arm);

      const head = new THREE.Mesh(lampHeadGeo, mats.lampGlow);
      head.position.set(0, 6.22, -side * 1.9);
      poleGroup.add(head);

      group.add(poleGroup);
    });
  }

  // 6. 경간별 형식 특화 상부구조물 (거더 · 아치 · 주탑/케이블 · 가로보)
  const pierStations: number[] = [];
  let cumS = 0;
  spans.forEach((sp, idx) => {
    const startS = cumS;
    const endS = Math.min(totalLength, cumS + sp.span_length);
    if (idx < spans.length - 1) {
      pierStations.push(endS);
    }

    const cat = classifySuperstructure(sp.type);
    const spanLen = endS - startS;
    const spanStations = generateStationSamples(startS + 0.08, endS - 0.08, 3.5);
    const girderTopY = -slabThick;
    const girderDepth = getGirderStructuralDepth(sp.type, spanLen);

    if (cat === 'PSC_BOX_FCM' || cat === 'PSC_BOX') {
      // PSC BOX (FCM 변단면 캔틸레버 vs ILM/MSS/FSM 일정단면 박스거더, 광폭 2셀 분기)
      const isFcm = cat === 'PSC_BOX_FCM' || spanLen >= 75;
      const boxCount = !isFcm && B >= 20 ? 2 : 1;
      const spacing = boxCount === 2 ? B * 0.44 : 0;
      const boxTopW = boxCount === 2 ? Math.min(8.5, B * 0.36) : Math.min(B * 0.74, 14.0);
      const boxBotW = boxTopW * 0.6;
      const boxProfile = buildTrapezoidBoxProfile(boxTopW, boxBotW, girderDepth, girderTopY);

      for (let b = 0; b < boxCount; b++) {
        const zOff = (b - (boxCount - 1) / 2) * spacing;
        const boxGeo = createSweptProfileGeometry(boxProfile, spanStations, evaluator, {
          offsetZ: zOff,
          pivotY: girderTopY,
          skewTan,
          depthScaleFn: isFcm
            ? (s) => {
                const u = (s - startS) / Math.max(1, spanLen);
                const edgeFactor = Math.pow(Math.abs(u - 0.5) * 2, 2);
                return 0.54 + edgeFactor * 0.46; // 중앙부 슬림 -> 지점부 1.0x 포물선 헌치
              }
            : undefined
        });
        const boxMesh = new THREE.Mesh(boxGeo, mats.concrete);
        boxMesh.castShadow = true;
        boxMesh.receiveShadow = true;
        group.add(boxMesh);
      }

      // 지점부 주두부(Pier Table) 보강 격벽 칼라
      [startS + 0.4, endS - 0.4].forEach((sCollar) => {
        const pt = evaluator(sCollar);
        const collarGeo = new THREE.BoxGeometry(
          isFcm ? 2.2 : 1.0,
          girderDepth * 0.94,
          Math.min(B - 1.5, boxTopW * boxCount + 1.2) / cosSkew
        );
        const collar = new THREE.Mesh(collarGeo, mats.concreteDark);
        collar.position.copy(pt.position).addScaledVector(pt.up, girderTopY - girderDepth * 0.48);
        applySkewBasis(collar, pt);
        group.add(collar);
      });
    } else if (cat === 'STEEL_BOX') {
      // 다실(2~3열) 사다리꼴 강박스 거더 + 연속교 변단면 + 사각 평행 횡방향 격벽 프레임
      const boxCount = B >= 22 ? 3 : 2;
      const spacing = (B - 5.5) / Math.max(1, boxCount - 1);
      const isContinuous = sp.type.includes('CONTINUOUS');
      const boxTopW = Math.min(2.8, spacing * 0.42);
      const boxBotW = boxTopW * 0.68;
      const boxProfile = buildTrapezoidBoxProfile(boxTopW, boxBotW, girderDepth, girderTopY);

      for (let b = 0; b < boxCount; b++) {
        const zOff = (b - (boxCount - 1) / 2) * spacing;
        const boxGeo = createSweptProfileGeometry(boxProfile, spanStations, evaluator, {
          offsetZ: zOff,
          pivotY: girderTopY,
          skewTan,
          depthScaleFn:
            isContinuous && spanLen >= 50
              ? (s) => {
                  const u = (s - startS) / Math.max(1, spanLen);
                  const endProximity = Math.pow(Math.abs(u - 0.5) * 2, 2);
                  return 0.72 + endProximity * 0.28;
                }
              : undefined
        });
        const boxMesh = new THREE.Mesh(boxGeo, mats.steelBox);
        boxMesh.castShadow = true;
        group.add(boxMesh);
      }

      // 강박스 횡방향 가로보 (Cross-Frames)
      if (boxCount >= 2) {
        const cfCount = Math.max(2, Math.round(spanLen / 12));
        const cfGeo = new THREE.BoxGeometry(
          0.35,
          girderDepth * 0.62,
          (spacing * (boxCount - 1)) / cosSkew
        );
        for (let c = 1; c < cfCount; c++) {
          const sCF = startS + (spanLen * c) / cfCount;
          const pt = evaluator(sCF);
          const cf = new THREE.Mesh(cfGeo, mats.steelLight);
          cf.position
            .copy(pt.position)
            .addScaledVector(pt.up, girderTopY - girderDepth * 0.48);
          applySkewBasis(cf, pt);
          group.add(cf);
        }
      }
    } else if (cat === 'RATIONALIZED_PLATE' || cat === 'STEEL_PLATE') {
      // 합리화 소수주형(2주형 대형 I거더 + 중량 가로보) vs 표준 강판형(4~5주형)
      const isRationalized = cat === 'RATIONALIZED_PLATE';
      const gCount = isRationalized ? 2 : B >= 22 ? 5 : 4;
      const spacing = isRationalized ? B * 0.54 : (B - 4.0) / Math.max(1, gCount - 1);
      const plateProfile = isRationalized
        ? buildIProfile(0.88, 0.96, 0.22, girderDepth, girderTopY)
        : buildIProfile(0.55, 0.62, 0.14, girderDepth, girderTopY);

      for (let g = 0; g < gCount; g++) {
        const zOff = (g - (gCount - 1) / 2) * spacing;
        const gMesh = new THREE.Mesh(
          createSweptProfileGeometry(plateProfile, spanStations, evaluator, {
            offsetZ: zOff,
            skewTan
          }),
          mats.steelBox
        );
        gMesh.castShadow = true;
        group.add(gMesh);
      }

      const braceCount = Math.max(3, Math.round(spanLen / (isRationalized ? 8 : 10)));
      const braceGeo = new THREE.BoxGeometry(
        isRationalized ? 0.34 : 0.18,
        girderDepth * (isRationalized ? 0.72 : 0.55),
        (spacing * (gCount - 1)) / cosSkew
      );
      for (let b = 1; b < braceCount; b++) {
        const sBr = startS + (spanLen * b) / braceCount;
        const pt = evaluator(sBr);
        const br = new THREE.Mesh(braceGeo, mats.steelLight);
        br.position.copy(pt.position).addScaledVector(pt.up, girderTopY - girderDepth * 0.46);
        applySkewBasis(br, pt);
        group.add(br);
      }
    } else if (cat === 'RC_RAHMEN') {
      // 라멘교: 단부 포탈 헌치가 깊어지는 일체식 슬래브 + 지점부 강결 우각부 브래킷
      const rahmenProfile = buildTrapezoidBoxProfile(B * 0.88, B * 0.84, girderDepth, girderTopY);
      const rGeo = createSweptProfileGeometry(rahmenProfile, spanStations, evaluator, {
        pivotY: girderTopY,
        skewTan,
        depthScaleFn: (s) => {
          const u = (s - startS) / Math.max(1, spanLen);
          const haunch = Math.pow(Math.abs(u - 0.5) * 2, 3);
          return 0.58 + haunch * 0.42;
        }
      });
      const rMesh = new THREE.Mesh(rGeo, mats.concrete);
      rMesh.castShadow = true;
      group.add(rMesh);
    } else if (cat === 'RC_BOX') {
      // 노출 RC BOX 라멘 암거: 상·하·좌·우 폐합 콘크리트 박스 단면 + 중공 입면 링
      const boxW = B * 0.92;
      const wallT = 0.52;
      const leftWall = buildTrapezoidBoxProfile(wallT, wallT, girderDepth, girderTopY);
      const bottomSlab = buildTrapezoidBoxProfile(boxW, boxW, wallT, girderTopY - girderDepth + wallT);
      [-boxW / 2 + wallT / 2, 0, boxW / 2 - wallT / 2].forEach((zW) => {
        const wMesh = new THREE.Mesh(
          createSweptProfileGeometry(leftWall, spanStations, evaluator, { offsetZ: zW, skewTan }),
          mats.concrete
        );
        wMesh.castShadow = true;
        group.add(wMesh);
      });
      const botMesh = new THREE.Mesh(
        createSweptProfileGeometry(bottomSlab, spanStations, evaluator, { skewTan }),
        mats.concreteDark
      );
      botMesh.receiveShadow = true;
      group.add(botMesh);
    } else if (cat === 'ARCH') {
      // 보강 강박스 거더 + 양측 대칭 사각 대응 강아치 리브 + 행어 + 상부 풍구 + 횡방향 바닥보
      const edgeBoxProfile = buildTrapezoidBoxProfile(1.8, 1.5, 2.0, girderTopY);
      [-halfB + 1.1, halfB - 1.1].forEach((zEdge) => {
        const edgeMesh = new THREE.Mesh(
          createSweptProfileGeometry(edgeBoxProfile, spanStations, evaluator, {
            offsetZ: zEdge,
            skewTan
          }),
          mats.steelBox
        );
        edgeMesh.castShadow = true;
        group.add(edgeMesh);
      });

      // 하부 횡방향 강재 바닥보 (Floor Beams)
      const fbCount = Math.max(4, Math.round(spanLen / 7));
      const fbGeo = new THREE.BoxGeometry(0.32, 1.25, (B - 2.2) / cosSkew);
      for (let f = 1; f < fbCount; f++) {
        const pt = evaluator(startS + (spanLen * f) / fbCount);
        const fb = new THREE.Mesh(fbGeo, mats.steelLight);
        fb.position.copy(pt.position).addScaledVector(pt.up, girderTopY - 0.72);
        applySkewBasis(fb, pt);
        group.add(fb);
      }

      const archRise = Math.min(34, Math.max(14, spanLen * 0.22));
      const archSamples = 32;
      const ribZOffsets = [-(halfB - 0.8), halfB - 0.8];
      const ribPointsLeftRight: THREE.Vector3[][] = [[], []];

      ribZOffsets.forEach((zOff, ribIdx) => {
        const ribShiftS = zOff * skewTan;
        for (let k = 0; k <= archSamples; k++) {
          const u = k / archSamples;
          const s = startS + ribShiftS + 1.5 + (spanLen - 3.0) * u;
          const sample = evaluator(s);
          const hArch = 4 * archRise * u * (1 - u);
          const p = sample.position
            .clone()
            .addScaledVector(sample.up, hArch)
            .addScaledVector(sample.right, zOff);
          ribPointsLeftRight[ribIdx].push(p);
        }
        const curve = new THREE.CatmullRomCurve3(ribPointsLeftRight[ribIdx]);
        const ribGeo = new THREE.TubeGeometry(curve, 36, 0.75, 8, false);
        const ribMesh = new THREE.Mesh(ribGeo, mats.steelBox);
        ribMesh.castShadow = true;
        group.add(ribMesh);
      });

      for (let k = 3; k < archSamples - 2; k += 2) {
        const u = k / archSamples;
        const hArch = 4 * archRise * u * (1 - u);

        ribZOffsets.forEach((zOff) => {
          if (hArch < 2.5) return;
          const sRib = startS + zOff * skewTan + 1.5 + (spanLen - 3.0) * u;
          const sample = evaluator(sRib);
          const topPt = sample.position
            .clone()
            .addScaledVector(sample.up, hArch)
            .addScaledVector(sample.right, zOff);
          const botPt = sample.position
            .clone()
            .addScaledVector(sample.up, 0.2)
            .addScaledVector(sample.right, zOff);
          const dist = topPt.distanceTo(botPt);
          const hangerGeo = new THREE.CylinderGeometry(0.08, 0.08, dist, 6);
          const hanger = new THREE.Mesh(hangerGeo, mats.cable);
          hanger.position.copy(topPt).lerp(botPt, 0.5);
          hanger.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            topPt.clone().sub(botPt).normalize()
          );
          group.add(hanger);
        });

        if (hArch > archRise * 0.55) {
          const pL = ribPointsLeftRight[0][k];
          const pR = ribPointsLeftRight[1][k];
          const strutLen = pL.distanceTo(pR);
          const strutGeo = new THREE.CylinderGeometry(0.28, 0.28, strutLen, 8);
          const strut = new THREE.Mesh(strutGeo, mats.steelLight);
          strut.position.copy(pL).lerp(pR, 0.5);
          strut.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            pR.clone().sub(pL).normalize()
          );
          group.add(strut);
        }
      }
    } else if (cat === 'CABLE_STAYED') {
      // 사장교: 강합성 유선형 에지 박스 보강거더 (청회색 강박스 하부 + 리브)
      const deckBoxProfile = buildTrapezoidBoxProfile(B * 0.94, B * 0.62, girderDepth, girderTopY);
      const boxMesh = new THREE.Mesh(
        createSweptProfileGeometry(deckBoxProfile, spanStations, evaluator, { skewTan }),
        mats.steelBox
      );
      boxMesh.castShadow = true;
      group.add(boxMesh);
    } else if (cat === 'EXTRADOSED') {
      // 엑스트라도즈드교: 주탑부 헌치 변단면 광폭 PSC 박스 거더
      const deckBoxProfile = buildTrapezoidBoxProfile(B * 0.86, B * 0.58, girderDepth, girderTopY);
      const boxMesh = new THREE.Mesh(
        createSweptProfileGeometry(deckBoxProfile, spanStations, evaluator, {
          pivotY: girderTopY,
          skewTan,
          depthScaleFn: (s) => {
            const u = (s - startS) / Math.max(1, spanLen);
            const edgeFactor = Math.pow(Math.abs(u - 0.5) * 2, 2);
            return 0.68 + edgeFactor * 0.32;
          }
        }),
        mats.concrete
      );
      boxMesh.castShadow = true;
      group.add(boxMesh);
    } else if (cat === 'PSC_U_TROUGH') {
      // U-거더 / 복부 박스형 (BICON, UDPC, PCT)
      const gCount = B >= 22 ? 4 : 3;
      const gSpacing = (B - 4.2) / Math.max(1, gCount - 1);
      const uProfile = buildUTroughProfile(2.1, 1.45, girderDepth, 0.28, girderTopY);

      for (let g = 0; g < gCount; g++) {
        const zOff = (g - (gCount - 1) / 2) * gSpacing;
        const uMesh = new THREE.Mesh(
          createSweptProfileGeometry(uProfile, spanStations, evaluator, {
            offsetZ: zOff,
            skewTan
          }),
          mats.concrete
        );
        uMesh.castShadow = true;
        group.add(uMesh);
      }

      const diaFractions = [0.04, 0.5, 0.96];
      const diaGeo = new THREE.BoxGeometry(0.45, girderDepth * 0.72, (gSpacing * (gCount - 1)) / cosSkew);
      diaFractions.forEach((f) => {
        const pt = evaluator(startS + spanLen * f);
        const dia = new THREE.Mesh(diaGeo, mats.concreteDark);
        dia.position.copy(pt.position).addScaledVector(pt.up, girderTopY - girderDepth * 0.48);
        applySkewBasis(dia, pt);
        group.add(dia);
      });
    } else {
      // PSC 거더 계열 분기: 저형고 강합성(PF/Precom/IH/IT) vs 변단면(개량/DR/Spliced) vs 표준 I형
      const isLowDepth = cat === 'PSC_LOW_DEPTH';
      const isHaunchedGirder = cat === 'PSC_GIRDER_HAUNCHED';
      const gCount = B >= 22 ? 6 : B >= 16 ? 5 : 4;
      const gSpacing = (B - 3.2) / Math.max(1, gCount - 1);
      const iProfile = isLowDepth
        ? buildIProfile(1.05, 1.05, 0.34, girderDepth, girderTopY)
        : buildIProfile(0.85, 0.74, 0.24, girderDepth, girderTopY);

      for (let g = 0; g < gCount; g++) {
        const zOff = (g - (gCount - 1) / 2) * gSpacing;
        const gMesh = new THREE.Mesh(
          createSweptProfileGeometry(iProfile, spanStations, evaluator, {
            offsetZ: zOff,
            pivotY: girderTopY,
            skewTan,
            depthScaleFn: isHaunchedGirder
              ? (s) => {
                  const u = (s - startS) / Math.max(1, spanLen);
                  const edgeFactor = Math.pow(Math.abs(u - 0.5) * 2, 2);
                  return 0.72 + edgeFactor * 0.28;
                }
              : undefined
          }),
          mats.concrete
        );
        gMesh.castShadow = true;
        group.add(gMesh);

        // 저형고 강합성/프리플렉스 계열은 복부 내장 강재 코어 시각화 띠 추가
        if (isLowDepth) {
          const steelCoreProfile = buildTrapezoidBoxProfile(0.42, 0.42, girderDepth * 0.52, girderTopY - girderDepth * 0.24);
          const sMesh = new THREE.Mesh(
            createSweptProfileGeometry(steelCoreProfile, spanStations, evaluator, {
              offsetZ: zOff,
              skewTan
            }),
            mats.steelBox
          );
          group.add(sMesh);
        }
      }

      const diaFractions = spanLen >= 35 ? [0.03, 0.33, 0.67, 0.97] : [0.03, 0.5, 0.97];
      const diaGeo = new THREE.BoxGeometry(
        0.42,
        girderDepth * 0.72,
        (gSpacing * (gCount - 1)) / cosSkew
      );
      diaFractions.forEach((f) => {
        const sDia = startS + spanLen * f;
        const pt = evaluator(sDia);
        const dia = new THREE.Mesh(diaGeo, mats.concreteDark);
        dia.position
          .copy(pt.position)
          .addScaledVector(pt.up, girderTopY - girderDepth * 0.48);
        applySkewBasis(dia, pt);
        group.add(dia);
      });
    }

    cumS = endS;
  });

  // 7. 사장교 / 엑스트라도즈드교 주탑(Pylon) 및 Fan Stay Cables 생성 (단경간일 경우 중앙 배치 지원)
  const hasCableStays = spans.some(
    (s) => s.type === 'CABLE_STAYED' || s.type === 'EXTRADOSED'
  );
  if (hasCableStays) {
    const isFullCable = spans.some((s) => s.type === 'CABLE_STAYED');
    const maxSpan = Math.max(...spans.map((s) => s.span_length));
    const towerAboveDeck = isFullCable
      ? Math.max(32, Math.min(76, maxSpan * 0.36))
      : Math.max(15, Math.min(26, maxSpan * 0.17));

    const pylonStations = pierStations.length > 0 ? pierStations : [totalLength * 0.5];
    const pylonIndices =
      pylonStations.length <= 2
        ? pylonStations.map((_, i) => i)
        : [Math.floor((pylonStations.length - 1) / 2), Math.ceil((pylonStations.length - 1) / 2)];
    const uniquePylonStations = Array.from(new Set(pylonIndices.map((idx) => pylonStations[idx])));

    uniquePylonStations.forEach((sPylon) => {
      const sample = evaluator(sPylon);
      const pylonGroup = new THREE.Group();
      pylonGroup.position.copy(sample.position);
      pylonGroup.rotation.y = sample.yawRad + clampedSkew;

      const legHalfZ = (halfB + 0.5) / cosSkew;
      const cSkew = Math.cos(clampedSkew);
      const sSkew = Math.sin(clampedSkew);

      if (isFullCable) {
        // 사장교: A형 / 다이아몬드형 경사 수렴 주탑 + 상단 첨탑
        const apexZ = 1.1;
        const baseZ = legHalfZ;
        const legVecLen = Math.hypot(towerAboveDeck, baseZ - apexZ);
        const legTilt = Math.atan2(baseZ - apexZ, towerAboveDeck);
        const legGeo = new THREE.BoxGeometry(2.6, legVecLen, 1.7);

        [-1, 1].forEach((zSign) => {
          const leg = new THREE.Mesh(legGeo, mats.concrete);
          leg.position.set(0, towerAboveDeck / 2 - 1.5, zSign * ((baseZ + apexZ) / 2));
          leg.rotation.x = -zSign * legTilt;
          leg.castShadow = true;
          pylonGroup.add(leg);
        });

        const upperBeam = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, apexZ * 2 + 2.4), mats.concrete);
        upperBeam.position.set(0, towerAboveDeck - 3.5, 0);
        pylonGroup.add(upperBeam);

        const midBeam = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.2, legHalfZ * 1.4), mats.concrete);
        midBeam.position.set(0, towerAboveDeck * 0.45, 0);
        pylonGroup.add(midBeam);
      } else {
        // 엑스트라도즈드교: 저탑 수직 H형 더블 레그 주탑
        const legGeo = new THREE.BoxGeometry(2.8, towerAboveDeck, 1.9);
        [-legHalfZ, legHalfZ].forEach((lz) => {
          const leg = new THREE.Mesh(legGeo, mats.concrete);
          leg.position.set(0, towerAboveDeck / 2 - 2.0, lz);
          leg.castShadow = true;
          pylonGroup.add(leg);
        });
        const upperBeam = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, legHalfZ * 2), mats.concrete);
        upperBeam.position.set(0, towerAboveDeck - 4.2, 0);
        pylonGroup.add(upperBeam);
      }

      group.add(pylonGroup);

      // Fan Stay Cables
      const cableCountPerSide = isFullCable ? 9 : 5;
      const reachLength = Math.min(totalLength * 0.46, maxSpan * 0.85);

      for (let c = 1; c <= cableCountPerSide; c++) {
        const frac = c / (cableCountPerSide + 0.5);
        const anchorOffsetY = towerAboveDeck - 3.2 - c * (isFullCable ? 1.55 : 1.05);
        const localLegZ = isFullCable
          ? legHalfZ * (1 - (anchorOffsetY / Math.max(1, towerAboveDeck)) * 0.78)
          : legHalfZ;

        [-1, 1].forEach((dirSign) => {
          [-1, 1].forEach((zSign) => {
            const zDeck = zSign * (halfB - 0.15);
            const sAnchor = sPylon + dirSign * reachLength * frac + zDeck * skewTan;
            if (sAnchor <= 1.2 || sAnchor >= totalLength - 1.2) return;
            const anchorSample = evaluator(sAnchor);

            const towerTopWorld = sample.position
              .clone()
              .add(new THREE.Vector3(0, anchorOffsetY, 0))
              .addScaledVector(sample.horizTangent, zSign * localLegZ * sSkew)
              .addScaledVector(sample.horizRight, zSign * localLegZ * cSkew);
            const deckAnchorWorld = anchorSample.position
              .clone()
              .addScaledVector(anchorSample.up, 0.35)
              .addScaledVector(anchorSample.right, zDeck);

            const cableLen = towerTopWorld.distanceTo(deckAnchorWorld);
            const cableGeo = new THREE.CylinderGeometry(0.09, 0.09, cableLen, 6);
            const cableMesh = new THREE.Mesh(cableGeo, mats.cable);
            cableMesh.position.copy(towerTopWorld).lerp(deckAnchorWorld, 0.5);
            cableMesh.quaternion.setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              towerTopWorld.clone().sub(deckAnchorWorld).normalize()
            );
            group.add(cableMesh);
          });
        });
      }
    });
  }
}

/**
 * 고(高)LOD 교대(A1/A2) 생성: 기초판 + 구체 + 교좌부 + 배면 흉벽 + 경사 날개벽 + 받침 + 강관말뚝
 */
export function buildHighLodAbutment(
  group: THREE.Group,
  station: number,
  isStart: boolean,
  bridgeWidth: number,
  skewRad: number,
  girderDepth: number,
  og: number,
  abutmentItem: AbutmentItem | undefined,
  evaluator: AlignmentEvaluator,
  mats: BridgeMaterialSet,
  showPiles: boolean,
  isIntegralFrame: boolean = false
): void {
  const pt = evaluator(station);
  const fg = pt.position.y;
  const abutGroup = new THREE.Group();
  abutGroup.position.set(pt.position.x, 0, pt.position.z);
  abutGroup.rotation.y = pt.yawRad + skewRad;

  // 사각에 따른 횡방향 보정 폭
  const cosSkew = Math.max(0.5, Math.cos(skewRad));
  const stemWidthZ = bridgeWidth / cosSkew + 1.6;
  const seatTopY = fg - 0.34 - girderDepth; // 거더 하단 받침 높이
  const footingTopY = og + 1.8;
  const stemH = Math.max(3.0, seatTopY - footingTopY);
  const dir = isStart ? -1 : 1; // 교대 배면 성토 방향

  // 1. 확대/말뚝 기초판 (Footing Pad)
  const footGeo = new THREE.BoxGeometry(7.2, 1.8, stemWidthZ + 1.8);
  const foot = new THREE.Mesh(footGeo, mats.concreteDark);
  foot.position.set(dir * 2.0, og + 0.9, 0);
  foot.castShadow = true;
  foot.receiveShadow = true;
  abutGroup.add(foot);

  // 2. 교대 구체 (Stem Wall)
  const stemGeo = new THREE.BoxGeometry(3.4, stemH, stemWidthZ);
  const stem = new THREE.Mesh(stemGeo, mats.concrete);
  stem.position.set(dir * 1.4, footingTopY + stemH / 2, 0);
  stem.castShadow = true;
  stem.receiveShadow = true;
  abutGroup.add(stem);

  // 3. 배면 흉벽 (Backwall - 상판 끝단을 감싸 성토 접속)
  const backwallH = Math.max(1.2, fg - seatTopY + 0.2);
  const backwallGeo = new THREE.BoxGeometry(0.7, backwallH, stemWidthZ);
  const backwall = new THREE.Mesh(backwallGeo, mats.concrete);
  backwall.position.set(dir * 2.75, seatTopY + backwallH / 2, 0);
  backwall.castShadow = true;
  abutGroup.add(backwall);

  // 4. 교좌부 탄성/포트 받침 패드 (일체식 라멘/RC BOX는 받침 제외)
  if (!isIntegralFrame) {
    const padCount = bridgeWidth >= 20 ? 5 : 4;
    const padSpan = (bridgeWidth - 3.0) / Math.max(1, padCount - 1);
    const pedGeo = new THREE.BoxGeometry(1.0, 0.3, 1.0);
    for (let p = 0; p < padCount; p++) {
      const pz = ((p - (padCount - 1) / 2) * padSpan) / cosSkew;
      const ped = new THREE.Mesh(pedGeo, mats.bearing);
      ped.position.set(dir * 0.4, seatTopY + 0.15, pz);
      abutGroup.add(ped);
    }
  }

  // 5. 좌/우측 경사 날개벽 (Flared Wing Walls)
  const wingShape = new THREE.Shape();
  const wingLen = 5.5;
  const wingTopY = backwallH + stemH * 0.3;
  wingShape.moveTo(0, 0);
  wingShape.lineTo(wingLen, 0);
  wingShape.lineTo(wingLen, wingTopY * 0.25);
  wingShape.lineTo(0, wingTopY);
  wingShape.closePath();

  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.55,
    bevelEnabled: false
  });
  [-1, 1].forEach((side) => {
    const wing = new THREE.Mesh(wingGeo, mats.concrete);
    const baseZ = side * (stemWidthZ / 2 - 0.3);
    wing.position.set(dir * 2.7, seatTopY + backwallH - wingTopY, baseZ);
    // 교대 배면(isStart ? -X : +X)으로 나가면서 양쪽 바깥(+/- Z)으로 벌어지는 각도
    wing.rotation.y = isStart ? Math.PI + side * 0.35 : -side * 0.35;
    wing.castShadow = true;
    abutGroup.add(wing);
  });

  // 6. 강관말뚝 기초
  if (showPiles && abutmentItem?.foundation === 'PILE') {
    const pLen = abutmentItem.pile_len || 16;
    const pCount = Math.min(36, abutmentItem.pile_count || 40);
    const cols = 3;
    const rows = Math.ceil(pCount / cols);
    const colSpacing = 1.9;
    const rowSpacing = Math.min(3.0, ((stemWidthZ + 0.5) * 0.8) / Math.max(1, rows - 1));
    const pileGeo = new THREE.CylinderGeometry(0.254, 0.254, pLen, 10);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const pz = (r - (rows - 1) / 2) * rowSpacing;
        const px = dir * 2.0 + (c - (cols - 1) / 2) * colSpacing;
        const pile = new THREE.Mesh(pileGeo, mats.pile);
        pile.position.set(px, og - pLen / 2, pz);
        abutGroup.add(pile);
      }
    }
  }

  group.add(abutGroup);
}

/**
 * 고(高)LOD 교각(P1, P2...) 생성: T형 해머헤드 / Π형 문형 / 다주 라멘 / 중공사각 고교각 차별화 + 받침대 + 기초말뚝
 */
export function buildHighLodPier(
  group: THREE.Group,
  station: number,
  pier: PierItem,
  bridgeWidth: number,
  skewRad: number,
  girderDepth: number,
  og: number,
  evaluator: AlignmentEvaluator,
  mats: BridgeMaterialSet,
  showPiles: boolean
): void {
  const pt = evaluator(station);
  const fg = pt.position.y;
  const pierGroup = new THREE.Group();
  pierGroup.position.set(pt.position.x, 0, pt.position.z);
  pierGroup.rotation.y = pt.yawRad + skewRad;

  const cosSkew = Math.max(0.5, Math.cos(skewRad));
  const effectiveB = bridgeWidth / cosSkew;
  const diam = pier.diameter || 2.8;

  // 거더 하단 + 받침고(0.35m) 차감한 코핑 상단 표고
  const copingTopY = fg - 0.34 - girderDepth - 0.35;
  const footingTopY = og + 1.8;
  const copingDepth = 2.0;
  const colTopY = copingTopY - copingDepth;
  const colHeight = Math.max(2.5, colTopY - footingTopY);

  // 1. 교각 형식별 기둥 + 코핑(Hammerhead / Portal Cap)
  if (pier.type === 'PI_PIER') {
    // Π형 문형 교각: 2열 기둥 + 양단 돌출 경사 코핑
    const colZOffset = effectiveB * 0.28;
    const colGeo = new THREE.CylinderGeometry(diam * 0.42, diam * 0.48, colHeight, 12);
    [-colZOffset, colZOffset].forEach((cz) => {
      const col = new THREE.Mesh(colGeo, mats.pier);
      col.position.set(0, footingTopY + colHeight / 2, cz);
      col.castShadow = true;
      pierGroup.add(col);
    });
    const capGeo = new THREE.BoxGeometry(3.4, copingDepth, effectiveB - 0.8);
    const cap = new THREE.Mesh(capGeo, mats.pier);
    cap.position.set(0, copingTopY - copingDepth / 2, 0);
    cap.castShadow = true;
    pierGroup.add(cap);
  } else if (pier.type === 'MULTI_COLUMN') {
    // 다주 라멘 교각: 3~4열 원형 기둥 + 상부 캡빔 + 중간 지진 횡보
    const colCount = bridgeWidth >= 24 ? 4 : 3;
    const colSpan = (effectiveB - 4.0) / Math.max(1, colCount - 1);
    const colGeo = new THREE.CylinderGeometry(diam * 0.36, diam * 0.38, colHeight, 16);
    for (let i = 0; i < colCount; i++) {
      const cz = (i - (colCount - 1) / 2) * colSpan;
      const col = new THREE.Mesh(colGeo, mats.pier);
      col.position.set(0, footingTopY + colHeight / 2, cz);
      col.castShadow = true;
      pierGroup.add(col);
    }
    const capGeo = new THREE.BoxGeometry(2.8, copingDepth * 0.85, effectiveB - 0.8);
    const cap = new THREE.Mesh(capGeo, mats.pier);
    cap.position.set(0, copingTopY - (copingDepth * 0.85) / 2, 0);
    cap.castShadow = true;
    pierGroup.add(cap);

    if (colHeight > 12) {
      const strutGeo = new THREE.BoxGeometry(1.6, 1.3, colSpan * (colCount - 1));
      const strut = new THREE.Mesh(strutGeo, mats.pier);
      strut.position.set(0, footingTopY + colHeight * 0.48, 0);
      pierGroup.add(strut);
    }
  } else if (pier.type === 'HOLLOW_RECTANGULAR') {
    // 중공 사각 고교각: 면취 사각 테이퍼 벽체 + 깊은 경사 코핑
    const shaftW = effectiveB * 0.42;
    const shaftGeo = new THREE.BoxGeometry(diam * 1.35, colHeight, shaftW);
    const shaft = new THREE.Mesh(shaftGeo, mats.pier);
    shaft.position.set(0, footingTopY + colHeight / 2, 0);
    shaft.castShadow = true;
    pierGroup.add(shaft);

    const copingGeo = buildHammerheadCopingGeometry(effectiveB - 0.8, shaftW * 0.9, 3.8, copingDepth);
    const coping = new THREE.Mesh(copingGeo, mats.pier);
    coping.position.set(0, copingTopY, 0);
    coping.castShadow = true;
    pierGroup.add(coping);
  } else {
    // 표준 T형 교각 (T_PIER): 8각 면취 기둥 + 캔틸레버 경사 해머헤드 코핑
    const colGeo = new THREE.CylinderGeometry(diam * 0.48, diam * 0.56, colHeight, 8);
    if (bridgeWidth >= 24) {
      [-effectiveB * 0.24, effectiveB * 0.24].forEach((cz) => {
        const col = new THREE.Mesh(colGeo, mats.pier);
        col.position.set(0, footingTopY + colHeight / 2, cz);
        col.castShadow = true;
        pierGroup.add(col);
      });
    } else {
      const col = new THREE.Mesh(colGeo, mats.pier);
      col.position.set(0, footingTopY + colHeight / 2, 0);
      col.castShadow = true;
      pierGroup.add(col);
    }

    const copingGeo = buildHammerheadCopingGeometry(
      effectiveB - 0.8,
      Math.max(4.0, effectiveB * 0.35),
      3.8,
      copingDepth
    );
    const coping = new THREE.Mesh(copingGeo, mats.pier);
    coping.position.set(0, copingTopY, 0);
    coping.castShadow = true;
    pierGroup.add(coping);
  }

  // 2. 받침 콘크리트(Pedestal) & 탄성/포트 받침 블록 (편경사를 고려한 개별 표고 보정)
  const padCount = bridgeWidth >= 20 ? 5 : 4;
  const padSpan = (bridgeWidth - 3.2) / Math.max(1, padCount - 1);
  for (let p = 0; p < padCount; p++) {
    const pz = ((p - (padCount - 1) / 2) * padSpan) / cosSkew;
    const pedGeo = new THREE.BoxGeometry(1.1, 0.35, 1.1);
    const ped = new THREE.Mesh(pedGeo, mats.bearing);
    ped.position.set(0, copingTopY + 0.175, pz);
    pierGroup.add(ped);
  }

  // 3. 면취 확대/말뚝 기초판 (Footing + Upper Chamfer)
  const footW = diam * 2.7;
  const footLenZ = effectiveB * 0.88;
  const footLower = new THREE.Mesh(
    new THREE.BoxGeometry(footW, 1.4, footLenZ),
    mats.concreteDark
  );
  footLower.position.set(0, og + 0.7, 0);
  footLower.castShadow = true;
  footLower.receiveShadow = true;
  pierGroup.add(footLower);

  const footUpper = new THREE.Mesh(
    new THREE.BoxGeometry(footW * 0.82, 0.5, footLenZ * 0.85),
    mats.concreteDark
  );
  footUpper.position.set(0, og + 1.65, 0);
  pierGroup.add(footUpper);

  // 4. 강관말뚝 기초
  if (showPiles && pier.foundation === 'PILE') {
    const pLen = pier.pile_len || 16;
    const pCount = Math.min(36, pier.pile_count || 50);
    const cols = 3;
    const rows = Math.ceil(pCount / cols);
    const colSpacing = 2.0;
    const rowSpacing = Math.min(3.2, (footLenZ * 0.8) / Math.max(1, rows - 1));
    const pileGeo = new THREE.CylinderGeometry(0.254, 0.254, pLen, 10);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const pz = (r - (rows - 1) / 2) * rowSpacing;
        const px = (c - (cols - 1) / 2) * colSpacing;
        const pile = new THREE.Mesh(pileGeo, mats.pile);
        pile.position.set(px, og - pLen / 2, pz);
        pierGroup.add(pile);
      }
    }
  }

  group.add(pierGroup);
}

/**
 * 양측 날개부가 부드럽게 경사진 사다리꼴 해머헤드 코핑 지오메트리 (local y=0 이 상단)
 */
function buildHammerheadCopingGeometry(
  topWidthZ: number,
  botWidthZ: number,
  depthX: number,
  heightY: number
): THREE.BufferGeometry {
  const ht = topWidthZ / 2;
  const hb = Math.min(ht * 0.85, botWidthZ / 2);
  const shape = new THREE.Shape();
  shape.moveTo(-ht, 0);
  shape.lineTo(ht, 0);
  shape.lineTo(ht, -heightY * 0.35);
  shape.lineTo(hb, -heightY);
  shape.lineTo(-hb, -heightY);
  shape.lineTo(-ht, -heightY * 0.35);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depthX,
    bevelEnabled: false
  });
  // Extrude는 XY 평면에서 +Z로 돌출되므로 중심 정렬 후 Y축 90도 회전해 횡단 Z폭원 방향으로 배치
  geo.translate(0, 0, -depthX / 2);
  geo.rotateY(Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

export interface ApproachEarthworkParams {
  group: THREE.Group;
  totalBridgeLen: number;
  bridgeWidth: number;
  skewRad: number;
  evaluator: AlignmentEvaluator;
  getGroundY: (x: number, z: number) => number;
  terrainBounds: { xStart: number; xSpan: number; zSpan: number };
  mats: BridgeMaterialSet;
  wireframe: boolean;
}

/**
 * 단면 링(좌->우) 시퀀스를 삼각형 메쉬로 연결하는 토공·도로 표면 스트립 생성 헬퍼
 */
function buildPolyStripMesh(
  rings: THREE.Vector3[][],
  mat: THREE.Material,
  uvPair?: { repeatLen: number; stations: number[]; isLeftRightUV?: boolean }
): THREE.Mesh | null {
  if (rings.length < 2 || rings[0].length < 2) return null;
  const cols = rings[0].length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let r = 0; r < rings.length; r++) {
    for (let c = 0; c < cols; c++) {
      const p = rings[r][c];
      positions.push(p.x, p.y, p.z);
      if (uvPair) {
        const u = cols > 1 ? c / (cols - 1) : 0;
        const v = (uvPair.stations[r] ?? r) / uvPair.repeatLen;
        uvs.push(u, v);
      }
    }
  }

  for (let r = 0; r < rings.length - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const a = r * cols + c;
      const b = (r + 1) * cols + c;
      const d = (r + 1) * cols + (c + 1);
      const e = r * cols + (c + 1);
      indices.push(a, b, e, b, d, e);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  if (uvPair) {
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  }
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * 교대(A1·A2) 후방 고속도로 접속 토공(성토체/소단/원추사면/절토사면)·접속슬래브·노반·가드레일 모델 생성
 * - 선형(평면 R, 종단구배, 편경사)과 실측 DEM 지반고(getGroundY)에 100% 종속
 * - 교대 배면 사각(skewRad)에서 직각 도로 단면으로 24m 구간 내 매끄럽게 완화 접속
 */
export function buildApproachHighwayEarthwork({
  group,
  totalBridgeLen,
  bridgeWidth,
  skewRad,
  evaluator,
  getGroundY,
  terrainBounds,
  mats,
  wireframe
}: ApproachEarthworkParams): void {
  const B = Math.max(8, bridgeWidth);
  const halfB = B / 2;
  const curbInset = 0.55;
  const halfRoadW = halfB + 1.35;
  const clampedSkew = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, skewRad || 0));
  const skewTan = Math.tan(clampedSkew);

  const fillGrassMat = new THREE.MeshStandardMaterial({
    color: 0x4E7E44,
    roughness: 0.92,
    metalness: 0.02,
    side: THREE.DoubleSide,
    wireframe
  });
  const cutSoilMat = new THREE.MeshStandardMaterial({
    color: 0x8F7659,
    roughness: 0.95,
    metalness: 0.02,
    side: THREE.DoubleSide,
    wireframe
  });
  const shoulderMat = new THREE.MeshStandardMaterial({
    color: 0x64748B,
    roughness: 0.88,
    metalness: 0.06,
    side: THREE.DoubleSide,
    wireframe
  });
  const guardrailMat = new THREE.MeshStandardMaterial({
    color: 0xCBD5E1,
    roughness: 0.34,
    metalness: 0.72,
    wireframe
  });

  const { xStart, xSpan, zSpan } = terrainBounds;
  const xMin = xStart + 10;
  const xMax = xStart + xSpan - 10;
  const zMax = zSpan / 2 - 14;

  // A1 (dirSign = -1, sAbut = 0) 및 A2 (dirSign = +1, sAbut = totalBridgeLen) 양측 접속부 빌드
  const ends: Array<{ sAbut: number; dirSign: -1 | 1 }> = [
    { sAbut: 0, dirSign: -1 },
    { sAbut: totalBridgeLen, dirSign: 1 }
  ];

  ends.forEach(({ sAbut, dirSign }) => {
    // 1. 지형 경계 내 유효 접속 연장을 산정 (최대 132m)
    let approachLen = 0;
    for (let d = 4; d <= 132; d += 4) {
      const sample = evaluator(sAbut + dirSign * d);
      const px = sample.position.x;
      const pz = sample.position.z;
      if (px < xMin || px > xMax || Math.abs(pz) > zMax) break;
      approachLen = d;
    }
    if (approachLen < 12) return;

    const skewAtDist = (d: number) => skewTan * Math.max(0, 1 - d / 24);

    // 도로 표면 샘플 거리 목록 (0m, 2.8m 포함하여 교대 흉벽 후방 토공 시작점과 일치)
    const roadDists: number[] = [0, 2.8];
    for (let d = 6; d < approachLen; d += 4) {
      roadDists.push(d);
    }
    if (roadDists[roadDists.length - 1] < approachLen) {
      roadDists.push(approachLen);
    }

    const evalRoadEdge = (d: number, zLocal: number, yLocal: number): THREE.Vector3 => {
      const sk = skewAtDist(d);
      const st = sAbut + dirSign * d + zLocal * sk;
      const pt = evaluator(st);
      return pt.position
        .clone()
        .addScaledVector(pt.up, yLocal)
        .addScaledVector(pt.right, zLocal);
    };

    // 2. 아스팔트 본선 포장 & 차선 도색 리본
    const paveZLeft = -(halfB - curbInset);
    const paveZRight = halfB - curbInset;
    const paveRings: THREE.Vector3[][] = roadDists.map((d) => [
      evalRoadEdge(d, paveZLeft, 0.085),
      evalRoadEdge(d, paveZRight, 0.085)
    ]);
    const paveStations = roadDists.map((d) => sAbut + dirSign * d);
    const orderedPaveRings = dirSign < 0 ? [...paveRings].reverse() : paveRings;
    const orderedStations = dirSign < 0 ? [...paveStations].reverse() : paveStations;
    const paveMesh = buildPolyStripMesh(orderedPaveRings, mats.asphalt, {
      repeatLen: 14,
      stations: orderedStations
    });
    if (paveMesh) group.add(paveMesh);

    // 3. 접속슬래브 (Approach Concrete Transition Slab, 교대 배면 0 ~ 8m)
    const slabDists = [0, 2.8, 5.5, 8.0].filter((d) => d <= approachLen);
    if (slabDists.length >= 2) {
      const slabRings = slabDists.map((d) => [
        evalRoadEdge(d, -halfB, 0.03),
        evalRoadEdge(d, halfB, 0.03)
      ]);
      const slabMesh = buildPolyStripMesh(slabRings, mats.concrete);
      if (slabMesh) group.add(slabMesh);
    }

    // 4. 양측 길어깨 노반 (Shoulder + Subbase Edge)
    [-1, 1].forEach((side) => {
      const zPave = side * (halfB - curbInset);
      const zSh = side * halfRoadW;
      const shRings = roadDists.map((d) =>
        side > 0
          ? [evalRoadEdge(d, zPave, 0.04), evalRoadEdge(d, zSh, -0.24)]
          : [evalRoadEdge(d, zSh, -0.24), evalRoadEdge(d, zPave, 0.04)]
      );
      const shMesh = buildPolyStripMesh(shRings, shoulderMat);
      if (shMesh) group.add(shMesh);
    });

    // 5. 고속도로 가드레일(W-Beam + 지주) 및 중앙분리대
    [-1, 1].forEach((side) => {
      const zRail = side * (halfB - 0.24);
      const railTopPts: THREE.Vector3[] = [];
      const railBotPts: THREE.Vector3[] = [];
      roadDists.forEach((d) => {
        railTopPts.push(evalRoadEdge(d, zRail, 0.86));
        railBotPts.push(evalRoadEdge(d, zRail, 0.56));
      });
      const railRings = railTopPts.map((tp, idx) => [tp, railBotPts[idx]]);
      const railMesh = buildPolyStripMesh(railRings, guardrailMat);
      if (railMesh) group.add(railMesh);

      const postGeo = new THREE.BoxGeometry(0.11, 0.92, 0.11);
      for (let d = 2; d <= approachLen - 1; d += 4) {
        const sk = skewAtDist(d);
        const st = sAbut + dirSign * d + zRail * sk;
        const pt = evaluator(st);
        const post = new THREE.Mesh(postGeo, guardrailMat);
        post.position
          .copy(pt.position)
          .addScaledVector(pt.up, 0.42)
          .addScaledVector(pt.right, zRail);
        post.rotation.y = pt.yawRad;
        post.castShadow = true;
        group.add(post);
      }
    });

    if (B >= 18) {
      const medRings = roadDists.map((d) => [
        evalRoadEdge(d, -0.22, 0.92),
        evalRoadEdge(d, 0.22, 0.92)
      ]);
      const medSideL = roadDists.map((d) => [
        evalRoadEdge(d, -0.32, 0.05),
        evalRoadEdge(d, -0.22, 0.92)
      ]);
      const medSideR = roadDists.map((d) => [
        evalRoadEdge(d, 0.22, 0.92),
        evalRoadEdge(d, 0.32, 0.05)
      ]);
      [medRings, medSideL, medSideR].forEach((rings) => {
        const m = buildPolyStripMesh(rings, mats.concrete);
        if (m) group.add(m);
      });
    }

    // 6. 교대 흉벽 후방 지형 정합 토공 성토체(1:1.5 + 소단) / 절토체(측구 + 1:1.0) 모델
    const earthDists = roadDists.filter((d) => d >= 2.8);
    if (earthDists.length >= 2) {
      interface SlopeCrossInfo {
        shPt: THREE.Vector3;
        bermIn: THREE.Vector3;
        bermOut: THREE.Vector3;
        toePt: THREE.Vector3;
        isCut: boolean;
        outDir: THREE.Vector3;
        heightH: number;
      }

      const computeSideSlope = (d: number, side: -1 | 1): SlopeCrossInfo => {
        const sk = skewAtDist(d);
        const zSh = side * halfRoadW;
        const st = sAbut + dirSign * d + zSh * sk;
        const pt = evaluator(st);
        const shPt = pt.position
          .clone()
          .addScaledVector(pt.up, -0.24)
          .addScaledVector(pt.right, zSh);
        const outDir = pt.horizRight.clone().multiplyScalar(side).normalize();
        const gUnderShoulder = getGroundY(shPt.x, shPt.z);

        // 절토부 판별: 자연지반이 노반 어깨보다 0.35m 이상 높은 경우
        if (gUnderShoulder - shPt.y > 0.35) {
          const ditchIn = shPt.clone().addScaledVector(outDir, 0.6).add(new THREE.Vector3(0, -0.35, 0));
          const ditchOut = ditchIn.clone().addScaledVector(outDir, 0.9);
          let hCut = Math.max(0.8, gUnderShoulder - ditchOut.y + 0.5);
          let topCut = ditchOut.clone().addScaledVector(outDir, hCut * 1.0);
          for (let iter = 0; iter < 3; iter++) {
            const gTop = getGroundY(topCut.x, topCut.z) + 0.55;
            hCut = Math.max(0.8, gTop - ditchOut.y);
            topCut = ditchOut.clone().addScaledVector(outDir, hCut * 1.0);
            topCut.y = gTop;
          }
          return {
            shPt,
            bermIn: ditchIn,
            bermOut: ditchOut,
            toePt: topCut,
            isCut: true,
            outDir,
            heightH: hCut
          };
        }

        // 성토부: 1:1.5 표준 경사 (+ 성토고 6.5m 초과 시 1.5m 소단 삽입)
        let hFill = Math.max(0.8, shPt.y - gUnderShoulder + 0.65);
        let toePt = shPt.clone();
        for (let iter = 0; iter < 3; iter++) {
          const hasBerm = hFill > 6.5;
          const latOut = hFill * 1.5 + (hasBerm ? 1.5 : 0);
          const candidateXZ = shPt.clone().addScaledVector(outDir, latOut);
          const gToe = getGroundY(candidateXZ.x, candidateXZ.z) - 0.65;
          hFill = Math.max(0.8, shPt.y - gToe);
          toePt = new THREE.Vector3(candidateXZ.x, gToe, candidateXZ.z);
        }

        if (hFill > 6.5) {
          const upperDrop = 6.0;
          const bermIn = shPt
            .clone()
            .addScaledVector(outDir, upperDrop * 1.5)
            .add(new THREE.Vector3(0, -upperDrop, 0));
          const bermOut = bermIn.clone().addScaledVector(outDir, 1.5);
          return {
            shPt,
            bermIn,
            bermOut,
            toePt,
            isCut: false,
            outDir,
            heightH: hFill
          };
        }

        const mid = shPt.clone().lerp(toePt, 0.5);
        return {
          shPt,
          bermIn: mid,
          bermOut: mid.clone(),
          toePt,
          isCut: false,
          outDir,
          heightH: hFill
        };
      };

      [-1, 1].forEach((sideNum) => {
        const side = sideNum as -1 | 1;
        const infos = earthDists.map((d) => computeSideSlope(d, side));

        // 연속 성토/절토 구간 분할 없이 일관된 4-링 위상으로 사면·소단(측구) 구성
        const hasAnyCut = infos.some((inf) => inf.isCut);
        const upperSlopeRings = infos.map((inf) => [inf.shPt, inf.bermIn]);
        const benchRings = infos.map((inf) => [inf.bermIn, inf.bermOut]);
        const lowerSlopeRings = infos.map((inf) => [inf.bermOut, inf.toePt]);

        const upperMesh = buildPolyStripMesh(
          upperSlopeRings,
          hasAnyCut && infos[0].isCut ? shoulderMat : fillGrassMat
        );
        const benchMesh = buildPolyStripMesh(benchRings, mats.concreteDark);
        const lowerMesh = buildPolyStripMesh(
          lowerSlopeRings,
          hasAnyCut && infos[Math.floor(infos.length / 2)].isCut ? cutSoilMat : fillGrassMat
        );
        if (upperMesh) group.add(upperMesh);
        if (benchMesh) group.add(benchMesh);
        if (lowerMesh) group.add(lowerMesh);

        // 7. 교대 날개벽 외측 원추형 단부 성토 사면 (Conical Abutment End Slope)
        const startInfo = infos[0];
        if (!startInfo.isCut && startInfo.heightH > 1.2) {
          const sk0 = skewAtDist(earthDists[0]);
          const zSh = side * halfRoadW;
          const pt0 = evaluator(sAbut + dirSign * earthDists[0] + zSh * sk0);
          const forwardBridgeDir = pt0.horizTangent.clone().multiplyScalar(-dirSign).normalize();
          const coneRings: THREE.Vector3[][] = [];
          const latTotal = startInfo.toePt.clone().sub(startInfo.shPt);
          latTotal.y = 0;
          const latDist = latTotal.length();

          const coneSegs = 6;
          for (let k = 0; k <= coneSegs; k++) {
            const ang = (k / coneSegs) * (Math.PI * 0.42); // 0 -> ~75도 전방으로 감싸며 마감
            const radDir = startInfo.outDir
              .clone()
              .multiplyScalar(Math.cos(ang))
              .addScaledVector(forwardBridgeDir, Math.sin(ang))
              .normalize();
            const coneToeXZ = startInfo.shPt.clone().addScaledVector(radDir, latDist * 0.92);
            const gConeToe = getGroundY(coneToeXZ.x, coneToeXZ.z) - 0.65;
            const coneToe = new THREE.Vector3(coneToeXZ.x, gConeToe, coneToeXZ.z);
            coneRings.push([startInfo.shPt.clone(), coneToe]);
          }
          const coneMesh = buildPolyStripMesh(coneRings, fillGrassMat);
          if (coneMesh) group.add(coneMesh);
        }
      });

      // 8. 원거리 접속부 종점 마감 캡 (성토체 단부 수직 횡단 절개면 닫기)
      const lastD = earthDists[earthDists.length - 1];
      const endL = computeSideSlope(lastD, -1);
      const endR = computeSideSlope(lastD, 1);
      if (!endL.isCut && !endR.isCut) {
        const capRings: THREE.Vector3[][] = [
          [endL.toePt, endR.toePt],
          [endL.shPt, endR.shPt]
        ];
        const capMesh = buildPolyStripMesh(capRings, fillGrassMat);
        if (capMesh) group.add(capMesh);
      }
    }
  });
}
