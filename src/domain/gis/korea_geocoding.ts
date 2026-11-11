// src/domain/gis/korea_geocoding.ts

export interface KoreaLocationPOI {
  name: string;
  region: string;
  lat: number;
  lng: number;
  category: 'RIVER' | 'HIGHWAY' | 'JUNCTION' | 'CITY' | 'BRIDGE';
  terrainType: 'RIVER_CROSSING' | 'VALLEY' | 'FLAT_CROSSROAD' | 'MOUNTAIN_PASS';
  recommendedValleyDepth: number;
  recommendedRiverWidth: number;
  bearingStratumDepth: number;
  defaultBridgeLength: number;
  description: string;
}

/**
 * 대한민국 주요 하천, 고속도로 JCT/IC, 주요 교량 입지 정밀 POI 데이터베이스
 * (Vworld 오픈API 오프라인 캐시 및 즉시 검색 엔진)
 */
export const KOREA_POI_DATABASE: KoreaLocationPOI[] = [
  {
    name: '대전 신탄진 연축교 일원 (갑천)',
    region: '대전광역시 대덕구 연축동',
    lat: 36.3852,
    lng: 127.4241,
    category: 'RIVER',
    terrainType: 'RIVER_CROSSING',
    recommendedValleyDepth: 16,
    recommendedRiverWidth: 120,
    bearingStratumDepth: 16,
    defaultBridgeLength: 235,
    description: '갑천 횡단 구간, 연약지반 둔치 및 하천 제방 연결 구간'
  },
  {
    name: '안동 JCT 분기부 (낙동강)',
    region: '경상북도 안동시 풍천면 가곡리',
    lat: 36.5684,
    lng: 128.5245,
    category: 'JUNCTION',
    terrainType: 'RIVER_CROSSING',
    recommendedValleyDepth: 22,
    recommendedRiverWidth: 280,
    bearingStratumDepth: 20,
    defaultBridgeLength: 420,
    description: '낙동강 본선 및 상주-영덕 고속도로 분기 대형 하천 횡단 구간'
  },
  {
    name: '서울 잠실대교 일원 (한강 본류)',
    region: '서울특별시 송파구 신천동 ~ 광진구 자양동',
    lat: 37.5255,
    lng: 127.0988,
    category: 'BRIDGE',
    terrainType: 'RIVER_CROSSING',
    recommendedValleyDepth: 24,
    recommendedRiverWidth: 480,
    bearingStratumDepth: 22,
    defaultBridgeLength: 600,
    description: '한강 본류 광폭 하천 횡단 장경간 교량 구간'
  },
  {
    name: '강원 인제 소양강 상류 협곡 (인제대교)',
    region: '강원특별자치도 인제군 남면 남전리',
    lat: 38.0655,
    lng: 128.1723,
    category: 'RIVER',
    terrainType: 'VALLEY',
    recommendedValleyDepth: 36,
    recommendedRiverWidth: 65,
    bearingStratumDepth: 10,
    defaultBridgeLength: 280,
    description: '소양호 최상류 깊은 V자 협곡 및 암반 노출 고교각 통과 구간'
  },
  {
    name: '남한강 양평대교 횡단부',
    region: '경기도 양평군 양평읍 양근리',
    lat: 37.4878,
    lng: 127.4885,
    category: 'RIVER',
    terrainType: 'RIVER_CROSSING',
    recommendedValleyDepth: 18,
    recommendedRiverWidth: 250,
    bearingStratumDepth: 17,
    defaultBridgeLength: 380,
    description: '남한강 본류 통과 및 홍수위 여유고 확보 구간'
  },
  {
    name: '금강 세종보 횡단 햇무리교',
    region: '세종특별자치시 반곡동 ~ 보람동',
    lat: 36.4862,
    lng: 127.2917,
    category: 'BRIDGE',
    terrainType: 'RIVER_CROSSING',
    recommendedValleyDepth: 15,
    recommendedRiverWidth: 220,
    bearingStratumDepth: 14,
    defaultBridgeLength: 320,
    description: '금강 횡단 도심 연결 교량 구간'
  },
  {
    name: '대구 달성 화원 낙동강 횡단교',
    region: '대구광역시 달성군 화원읍 구라리',
    lat: 35.8075,
    lng: 128.4892,
    category: 'RIVER',
    terrainType: 'RIVER_CROSSING',
    recommendedValleyDepth: 20,
    recommendedRiverWidth: 320,
    bearingStratumDepth: 18,
    defaultBridgeLength: 450,
    description: '낙동강 중류 습지 둔치 및 광폭 하상 횡단'
  },
  {
    name: '부산 낙동강하구 명지대교',
    region: '부산광역시 강서구 명지동 ~ 사하구 신평동',
    lat: 35.1054,
    lng: 128.9341,
    category: 'BRIDGE',
    terrainType: 'RIVER_CROSSING',
    recommendedValleyDepth: 28,
    recommendedRiverWidth: 550,
    bearingStratumDepth: 35,
    defaultBridgeLength: 720,
    description: '낙동강 하구 심도 30m 이상 초연약지반 대심도 말뚝 기초 구간'
  },
  {
    name: '순천 동천 횡단 순천만교',
    region: '전라남도 순천시 교량동',
    lat: 34.9312,
    lng: 127.5028,
    category: 'RIVER',
    terrainType: 'RIVER_CROSSING',
    recommendedValleyDepth: 14,
    recommendedRiverWidth: 140,
    bearingStratumDepth: 15,
    defaultBridgeLength: 210,
    description: '연안 갯벌 연약지반 횡단 교량'
  },
  {
    name: '밀양강 영남루 횡단 밀양교',
    region: '경상남도 밀양시 내일동',
    lat: 35.5021,
    lng: 128.7562,
    category: 'RIVER',
    terrainType: 'RIVER_CROSSING',
    recommendedValleyDepth: 16,
    recommendedRiverWidth: 160,
    bearingStratumDepth: 15,
    defaultBridgeLength: 240,
    description: '밀양강 자연하천 횡단 구간'
  },
  {
    name: '영동고속도로 대관령 횡단 구간',
    region: '강원특별자치도 평창군 대관령면 횡계리',
    lat: 37.6789,
    lng: 128.7214,
    category: 'HIGHWAY',
    terrainType: 'MOUNTAIN_PASS',
    recommendedValleyDepth: 30,
    recommendedRiverWidth: 50,
    bearingStratumDepth: 12,
    defaultBridgeLength: 310,
    description: '백두대간 산악 능선 고지대 통과 교량'
  },
  {
    name: '서해안고속도로 서해대교 횡단부',
    region: '충청남도 당진시 송악읍 ~ 경기도 평택시 포승읍',
    lat: 36.9612,
    lng: 126.8391,
    category: 'BRIDGE',
    terrainType: 'RIVER_CROSSING',
    recommendedValleyDepth: 35,
    recommendedRiverWidth: 800,
    bearingStratumDepth: 25,
    defaultBridgeLength: 1200,
    description: '아산만 해상 횡단 장대 사장교 구간'
  }
];

/**
 * 주소/키워드 지오코딩 검색 함수
 */
export function searchKoreaLocations(query: string): KoreaLocationPOI[] {
  if (!query || query.trim().length === 0) {
    return KOREA_POI_DATABASE.slice(0, 6);
  }
  const clean = query.trim().toLowerCase();
  return KOREA_POI_DATABASE.filter(
    (poi) =>
      poi.name.toLowerCase().includes(clean) ||
      poi.region.toLowerCase().includes(clean) ||
      poi.description.toLowerCase().includes(clean)
  );
}

/**
 * 위도, 경도 좌표 간의 실제 거리(미터) 계산 (Haversine Formula)
 */
export function calculateGroundDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // 지구 반경 (m)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * 두 좌표 간의 방위각 (Azimuth Angle, 0°~360°)
 */
export function calculateAzimuthAngle(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const y = Math.sin(((lng2 - lng1) * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.cos(((lng2 - lng1) * Math.PI) / 180);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((bearing + 360) % 360);
}
