// src/domain/engine/alignment_3d.ts
import * as THREE from 'three';
import { AlignmentParameters } from '../models/bridge';
import { DEFAULT_ALIGNMENT } from './terrain_alignment_calculator';

export interface AlignmentSample {
  station: number; // 교량 시점(A1) 기준 곡선 호 길이 s (0 ~ L)
  position: THREE.Vector3; // 도로 선형 중심 상판 기준 3D 좌표
  tangent: THREE.Vector3; // 3D 단위 접선 벡터 (+X 진행 방향)
  right: THREE.Vector3; // 3D 단위 우측 횡단 벡터 (+Z 폭원 방향, 편경사 포함)
  up: THREE.Vector3; // 3D 단위 상판 법선 벡터 (+Y)
  horizTangent: THREE.Vector3; // 수평 투영 접선 벡터
  horizRight: THREE.Vector3; // 수평 투영 우측 벡터
  yawRad: number; // Three.js group.rotation.y (수직 하부구조물 회전각)
  pitchRad: number; // 종단경사각 (rad)
  superelevationRad: number; // 곡선부 편경사각 (rad)
}

export type AlignmentEvaluator = (station: number) => AlignmentSample;

/**
 * 교량 평면선형(R) 및 종단선형(FG0, g%) 기반의 3D 정밀 측점(Station) 평가기 생성
 * - 곡선 호 길이(Arc Length s) 기준으로 중점(s = L/2)이 (L/2, y, 0)에 위치하도록 정합
 * - 곡선부 반경에 따른 자연스러운 편경사(Superelevation) 완화 적용
 */
export function createAlignmentEvaluator(
  totalLength: number,
  alignment: AlignmentParameters = DEFAULT_ALIGNMENT,
  verticalLift: number = 0
): AlignmentEvaluator {
  const L = Math.max(10, totalLength);
  const slopeRatio = (alignment.longitudinal_slope || 0) / 100;
  const pitchRad = Math.atan(slopeRatio);
  const rawR = alignment.curve_radius || 0;

  // 과도하게 작은 반경 입력 시 교량 전체 중심각이 160°를 넘지 않도록 물리적 한계 보정
  const minSafeR = Math.max(30, L / (Math.PI * 0.88));
  const absR = rawR !== 0 ? Math.max(minSafeR, Math.abs(rawR)) : 0;
  const curveSign = rawR < 0 ? -1 : 1; // +1: +Z 방향 곡선, -1: -Z 방향 곡선

  // 곡선반경 R에 따른 공학적 최대 편경사 (최대 6%, 시·종점 15% 구간 선형 완화)
  const maxBankRad = absR > 0 ? Math.min(0.06, 45 / absR) * curveSign : 0;

  return (station: number): AlignmentSample => {
    const s = station; // 사각 단부(z * tan(skew)) 확장을 위해 0~L 외부 측점도 연속 평가
    const ds = s - L / 2;
    const y = (alignment.start_elevation ?? DEFAULT_ALIGNMENT.start_elevation) + verticalLift + s * slopeRatio;

    let x = s;
    let z = 0;
    let tx = 1;
    let tz = 0;

    if (absR > 0) {
      const phi = (ds / absR) * curveSign;
      x = L / 2 + absR * Math.sin(phi) * curveSign;
      z = absR * (1 - Math.cos(phi)) * curveSign;
      tx = Math.cos(phi);
      tz = Math.sin(phi);
    }

    const horizTangent = new THREE.Vector3(tx, 0, tz).normalize();
    // (+X) x (+Y) = (+Z) 이므로, (tx, 0, tz) x (0, 1, 0) = (-tz, 0, tx)
    const horizRight = new THREE.Vector3(-horizTangent.z, 0, horizTangent.x).normalize();

    const tangent = new THREE.Vector3(
      horizTangent.x,
      slopeRatio,
      horizTangent.z
    ).normalize();

    // 시·종점 완화구간 (0~15%, 85~100%) 편경사 보간
    const u = Math.max(0, Math.min(1, s / L));
    const rampFactor =
      u < 0.15 ? u / 0.15 : u > 0.85 ? (1 - u) / 0.15 : 1.0;
    const bankRad = maxBankRad * rampFactor;

    // 횡단 우측 벡터: 수평 우측 + 편경사에 의한 상하 기울기
    const upFlat = new THREE.Vector3().crossVectors(horizRight, tangent).normalize();
    const right = horizRight
      .clone()
      .multiplyScalar(Math.cos(bankRad))
      .addScaledVector(upFlat, -Math.sin(bankRad))
      .normalize();
    const up = new THREE.Vector3().crossVectors(right, tangent).normalize();

    // Three.js rotation.y = theta 일 때 local +X -> (cos theta, 0, -sin theta)
    // horizTangent = (tx, 0, tz) 일치 조건: theta = -atan2(tz, tx)
    const yawRad = -Math.atan2(horizTangent.z, horizTangent.x);

    return {
      station: s,
      position: new THREE.Vector3(x, y, z),
      tangent,
      right,
      up,
      horizTangent,
      horizRight,
      yawRad,
      pitchRad,
      superelevationRad: bankRad
    };
  };
}

