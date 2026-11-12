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

/**
 * 상부형식 카테고리 판별
 */
function classifySuperstructure(type: SuperstructureType):
  | 'ARCH'
  | 'CABLE_STAYED'
  | 'EXTRADOSED'
  | 'PSC_BOX'
  | 'STEEL_BOX'
  | 'STEEL_PLATE'
  | 'RAHMEN'
  | 'PSC_GIRDER' {
  if (type === 'STEEL_ARCH') return 'ARCH';
  if (type === 'CABLE_STAYED') return 'CABLE_STAYED';
  if (type === 'EXTRADOSED') return 'EXTRADOSED';
  if (type.startsWith('PSC_BOX')) return 'PSC_BOX';
  if (type.startsWith('STEEL_BOX')) return 'STEEL_BOX';
  if (type === 'STEEL_PLATE' || type === 'RATIONALIZED_PLATE') return 'STEEL_PLATE';
  if (type.startsWith('RC_')) return 'RAHMEN';
  return 'PSC_GIRDER';
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

/**
 * 교각 위치에서의 상판/거더 하단까지의 총 구조고 계산 (하부공 받침부 정합용)
 */
export function getGirderStructuralDepth(type: SuperstructureType, maxSpanLen: number): number {
  const cat = classifySuperstructure(type);
  if (cat === 'PSC_BOX') return Math.max(2.3, Math.min(4.2, maxSpanLen * 0.042));
  if (cat === 'STEEL_BOX') return Math.max(2.2, Math.min(3.8, maxSpanLen * 0.038));
  if (cat === 'STEEL_PLATE') return Math.max(1.9, Math.min(3.2, maxSpanLen * 0.04));
  if (cat === 'RAHMEN') return 1.35;
  if (cat === 'CABLE_STAYED' || cat === 'EXTRADOSED') return 2.4;
  return Math.max(1.8, Math.min(2.8, maxSpanLen * 0.048));
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
  showPiles: boolean
): void {
  void showPiles;
  const B = Math.max(8, bridgeWidth);
  const halfB = B / 2;
  const fullStations = generateStationSamples(0, totalLength, 3.5);

  const slabThick = 0.34;
  const overhangDrop = 0.18;
  const cantileverStartZ = halfB * 0.72;

  // 1. 캔틸레버 헌치 바닥판 (Deck Slab with sloped overhangs)
  const deckProfile: Array<[number, number]> = [
    [0.05, halfB],
    [0.05, -halfB],
    [-overhangDrop, -halfB],
    [-slabThick, -cantileverStartZ],
    [-slabThick, cantileverStartZ],
    [-overhangDrop, halfB]
  ];
  const deckMesh = new THREE.Mesh(
    createSweptProfileGeometry(deckProfile, fullStations, evaluator, { uvLengthScale: 8 }),
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
    14
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
      offsetZ: halfB - 0.22
    }),
    mats.concrete
  );
  barrierRight.castShadow = true;
  group.add(barrierRight);

  const barrierLeftProfile: Array<[number, number]> = barrierProfile.map(([y, z]) => [y, -z]);
  const barrierLeft = new THREE.Mesh(
    createSweptProfileGeometry(barrierLeftProfile, fullStations, evaluator, {
      offsetZ: -(halfB - 0.22)
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
      createSweptProfileGeometry(medianProfile, fullStations, evaluator),
      mats.concrete
    );
    medianMesh.castShadow = true;
    group.add(medianMesh);
  }

  // 4. 시·종점 신축이음장치 (Expansion Joints)
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
      evaluator
    );
    const jointMesh = new THREE.Mesh(jointGeo, mats.concreteDark);
    group.add(jointMesh);
  });

  // 5. 교량 가로등 (약 35m 간격, 선형 곡선 좌우 방호벽 상단 배치)
  const poleCount = Math.max(2, Math.floor(totalLength / 36));
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.12, 6.2, 8);
  const armGeo = new THREE.BoxGeometry(0.09, 0.09, 2.2);
  const lampHeadGeo = new THREE.BoxGeometry(0.35, 0.14, 0.8);

  for (let p = 0; p <= poleCount; p++) {
    const sPole = 8 + ((totalLength - 16) * p) / Math.max(1, poleCount);
    if (sPole <= 1 || sPole >= totalLength - 1) continue;
    const sample = evaluator(sPole);
    [-1, 1].forEach((side) => {
      // 양쪽 교대 배치 혹은 4차로 이상 양측 대칭
      if (B < 18 && (p + (side > 0 ? 1 : 0)) % 2 !== 0) return;

      const poleGroup = new THREE.Group();
      const basePos = sample.position
        .clone()
        .addScaledVector(sample.up, 1.1)
        .addScaledVector(sample.right, side * (halfB - 0.2));
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

    if (cat === 'PSC_BOX') {
      // 단일 혹은 2셀 광폭 콘크리트 박스거더 + FCM 포물선 변단면 헌치
      const isHaunched = sp.type === 'PSC_BOX_FCM' || spanLen >= 75;
      const boxTopW = Math.min(B * 0.72, 13.5);
      const boxBotW = boxTopW * 0.62;
      const baseDepth = isHaunched ? girderDepth * 0.72 : girderDepth;
      const boxProfile = buildTrapezoidBoxProfile(boxTopW, boxBotW, baseDepth, girderTopY);

      const boxGeo = createSweptProfileGeometry(boxProfile, spanStations, evaluator, {
        pivotY: girderTopY,
        depthScaleFn: isHaunched
          ? (s) => {
              const u = (s - startS) / Math.max(1, spanLen); // 0 ~ 1
              const edgeFactor = Math.pow(Math.abs(u - 0.5) * 2, 2); // 0 (중앙) ~ 1 (지점)
              return 0.9 + edgeFactor * 0.75; // 지점부 1.65배 헌치
            }
          : undefined
      });
      const boxMesh = new THREE.Mesh(boxGeo, mats.concrete);
      boxMesh.castShadow = true;
      boxMesh.receiveShadow = true;
      group.add(boxMesh);
    } else if (cat === 'STEEL_BOX') {
      // 다실(2~3열) 사다리꼴 강박스 거더 + 연속교 변단면 + 횡방향 격벽 프레임
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
          depthScaleFn: isContinuous && spanLen >= 55
            ? (s) => {
                const u = (s - startS) / Math.max(1, spanLen);
                const endProximity = Math.pow(Math.abs(u - 0.5) * 2, 2);
                return 0.88 + endProximity * 0.35;
              }
            : undefined
        });
        const boxMesh = new THREE.Mesh(boxGeo, mats.steelBox);
        boxMesh.castShadow = true;
        group.add(boxMesh);
      }

      // 강박스 횡방향 가로보 (Cross-Frames) 12m 간격
      if (boxCount >= 2) {
        const cfCount = Math.max(2, Math.round(spanLen / 14));
        const cfGeo = new THREE.BoxGeometry(0.35, girderDepth * 0.6, spacing * (boxCount - 1));
        for (let c = 1; c < cfCount; c++) {
          const sCF = startS + (spanLen * c) / cfCount;
          const pt = evaluator(sCF);
          const cf = new THREE.Mesh(cfGeo, mats.steelLight);
          cf.position
            .copy(pt.position)
            .addScaledVector(pt.up, girderTopY - girderDepth * 0.48);
          cf.setRotationFromMatrix(new THREE.Matrix4().makeBasis(pt.tangent, pt.up, pt.right));
          group.add(cf);
        }
      }
    } else if (cat === 'STEEL_PLATE') {
      // 용접 플레이트 I형 강거더 + 횡방향 브레이싱
      const gCount = B >= 22 ? 5 : 4;
      const spacing = (B - 4.0) / Math.max(1, gCount - 1);
      const plateProfile = buildIProfile(0.55, 0.62, 0.14, girderDepth, girderTopY);

      for (let g = 0; g < gCount; g++) {
        const zOff = (g - (gCount - 1) / 2) * spacing;
        const gMesh = new THREE.Mesh(
          createSweptProfileGeometry(plateProfile, spanStations, evaluator, { offsetZ: zOff }),
          mats.steelBox
        );
        gMesh.castShadow = true;
        group.add(gMesh);
      }

      const braceCount = Math.max(3, Math.round(spanLen / 10));
      const braceGeo = new THREE.BoxGeometry(0.18, girderDepth * 0.55, spacing * (gCount - 1));
      for (let b = 1; b < braceCount; b++) {
        const sBr = startS + (spanLen * b) / braceCount;
        const pt = evaluator(sBr);
        const br = new THREE.Mesh(braceGeo, mats.steelLight);
        br.position.copy(pt.position).addScaledVector(pt.up, girderTopY - girderDepth * 0.5);
        br.setRotationFromMatrix(new THREE.Matrix4().makeBasis(pt.tangent, pt.up, pt.right));
        group.add(br);
      }
    } else if (cat === 'RAHMEN') {
      // 라멘교: 단부 헌치가 부드럽게 깊어지는 일체식 슬래브형 거더
      const rahmenProfile = buildTrapezoidBoxProfile(B * 0.88, B * 0.82, 1.0, girderTopY);
      const rGeo = createSweptProfileGeometry(rahmenProfile, spanStations, evaluator, {
        pivotY: girderTopY,
        depthScaleFn: (s) => {
          const u = (s - startS) / Math.max(1, spanLen);
          const haunch = Math.pow(Math.abs(u - 0.5) * 2, 3);
          return 1.0 + haunch * 0.8;
        }
      });
      const rMesh = new THREE.Mesh(rGeo, mats.concrete);
      rMesh.castShadow = true;
      group.add(rMesh);
    } else if (cat === 'ARCH') {
      // 보강 강박스 거더 + 양측 대칭 강아치 리브 + 수직 행어 케이블 + 상부 풍구 횡브레이싱
      const edgeBoxProfile = buildTrapezoidBoxProfile(1.8, 1.5, 2.0, girderTopY);
      [-halfB + 1.1, halfB - 1.1].forEach((zEdge) => {
        const edgeMesh = new THREE.Mesh(
          createSweptProfileGeometry(edgeBoxProfile, spanStations, evaluator, { offsetZ: zEdge }),
          mats.steelBox
        );
        edgeMesh.castShadow = true;
        group.add(edgeMesh);
      });

      const archRise = Math.min(34, Math.max(14, spanLen * 0.22));
      const archSamples = 32;
      const ribZOffsets = [-(halfB - 0.8), halfB - 0.8];
      const ribPointsLeftRight: THREE.Vector3[][] = [[], []];

      ribZOffsets.forEach((zOff, ribIdx) => {
        for (let k = 0; k <= archSamples; k++) {
          const u = k / archSamples;
          const s = startS + 1.5 + (spanLen - 3.0) * u;
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

      // 수직 행어 케이블 & 상부 횡방향 Strut 브레이싱
      for (let k = 3; k < archSamples - 2; k += 2) {
        const u = k / archSamples;
        const s = startS + 1.5 + (spanLen - 3.0) * u;
        const sample = evaluator(s);
        const hArch = 4 * archRise * u * (1 - u);

        ribZOffsets.forEach((zOff) => {
          if (hArch < 2.5) return;
          const topPt = sample.position.clone().addScaledVector(sample.up, hArch).addScaledVector(sample.right, zOff);
          const botPt = sample.position.clone().addScaledVector(sample.up, 0.2).addScaledVector(sample.right, zOff);
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

        // 아치 리브 상부 풍구 횡브레이싱
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
    } else if (cat === 'CABLE_STAYED' || cat === 'EXTRADOSED') {
      // 사장교/엑스트라도즈드교 에지 유선형 박스 거더
      const deckBoxProfile = buildTrapezoidBoxProfile(B * 0.92, B * 0.65, 2.2, girderTopY);
      const boxMesh = new THREE.Mesh(
        createSweptProfileGeometry(deckBoxProfile, spanStations, evaluator),
        mats.concrete
      );
      boxMesh.castShadow = true;
      group.add(boxMesh);
    } else {
      // 표준 PSC I형 / Bulb-T 거더 + 횡방향 격벽(가로보)
      const gCount = B >= 22 ? 6 : B >= 16 ? 5 : 4;
      const gSpacing = (B - 3.2) / Math.max(1, gCount - 1);
      const iProfile = buildIProfile(0.85, 0.72, 0.24, girderDepth, girderTopY);

      for (let g = 0; g < gCount; g++) {
        const zOff = (g - (gCount - 1) / 2) * gSpacing;
        const gMesh = new THREE.Mesh(
          createSweptProfileGeometry(iProfile, spanStations, evaluator, { offsetZ: zOff }),
          mats.concrete
        );
        gMesh.castShadow = true;
        group.add(gMesh);
      }

      // 횡방향 콘크리트 가로보 (Diaphragms: 양단 + 1/3, 2/3 지점)
      const diaFractions = spanLen >= 35 ? [0.03, 0.33, 0.67, 0.97] : [0.03, 0.5, 0.97];
      const diaGeo = new THREE.BoxGeometry(0.42, girderDepth * 0.72, gSpacing * (gCount - 1));
      diaFractions.forEach((f) => {
        const sDia = startS + spanLen * f;
        const pt = evaluator(sDia);
        const dia = new THREE.Mesh(diaGeo, mats.concreteDark);
        dia.position
          .copy(pt.position)
          .addScaledVector(pt.up, girderTopY - girderDepth * 0.48);
        dia.setRotationFromMatrix(new THREE.Matrix4().makeBasis(pt.tangent, pt.up, pt.right));
        group.add(dia);
      });
    }

    cumS = endS;
  });

  // 7. 사장교 / 엑스트라도즈드교 주탑(Pylon) 및 Fan Stay Cables 생성 (중간 교각 위치 기준)
  const hasCableStays = spans.some(
    (s) => s.type === 'CABLE_STAYED' || s.type === 'EXTRADOSED'
  );
  if (hasCableStays && pierStations.length > 0) {
    const isFullCable = spans.some((s) => s.type === 'CABLE_STAYED');
    const maxSpan = Math.max(...spans.map((s) => s.span_length));
    const towerAboveDeck = isFullCable
      ? Math.max(28, Math.min(72, maxSpan * 0.34))
      : Math.max(16, Math.min(34, maxSpan * 0.18));

    // 주탑 위치 선정 (중앙부 주요 교각 혹은 전체 중간 교각 중 1~2개소)
    const pylonIndices =
      pierStations.length <= 2
        ? pierStations.map((_, i) => i)
        : [Math.floor((pierStations.length - 1) / 2), Math.ceil((pierStations.length - 1) / 2)];
    const uniquePylonStations = Array.from(new Set(pylonIndices.map((idx) => pierStations[idx])));

    uniquePylonStations.forEach((sPylon) => {
      const sample = evaluator(sPylon);
      const pylonGroup = new THREE.Group();
      pylonGroup.position.copy(sample.position);
      pylonGroup.rotation.y = sample.yawRad;

      // H형 주탑 좌우 레그 + 상·중부 가로보
      const legGeo = new THREE.BoxGeometry(2.6, towerAboveDeck, 1.8);
      const legHalfZ = halfB + 0.4;
      [-legHalfZ, legHalfZ].forEach((lz) => {
        const leg = new THREE.Mesh(legGeo, mats.concrete);
        leg.position.set(0, towerAboveDeck / 2 - 2.0, lz);
        leg.castShadow = true;
        pylonGroup.add(leg);
      });

      const beamGeo = new THREE.BoxGeometry(2.2, 2.4, legHalfZ * 2);
      const upperBeam = new THREE.Mesh(beamGeo, mats.concrete);
      upperBeam.position.set(0, towerAboveDeck - 5.5, 0);
      pylonGroup.add(upperBeam);

      if (isFullCable) {
        const midBeam = new THREE.Mesh(beamGeo, mats.concrete);
        midBeam.position.set(0, towerAboveDeck * 0.52, 0);
        pylonGroup.add(midBeam);
      }

      group.add(pylonGroup);

      // Fan Stay Cables (양쪽 주탑 상부에서 전·후방 상판 가장자리로 사선 정착)
      const cableCountPerSide = isFullCable ? 7 : 5;
      const reachLength = Math.min(totalLength * 0.45, maxSpan * 0.85);
      for (let c = 1; c <= cableCountPerSide; c++) {
        const frac = c / (cableCountPerSide + 0.5);
        const anchorOffsetY = towerAboveDeck - 3.5 - c * (isFullCable ? 1.8 : 1.1);

        [-1, 1].forEach((dirSign) => {
          const sAnchor = sPylon + dirSign * reachLength * frac;
          if (sAnchor <= 2 || sAnchor >= totalLength - 2) return;
          const anchorSample = evaluator(sAnchor);

          [-1, 1].forEach((zSign) => {
            const towerTopWorld = sample.position
              .clone()
              .add(new THREE.Vector3(0, anchorOffsetY, 0))
              .addScaledVector(sample.horizRight, zSign * legHalfZ);
            const deckAnchorWorld = anchorSample.position
              .clone()
              .addScaledVector(anchorSample.up, 0.35)
              .addScaledVector(anchorSample.right, zSign * (halfB - 0.1));

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
  showPiles: boolean
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

  // 4. 교좌부 탄성/포트 받침 패드
  const padCount = bridgeWidth >= 20 ? 5 : 4;
  const padSpan = (bridgeWidth - 3.0) / Math.max(1, padCount - 1);
  const pedGeo = new THREE.BoxGeometry(1.0, 0.3, 1.0);
  for (let p = 0; p < padCount; p++) {
    const pz = ((p - (padCount - 1) / 2) * padSpan) / cosSkew;
    const ped = new THREE.Mesh(pedGeo, mats.bearing);
    ped.position.set(dir * 0.4, seatTopY + 0.15, pz);
    abutGroup.add(ped);
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
