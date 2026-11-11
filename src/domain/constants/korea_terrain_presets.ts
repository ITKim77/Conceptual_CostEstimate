// src/domain/constants/korea_terrain_presets.ts
import { TerrainParameters, AlignmentParameters } from '../models/bridge';

export interface KoreaLocationPreset {
  id: string;
  name: string;
  region: string;
  coordinates: { lat: number; lng: number };
  description: string;
  terrain: TerrainParameters;
  alignment: AlignmentParameters;
  recommendedBridgeLength: number;
  recommendedBridgeWidth: number;
  recommendedSpans: { length: number; type: any }[];
  contextNote: string;
}

export const KOREA_LOCATION_PRESETS: KoreaLocationPreset[] = [
  {
    id: 'kr-yeonchuk',
    name: '1. 대전 연축교 일원 (갑천 횡단)',
    region: '대전광역시 대덕구 연축동 (동북부 연결도로)',
    coordinates: { lat: 36.3852, lng: 127.4241 },
    description: '갑천(하폭 110m) 및 대전-당진 고속도로 연결 지점의 하천 횡단 구간',
    contextNote: '홍수위(EL. 18.5m) 확보 및 양안 둔치 연약지반 말뚝 지지층(풍화암) 심도 16m',
    terrain: {
      type: 'RIVER_CROSSING',
      valley_depth: 16.0,
      water_level: 3.5,
      river_width: 110,
      bearing_stratum_depth: 16.0
    },
    alignment: {
      curve_radius: 800, // 완만한 평면곡선
      longitudinal_slope: 0.8, // +0.8% 완경사
      start_elevation: 32.0 // 시점 계획고 FG0 = 32.0m
    },
    recommendedBridgeLength: 235,
    recommendedBridgeWidth: 26.0,
    recommendedSpans: [
      { length: 45, type: 'MODIFIED_PSC_BEAM' },
      { length: 55, type: 'MODIFIED_PSC_BEAM' },
      { length: 55, type: 'MODIFIED_PSC_BEAM' },
      { length: 80, type: 'STEEL_BOX_CONTINUOUS_80M' }
    ]
  },
  {
    id: 'kr-andong-jct',
    name: '2. 안동JCT 분기부 (낙동강 지류 및 본선 횡단)',
    region: '경상북도 안동시 풍천면 (상주-영덕 고속도로 분기)',
    coordinates: { lat: 36.5621, lng: 128.6834 },
    description: '낙동강 지류 하천과 기존 고속도로 본선을 입체 교차하는 장대 고가교',
    contextNote: '기존 고속도로 상공 횡단 형하고(4.5m 이상) 및 하천 구간 장경간 배치 필요',
    terrain: {
      type: 'RIVER_CROSSING',
      valley_depth: 18.0,
      water_level: 2.8,
      river_width: 90,
      bearing_stratum_depth: 14.0
    },
    alignment: {
      curve_radius: 650, // 인터체인지 연결 램프 곡선
      longitudinal_slope: 1.5, // +1.5% 종단경사
      start_elevation: 35.0
    },
    recommendedBridgeLength: 425,
    recommendedBridgeWidth: 12.15,
    recommendedSpans: [
      { length: 40, type: 'DR_GIRDER' },
      { length: 45, type: 'DR_GIRDER' },
      { length: 40, type: 'DR_GIRDER' },
      { length: 40, type: 'DR_GIRDER' },
      { length: 50, type: 'DR_GIRDER' },
      { length: 40, type: 'DR_GIRDER' },
      { length: 40, type: 'DR_GIRDER' },
      { length: 50, type: 'DR_GIRDER' },
      { length: 40, type: 'DR_GIRDER' },
      { length: 40, type: 'DR_GIRDER' }
    ]
  },
  {
    id: 'kr-hangang',
    name: '3. 한강 횡단 광폭 고속도로 (구리-강동 일원)',
    region: '서울시 강동구 ~ 경기도 구리시 토평동',
    coordinates: { lat: 37.5684, lng: 127.1352 },
    description: '국내 최대 하폭(350m)을 횡단하는 수도권 제1순환/세종포천 고속도로 구간',
    contextNote: '대규모 선박 통항 형하고 확보 및 수심 깊은 하저 연약층 대심도 강관말뚝(25m) 적용',
    terrain: {
      type: 'RIVER_CROSSING',
      valley_depth: 22.0,
      water_level: 5.0,
      river_width: 320,
      bearing_stratum_depth: 24.0
    },
    alignment: {
      curve_radius: 0, // 직선 선형
      longitudinal_slope: 0.0, // 수평 종단
      start_elevation: 30.0
    },
    recommendedBridgeLength: 600,
    recommendedBridgeWidth: 28.0,
    recommendedSpans: [
      { length: 60, type: 'STEEL_BOX_CONTINUOUS' },
      { length: 80, type: 'STEEL_BOX_CONTINUOUS_80M' },
      { length: 120, type: 'CABLE_STAYED' },
      { length: 120, type: 'CABLE_STAYED' },
      { length: 80, type: 'STEEL_BOX_CONTINUOUS_80M' },
      { length: 60, type: 'STEEL_BOX_CONTINUOUS' },
      { length: 80, type: 'STEEL_BOX_CONTINUOUS' }
    ]
  },
  {
    id: 'kr-inje-valley',
    name: '4. 강원 인제 소양강 상류 (산악 협곡부)',
    region: '강원특별자치도 인제군 남면 (동서고속도로 산악 구간)',
    coordinates: { lat: 38.0655, lng: 128.1723 },
    description: '험준한 산악 능선과 깊은 V자 계곡을 가로지르는 고교각 장대교량',
    contextNote: '지형 고저차 40m 이상으로 H=35m 이상 고교각 및 직접/매스기초 지지층 노출',
    terrain: {
      type: 'VALLEY',
      valley_depth: 35.0,
      water_level: 2.0,
      river_width: 60,
      bearing_stratum_depth: 10.0
    },
    alignment: {
      curve_radius: 500, // 산악부 급곡선
      longitudinal_slope: -1.8, // -1.8% 내리막
      start_elevation: 75.0
    },
    recommendedBridgeLength: 280,
    recommendedBridgeWidth: 24.0,
    recommendedSpans: [
      { length: 50, type: 'PSC_BOX_ILM' },
      { length: 60, type: 'PSC_BOX_ILM' },
      { length: 60, type: 'PSC_BOX_ILM' },
      { length: 60, type: 'PSC_BOX_ILM' },
      { length: 50, type: 'PSC_BOX_ILM' }
    ]
  }
];