/**
 * 2D 단면 폴리곤 [yLocal, zLocal]의 부호 있는 면적을 계산하고 외향 법선이 나오도록 시계/반시계 정렬
 * 목표: (+y,+z) -> (+y,-z) -> (-y,-z) -> (-y,+z) 방향 (signedArea < 0 in (z, y) = CCW in (z, y)?)
 */
function ensureOutwardProfileWinding(points: Array<[number, number]>): Array<[number, number]> {
  if (points.length < 3) return points;
  // Shoelace formula in (x2d = z, y2d = y) plane:
  // For square (+1,+1)->(+1,-1)->(-1,-1)->(-1,+1) in [y, z]:
  // (z, y) = (1,1) -> (-1,1) -> (-1,-1) -> (1,-1): CCW -> shoelace area > 0
  let area2 = 0;
  for (let i = 0; i < points.length; i++) {
    const [y0, z0] = points[i];
    const [y1, z1] = points[(i + 1) % points.length];
    area2 += z0 * y1 - z1 * y0;
  }
  return area2 < 0 ? [...points].reverse() : points;
}

export interface SweptProfileOptions {
  offsetY?: number;
  offsetZ?: number;
  skewTan?: number; // tan(skewRad): 상부구조 단면·거더 시종점을 사각에 맞춰 종방향 시프트
  depthScaleFn?: (station: number) => number; // y < pivotY 인 하단 좌표를 스케일 (변단면 헌치 구현)
  pivotY?: number;
  closedCaps?: boolean;
  uvLengthScale?: number;
}

/**
 * 3D 도로 선형 프레임(Tangent, Right, Up)을 따라 2D 구조 단면 [y, z]를 연속 스위핑하여
 * 곡선·종단경사·편경사·사각(Skew)·변단면(Haunch)을 100% 반영한 고품질 BIM BufferGeometry 생성
 */
