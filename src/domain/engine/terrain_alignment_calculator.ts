// src/domain/engine/terrain_alignment_calculator.ts
import { TerrainParameters, AlignmentParameters } from '../models/bridge';

export const DEFAULT_TERRAIN: TerrainParameters = {
  type: 'RIVER_CROSSING',
  valley_depth: 18, // m (계곡/하천 바닥 심도)
  water_level: 2.5, // m (하천 수위)
  river_width: 80, // m (하천 폭원)
  bearing_stratum_depth: 15 // m (지지층 심도 -> 말뚝 소요 길이)
};

export const DEFAULT_ALIGNMENT: AlignmentParameters = {
  curve_radius: 0, // 0: 직선, >0: 곡선 반경 (m)
  longitudinal_slope: 0.5, // % (완만한 오르막 경사)
  start_elevation: 25.0 // m (시점 교대 계획고 FG0)
};

/**
 * 교축 방향 위치 x(0 ~ L)에서의 계획고 (Formation Ground Level) 계산
 */
export function calculateFormationGround(x: number, alignment: AlignmentParameters = DEFAULT_ALIGNMENT): number {
  const slopeRatio = alignment.longitudinal_slope / 100;
  return alignment.start_elevation + x * slopeRatio;
}

/**
 * 교축 방향 위치 x(0 ~ L)에서의 지반고 (Original Ground Level) 계산
 */
export function calculateOriginalGround(
  x: number,
  bridgeLength: number,
  terrain: TerrainParameters = DEFAULT_TERRAIN,
  alignment: AlignmentParameters = DEFAULT_ALIGNMENT
): { groundElevation: number; isWater: boolean; waterSurfaceElevation: number | null } {
  const L = Math.max(10, bridgeLength);
  const u = Math.max(0, Math.min(1, x / L)); // 0.0 ~ 1.0

  // 시점 및 종점 교대 접속부 지반고 (계획고 대비 약 1.5m 하단)
  const fg = calculateFormationGround(x, alignment);
  const abutmentGround = fg - 2.0;

  let groundElevation = abutmentGround;
  let isWater = false;
  let waterSurfaceElevation: number | null = null;

  const centerRatio = 0.5;
  const halfRiverRatio = (terrain.river_width / L) / 2;

  switch (terrain.type) {
    case 'RIVER_CROSSING': {
      // 완만한 제방 경사 후 중앙 하천 평탄 하상
      const distFromCenter = Math.abs(u - centerRatio);
      const riverBedElevation = abutmentGround - terrain.valley_depth;
      const waterLevel = riverBedElevation + terrain.water_level;

      if (distFromCenter <= halfRiverRatio) {
        // 하천 내부
        groundElevation = riverBedElevation;
        isWater = true;
        waterSurfaceElevation = waterLevel;
      } else {
        // 둔치 및 제방 경사 (코사인 완화)
        const t = Math.min(1, (distFromCenter - halfRiverRatio) / (0.5 - halfRiverRatio));
        const smoothFactor = 0.5 * (1 - Math.cos(t * Math.PI));
        groundElevation = riverBedElevation + (abutmentGround - riverBedElevation) * smoothFactor;
      }
      break;
    }

    case 'VALLEY': {
      // V자 / 포물선 산악 협곡 지형
      const dip = Math.sin(Math.PI * u) * terrain.valley_depth;
      groundElevation = abutmentGround - dip;
      break;
    }

    case 'FLAT_CROSSROAD': {
      // 평지 교차로: 기본 지반고 유지, 중앙부 도로 굴착 통과
      const distFromCenter = Math.abs(u - centerRatio);
      if (distFromCenter < 0.15) {
        groundElevation = abutmentGround - 6.0; // 교차 도로 요철
      } else {
        groundElevation = abutmentGround - 1.5;
      }
      break;
    }

    case 'MOUNTAIN_PASS': {
      // 산악 능선부와 깊은 계곡
      const dip = Math.pow(Math.sin(Math.PI * u), 1.5) * terrain.valley_depth * 1.2;
      groundElevation = abutmentGround - dip;
      break;
    }
  }

  return { groundElevation, isWater, waterSurfaceElevation };
}

/**
 * 지형 및 계획고를 기반으로 한 교각 위치별 최적 높이 및 말뚝 길이 산출
 */
export function calculatePierFittings(
  x: number,
  bridgeLength: number,
  superstructureHeight: number = 2.5, // 거더 + 바닥판 + 받침 표준 높이
  terrain: TerrainParameters = DEFAULT_TERRAIN,
  alignment: AlignmentParameters = DEFAULT_ALIGNMENT
): { fittedPierHeight: number; fittedPileLength: number; og: number; fg: number } {
  const fg = calculateFormationGround(x, alignment);
  const { groundElevation: og } = calculateOriginalGround(x, bridgeLength, terrain, alignment);

  // 교각 높이 = 계획고 - 지반고 - 상부고
  const rawHeight = fg - og - superstructureHeight;
  // 최소 높이 6m, 최대 높이 70m 범위 내 표준 정규화
  const fittedPierHeight = Math.round(Math.max(6, Math.min(70, rawHeight)) * 2) / 2; // 0.5m 단위 반올림

  // 말뚝 길이는 지표면(og)으로부터 지지층(풍화암/연암)까지의 심도 적용
  const fittedPileLength = Math.round(Math.max(8, Math.min(50, terrain.bearing_stratum_depth)));

  return { fittedPierHeight, fittedPileLength, og, fg };
}