/**
 * 대한민국 항공사진 정사영상 스타일의 동적 텍스처 캔버스 생성기
 * (Vworld 위성 정사영상 스타일: 하천 본류, 모래톱/둔치, 도로망, 농경지/수목 지형 맵)
 */
export function generateKoreaAerialOrthophotoCanvas(
  terrainType: string,
  width: number = 1024,
  height: number = 512
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // 1. 기본 국토 지표면 배경 (자연스러운 농경지/산림 위성 텍스처)
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#2D4A2F'); // 딥 그린 산림
  bgGrad.addColorStop(0.3, '#3A5A35');
  bgGrad.addColorStop(0.7, '#4B6B40');
  bgGrad.addColorStop(1, '#334D2E');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. 농경지/격자 필지 패턴 (실제 위성사진 느낌 연출)
  ctx.strokeStyle = 'rgba(70, 95, 60, 0.4)';
  ctx.lineWidth = 1;
  for (let x = 0; x < width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (Math.sin(x) * 15), height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 30) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y + (Math.cos(y) * 10));
    ctx.stroke();
  }

  // 3. 하천/수계 정사영상 렌더링
  if (terrainType === 'RIVER_CROSSING' || terrainType === 'kr-hangang') {
    const riverCenterX = width / 2;
    const riverW = width * 0.28;

    // 양안 모래톱 / 둔치 (Sand / Floodplain)
    const sandGrad = ctx.createLinearGradient(riverCenterX - riverW, 0, riverCenterX + riverW, 0);
    sandGrad.addColorStop(0, 'rgba(80, 100, 70, 0.2)');
    sandGrad.addColorStop(0.12, 'rgba(180, 170, 140, 0.7)'); // 모래톱
    sandGrad.addColorStop(0.25, 'rgba(25, 75, 120, 0.95)'); // 수면 진입
    sandGrad.addColorStop(0.5, 'rgba(15, 60, 100, 1.0)'); // 심수부 (짙은 청록)
    sandGrad.addColorStop(0.75, 'rgba(25, 75, 120, 0.95)');
    sandGrad.addColorStop(0.88, 'rgba(180, 170, 140, 0.7)');
    sandGrad.addColorStop(1, 'rgba(80, 100, 70, 0.2)');

    ctx.fillStyle = sandGrad;
    ctx.fillRect(riverCenterX - riverW, 0, riverW * 2, height);

    // 하천 물결 및 제방 도로 라인
    ctx.strokeStyle = 'rgba(200, 225, 255, 0.25)';
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i += 2) {
      ctx.beginPath();
      ctx.moveTo(riverCenterX + i * (riverW * 0.85), 0);
      ctx.lineTo(riverCenterX + i * (riverW * 0.85), height);
      ctx.stroke();
    }
  } else if (terrainType === 'VALLEY') {
    // V자 산악 협곡부 암벽 음영
    const valleyX = width / 2;
    const vGrad = ctx.createLinearGradient(valleyX - 80, 0, valleyX + 80, 0);
    vGrad.addColorStop(0, 'rgba(60, 70, 60, 0.2)');
    vGrad.addColorStop(0.45, 'rgba(30, 35, 30, 0.7)');
    vGrad.addColorStop(0.5, 'rgba(20, 50, 70, 0.9)'); // 계곡 소하천
    vGrad.addColorStop(0.55, 'rgba(30, 35, 30, 0.7)');
    vGrad.addColorStop(1, 'rgba(60, 70, 60, 0.2)');
    ctx.fillStyle = vGrad;
    ctx.fillRect(valleyX - 100, 0, 200, height);
  }

  // 4. 지형 위 기존 접속도로 및 인근 도로망 (Asphalt Lines)
  ctx.strokeStyle = 'rgba(50, 50, 55, 0.85)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  // 교량 축과 직각으로 교차하는 국도/지방도 도로망
  ctx.moveTo(40, height * 0.2);
  ctx.bezierCurveTo(width * 0.3, height * 0.15, width * 0.7, height * 0.3, width - 40, height * 0.25);
  ctx.stroke();

  // 도로 차선
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 6]);
  ctx.stroke();
  ctx.setLineDash([]);

  return canvas;
}