export function createSweptProfileGeometry(
  rawProfileYZ: Array<[number, number]>,
  stations: number[],
  evaluator: AlignmentEvaluator,
  options: SweptProfileOptions = {}
): THREE.BufferGeometry {
  const {
    offsetY = 0,
    offsetZ = 0,
    skewTan = 0,
    depthScaleFn,
    pivotY = 0,
    closedCaps = true,
    uvLengthScale = 10
  } = options;

  const profile = ensureOutwardProfileWinding(rawProfileYZ);
  const nPts = profile.length;
  const nStations = stations.length;

  const positions: number[] = [];
  const uvs: number[] = [];

  if (nPts < 3 || nStations < 2) {
    return new THREE.BufferGeometry();
  }

  const hasSkew = Math.abs(skewTan) > 1e-6;
  const rings: THREE.Vector3[][] = stations.map((baseStation) => {
    const baseSample = hasSkew ? null : evaluator(baseStation);
    return profile.map(([py, pz]) => {
      const lz = pz + offsetZ;
      const effStation = hasSkew ? baseStation + lz * skewTan : baseStation;
      const sample = baseSample ?? evaluator(effStation);
      const dScale = depthScaleFn ? depthScaleFn(effStation) : 1.0;
      const yScaled = py < pivotY ? pivotY + (py - pivotY) * dScale : py;
      const ly = yScaled + offsetY;
      return sample.position
        .clone()
        .addScaledVector(sample.up, ly)
        .addScaledVector(sample.right, lz);
    });
  });

  // 측면 쿼드 생성 (엣지별로 정점을 분리해 각진 콘크리트/강재 모서리를 날카롭게 표현)
  const s0Station = stations[0];
  for (let i = 0; i < nPts; i++) {
    const nextI = (i + 1) % nPts;
    const v0Coord = i / nPts;
    const v1Coord = (i + 1) / nPts;

    for (let k = 0; k < nStations - 1; k++) {
      const p00 = rings[k][i];
      const p10 = rings[k + 1][i];
      const p11 = rings[k + 1][nextI];
      const p01 = rings[k][nextI];

      const u0 = (stations[k] - s0Station) / uvLengthScale;
      const u1 = (stations[k + 1] - s0Station) / uvLengthScale;

      // CCW Triangle 1: (p00, p10, p01), Triangle 2: (p10, p11, p01)
      positions.push(
        p00.x, p00.y, p00.z,
        p10.x, p10.y, p10.z,
        p01.x, p01.y, p01.z,
        p10.x, p10.y, p10.z,
        p11.x, p11.y, p11.z,
        p01.x, p01.y, p01.z
      );

      uvs.push(
        u0, v0Coord,
        u1, v0Coord,
        u0, v1Coord,
        u1, v0Coord,
        u1, v1Coord,
        u0, v1Coord
      );
    }
  }

  // 시점/종점 마구리 단면 캡 생성 (Three.js ShapeUtils 삼각분할 활용)
  if (closedCaps) {
    const contour2D = profile.map(([py, pz]) => new THREE.Vector2(pz, py));
    const tris = THREE.ShapeUtils.triangulateShape(contour2D, []);

    // Start cap (k = 0, ShapeUtils 삼각분할 (z, y) CCW의 법선은 (+Z)x(+Y) = -X = -tangent 방향)
    const startRing = rings[0];
    tris.forEach(([a, b, c]) => {
      const va = startRing[a];
      const vb = startRing[b];
      const vc = startRing[c];
      positions.push(va.x, va.y, va.z, vb.x, vb.y, vb.z, vc.x, vc.y, vc.z);
      uvs.push(0, 0, 1, 0, 0, 1);
    });

    // End cap (k = last, 법선은 +tangent 방향 -> 정점 역순)
    const endRing = rings[nStations - 1];
    tris.forEach(([a, b, c]) => {
      const va = endRing[a];
      const vb = endRing[b];
      const vc = endRing[c];
      positions.push(va.x, va.y, va.z, vc.x, vc.y, vc.z, vb.x, vb.y, vb.z);
      uvs.push(0, 0, 0, 1, 1, 0);
    });
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * 선형을 따라 아스팔트 포장면 등 도로 횡단 리본 지오메트리 생성 (차선 UV 및 사각 단부 정합 지원)
 */
export function createSweptRibbonGeometry(
  zLeft: number,
  zRight: number,
  yOffset: number,
  stations: number[],
  evaluator: AlignmentEvaluator,
  repeatLengthMeters: number = 14,
  skewTan: number = 0
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  if (stations.length < 2) return new THREE.BufferGeometry();

  const hasSkew = Math.abs(skewTan) > 1e-6;
  const s0 = stations[0];

  const corners = stations.map((st) => {
    const sL = hasSkew ? st + zLeft * skewTan : st;
    const sR = hasSkew ? st + zRight * skewTan : st;
    const sampleL = evaluator(sL);
    const sampleR = hasSkew ? evaluator(sR) : sampleL;
    return {
      station: st,
      ptL: sampleL.position.clone().addScaledVector(sampleL.up, yOffset).addScaledVector(sampleL.right, zLeft),
      ptR: sampleR.position.clone().addScaledVector(sampleR.up, yOffset).addScaledVector(sampleR.right, zRight)
    };
  });

  for (let k = 0; k < corners.length - 1; k++) {
    const a = corners[k];
    const b = corners[k + 1];

    const v0 = (a.station - s0) / repeatLengthMeters;
    const v1 = (b.station - s0) / repeatLengthMeters;

    // (+tangent) x (-Z) = +Y 이므로 (aR, bR, aL) / (bR, bL, aL) -> 법선 +Up
    positions.push(
      a.ptR.x, a.ptR.y, a.ptR.z,
      b.ptR.x, b.ptR.y, b.ptR.z,
      a.ptL.x, a.ptL.y, a.ptL.z,
      b.ptR.x, b.ptR.y, b.ptR.z,
      b.ptL.x, b.ptL.y, b.ptL.z,
      a.ptL.x, a.ptL.y, a.ptL.z
    );

    uvs.push(
      1, v0,
      1, v1,
      0, v0,
      1, v1,
      0, v1,
      0, v0
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  return geo;
}

/**
 * 시작 측점 ~ 종료 측점 사이의 등간격 샘플 배열 생성 헬퍼
 */
export function generateStationSamples(startS: number, endS: number, stepMeters: number = 4): number[] {
  const len = Math.max(0.5, endS - startS);
  const count = Math.max(2, Math.ceil(len / stepMeters));
  const list: number[] = [];
  for (let i = 0; i <= count; i++) {
    list.push(startS + (len * i) / count);
  }
  return list;
}
