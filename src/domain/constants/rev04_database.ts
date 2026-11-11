// src/domain/constants/rev04_database.ts
import { SuperstructureType, BridgeParameters } from '../models/bridge';

export interface SuperTypeMeta {
  code: SuperstructureType;
  name: string;
  category: 'CONCRETE_BEAM' | 'STEEL_COMPOSITE' | 'SPECIAL' | 'RAHMEN_ARCH';
  standard_spans: Record<number, number>; // spanLength (m) -> unitCost (KRW/m2)
  min_span: number;
  max_span: number;
  avg_unit_cost: number;
  description: string;
}

export const SUPERSTRUCTURE_CATALOG: Record<SuperstructureType, SuperTypeMeta> = {
  PSC_BEAM: {
    code: 'PSC_BEAM',
    name: '1. PSC BEAM',
    category: 'CONCRETE_BEAM',
    standard_spans: { 25: 479000, 30: 502000, 35: 518000 },
    min_span: 25,
    max_span: 35,
    avg_unit_cost: 499667,
    description: '25~35m 표준 지간에서 가장 경제적인 콘크리트 빔 형식'
  },
  EX_GIRDER: {
    code: 'EX_GIRDER',
    name: '2. EX GIRDER',
    category: 'CONCRETE_BEAM',
    standard_spans: { 35: 548000, 40: 580880, 45: 609924, 50: 640420, 55: 678845 },
    min_span: 35,
    max_span: 55,
    avg_unit_cost: 611614,
    description: '35~55m 중경간 거더 형식'
  },
  BICON_GIRDER: {
    code: 'BICON_GIRDER',
    name: '3. BICON GIRDER',
    category: 'CONCRETE_BEAM',
    standard_spans: { 30: 553000, 35: 583000, 40: 599000, 45: 617000, 50: 636000 },
    min_span: 30,
    max_span: 50,
    avg_unit_cost: 597600,
    description: '30~50m 2분절 합성 PSC 거더'
  },
  UDPC: {
    code: 'UDPC',
    name: '4. UDPC',
    category: 'CONCRETE_BEAM',
    standard_spans: { 25: 648000, 30: 639000, 35: 650000, 40: 676000, 45: 725000, 50: 757000 },
    min_span: 25,
    max_span: 50,
    avg_unit_cost: 682500,
    description: '초고성능 콘크리트 복합 단면 거더'
  },
  DR_GIRDER: {
    code: 'DR_GIRDER',
    name: '5. DR GIRDER',
    category: 'CONCRETE_BEAM',
    standard_spans: { 25: 577000, 30: 564000, 35: 578000, 40: 600000, 45: 612000, 50: 637000, 55: 691000 },
    min_span: 25,
    max_span: 55,
    avg_unit_cost: 608429,
    description: '단부 정착 효율을 개선한 중경간 거더 (상주-영덕 실적)'
  },
  PnP_GIRDER: {
    code: 'PnP_GIRDER',
    name: '6. PnP GIRDER',
    category: 'CONCRETE_BEAM',
    standard_spans: { 30: 574000, 35: 576000, 40: 612000, 45: 638000, 50: 660000 },
    min_span: 30,
    max_span: 50,
    avg_unit_cost: 612000,
    description: '포스트텐션 프리스트레스트 거더'
  },
  IPC_GIRDER: {
    code: 'IPC_GIRDER',
    name: '7. IPC GIRDER',
    category: 'CONCRETE_BEAM',
    standard_spans: { 25: 593000, 30: 587000, 35: 599000, 40: 670000, 45: 675000, 50: 713000, 55: 750000 },
    min_span: 25,
    max_span: 55,
    avg_unit_cost: 655286,
    description: '단계별 긴장력을 도입한 신뢰성 높은 표준 거더'
  },
  PSC_e_BEAM: {
    code: 'PSC_e_BEAM',
    name: '8. PSC e-BEAM',
    category: 'CONCRETE_BEAM',
    standard_spans: { 30: 604000, 35: 612000, 40: 673000, 45: 691000, 50: 725000 },
    min_span: 30,
    max_span: 50,
    avg_unit_cost: 661000,
    description: '경제성을 개선한 슬림 단면 거더'
  },
  MODIFIED_PSC_BEAM: {
    code: 'MODIFIED_PSC_BEAM',
    name: '9. 변단면/개량형 PSC BEAM',
    category: 'CONCRETE_BEAM',
    standard_spans: { 25: 518000, 30: 522000, 35: 554000, 40: 582000, 45: 608667, 50: 645333, 55: 685000 },
    min_span: 25,
    max_span: 55,
    avg_unit_cost: 571667,
    description: '연축교 등 다수 고속도로에 적용된 개량형 변단면 빔'
  },
  PF_BEAM: {
    code: 'PF_BEAM',
    name: '10. PF BEAM',
    category: 'CONCRETE_BEAM',
    standard_spans: { 25: 934000, 30: 966000, 35: 1017000, 40: 1103000, 45: 1135000, 50: 1205000 },
    min_span: 25,
    max_span: 50,
    avg_unit_cost: 1060000,
    description: '형고 제약 구간용 저형고 합성 빔'
  },
  RPF_BEAM: {
    code: 'RPF_BEAM',
    name: '11. RPF BEAM',
    category: 'CONCRETE_BEAM',
    standard_spans: { 25: 833000, 30: 804000, 35: 875000, 40: 948000, 45: 994000, 50: 1068000 },
    min_span: 25,
    max_span: 50,
    avg_unit_cost: 920333,
    description: '철골 프리플렉스 거더'
  },
  Precom_GIRDER: {
    code: 'Precom_GIRDER',
    name: '12. Precom GIRDER',
    category: 'CONCRETE_BEAM',
    standard_spans: { 25: 722000, 30: 743000, 35: 853000, 40: 922000, 45: 953000, 50: 1073000, 55: 1120000, 60: 1229000 },
    min_span: 25,
    max_span: 60,
    avg_unit_cost: 951875,
    description: '프리컴 합성거더 (60m까지 적용 가능)'
  },
  Turnover_GIRDER: {
    code: 'Turnover_GIRDER',
    name: '13. Turnover GIRDER',
    category: 'CONCRETE_BEAM',
    standard_spans: { 30: 874000, 35: 916000, 40: 926000, 45: 998000, 50: 1047000 },
    min_span: 30,
    max_span: 50,
    avg_unit_cost: 952200,
    description: '턴오버 프리스트레스 거더'
  },
  CPI_BEAM: {
    code: 'CPI_BEAM',
    name: '14. CPI BEAM',
    category: 'CONCRETE_BEAM',
    standard_spans: { 25: 943000, 30: 917000, 35: 1144000, 40: 1223000, 45: 1284000, 50: 1399000 },
    min_span: 25,
    max_span: 50,
    avg_unit_cost: 1151667,
    description: '곡선 및 사각 교량 대응용 거더'
  },
  MSP_GIRDER: {
    code: 'MSP_GIRDER',
    name: '15. MSP GIRDER',
    category: 'CONCRETE_BEAM',
    standard_spans: { 25: 711000, 30: 743000, 35: 835000, 40: 878000, 45: 956000, 50: 1038000, 55: 1110000, 60: 1199000 },
    min_span: 25,
    max_span: 60,
    avg_unit_cost: 933750,
    description: '다경간 연속 프리스트레스트 거더'
  },
  IH_GIRDER: {
    code: 'IH_GIRDER',
    name: '16. IH GIRDER',
    category: 'CONCRETE_BEAM',
    standard_spans: { 35: 909000, 40: 959000, 45: 1034000, 50: 1194000, 55: 1319000, 60: 1389000, 65: 1494000, 70: 1589000 },
    min_span: 35,
    max_span: 70,
    avg_unit_cost: 1235875,
    description: '강관 하이브리드 거더 (70m 장경간 대응)'
  },
  WPC_GIRDER: {
    code: 'WPC_GIRDER',
    name: '17. WPC GIRDER',
    category: 'CONCRETE_BEAM',
    standard_spans: { 30: 576667, 35: 626667, 40: 646667, 45: 676667, 50: 686667 },
    min_span: 30,
    max_span: 50,
    avg_unit_cost: 642667,
    description: '와이드 플랜지형 PSC 거더'
  },
  SPLICED_GIRDER_G: {
    code: 'SPLICED_GIRDER_G',
    name: '18. SPLICED GIRDER-G',
    category: 'CONCRETE_BEAM',
    standard_spans: { 35: 800000, 40: 800000, 50: 930000, 55: 930000 },
    min_span: 35,
    max_span: 55,
    avg_unit_cost: 865000,
    description: '분절 제작 현장 조립 스플라이스 거더'
  },
  SPLICED_GIRDER_B: {
    code: 'SPLICED_GIRDER_B',
    name: '19. SPLICED GIRDER-B',
    category: 'CONCRETE_BEAM',
    standard_spans: { 55: 930000 },
    min_span: 55,
    max_span: 55,
    avg_unit_cost: 930000,
    description: '박스 단면 스플라이스 거더'
  },
  OPTIMIZED_GIRDER: {
    code: 'OPTIMIZED_GIRDER',
    name: '20. 최적거더',
    category: 'CONCRETE_BEAM',
    standard_spans: { 30: 590000, 35: 620000, 40: 640000, 45: 670000, 50: 700000, 55: 730000, 60: 760000 },
    min_span: 30,
    max_span: 60,
    avg_unit_cost: 548000,
    description: '도로공사 최적화 단면 거더'
  },
  HIGH_STRENGTH_SEG_BEAM: {
    code: 'HIGH_STRENGTH_SEG_BEAM',
    name: '21. 고강도 Seg BEAM',
    category: 'CONCRETE_BEAM',
    standard_spans: { 35: 838000, 40: 852667, 45: 883333, 50: 902333, 55: 911000, 60: 913500 },
    min_span: 35,
    max_span: 60,
    avg_unit_cost: 883472,
    description: '고강도 콘크리트 세그먼트 빔'
  },
  TOP_GIRDER: {
    code: 'TOP_GIRDER',
    name: '22. TOP GIRDER',
    category: 'CONCRETE_BEAM',
    standard_spans: { 45: 620000, 50: 650000 },
    min_span: 45,
    max_span: 50,
    avg_unit_cost: 635000,
    description: '상부 광폭 플랜지 거더'
  },
  IT_GIRDER: {
    code: 'IT_GIRDER',
    name: '23. IT GIRDER',
    category: 'CONCRETE_BEAM',
    standard_spans: { 30: 535000, 35: 671000, 40: 723000, 45: 760000, 50: 800000, 55: 843000, 60: 898000 },
    min_span: 30,
    max_span: 60,
    avg_unit_cost: 747143,
    description: '역T형 단면 거더'
  },
  EX_GIRDER_2: {
    code: 'EX_GIRDER_2',
    name: '24. EX거더(경량형)',
    category: 'CONCRETE_BEAM',
    standard_spans: { 30: 545000, 35: 577000, 40: 620000, 45: 651000 },
    min_span: 30,
    max_span: 45,
    avg_unit_cost: 598250,
    description: '개량형 저자중 거더'
  },
  // 박스 및 연속교
  PSC_BOX_ILM: {
    code: 'PSC_BOX_ILM',
    name: 'PSC BOX (I.L.M)',
    category: 'CONCRETE_BEAM',
    standard_spans: { 40: 932800, 50: 932800, 60: 932800 },
    min_span: 40,
    max_span: 60,
    avg_unit_cost: 932800,
    description: '압출공법(ILM), L>=240m 연속교 표준'
  },
  PSC_BOX_MSS: {
    code: 'PSC_BOX_MSS',
    name: 'PSC BOX (M.S.S)',
    category: 'CONCRETE_BEAM',
    standard_spans: { 40: 992200, 50: 992200, 60: 992200 },
    min_span: 40,
    max_span: 60,
    avg_unit_cost: 992200,
    description: '이동식 지보공법, 700m 기준 연장 증감 보정'
  },
  PSC_BOX_FSM: {
    code: 'PSC_BOX_FSM',
    name: 'PSC BOX (F.S.M)',
    category: 'CONCRETE_BEAM',
    standard_spans: { 30: 1617000, 40: 1617000, 50: 1617000 },
    min_span: 30,
    max_span: 50,
    avg_unit_cost: 1617000,
    description: '전지보공법, 동바리 일체식'
  },
  PSC_BOX_FCM: {
    code: 'PSC_BOX_FCM',
    name: 'PSC BOX (F.C.M)',
    category: 'CONCRETE_BEAM',
    standard_spans: { 70: 2218000, 80: 2218000, 90: 2218000, 100: 2218000 },
    min_span: 70,
    max_span: 120,
    avg_unit_cost: 2218000,
    description: '캔틸레버 공법, 지주 없는 하천/계곡 80~100m급 횡단'
  },
  // 강박스 및 강합성
  STEEL_BOX_SIMPLE: {
    code: 'STEEL_BOX_SIMPLE',
    name: 'ST. BOX GIRDER (단경간)',
    category: 'STEEL_COMPOSITE',
    standard_spans: { 40: 1585000, 50: 1585000, 60: 1585000 },
    min_span: 40,
    max_span: 60,
    avg_unit_cost: 1585000,
    description: '단경간 50m 강박스 거더'
  },
  STEEL_BOX_CONTINUOUS: {
    code: 'STEEL_BOX_CONTINUOUS',
    name: 'ST. BOX GIRDER (연속경간 50~60m)',
    category: 'STEEL_COMPOSITE',
    standard_spans: { 50: 1441000, 60: 1441000 },
    min_span: 45,
    max_span: 65,
    avg_unit_cost: 1441000,
    description: '표준 다경간 연속 강박스교 (원자재 가격 연동 대상)'
  },
  STEEL_BOX_CONTINUOUS_80M: {
    code: 'STEEL_BOX_CONTINUOUS_80M',
    name: 'ST. BOX GIRDER (연속경간 70~80m+)',
    category: 'STEEL_COMPOSITE',
    standard_spans: { 70: 1641000, 80: 1841000 },
    min_span: 65,
    max_span: 90,
    avg_unit_cost: 1841000,
    description: '80m급 중/장경간 연속 강박스교'
  },
  RATIONALIZED_PLATE: {
    code: 'RATIONALIZED_PLATE',
    name: '합리화 소수주형 판형교',
    category: 'STEEL_COMPOSITE',
    standard_spans: { 50: 1140000, 60: 1276000 },
    min_span: 45,
    max_span: 65,
    avg_unit_cost: 1208000,
    description: '강재량 절감 플레이트 거더 (안동JCT 실적)'
  },
  STEEL_PLATE: {
    code: 'STEEL_PLATE',
    name: 'S.T PLATE (강판형교)',
    category: 'STEEL_COMPOSITE',
    standard_spans: { 45: 1269000, 50: 1269000, 60: 1269000 },
    min_span: 40,
    max_span: 65,
    avg_unit_cost: 1269000,
    description: '표준 강플레이트 거더'
  },
  PCT_GIRDER: {
    code: 'PCT_GIRDER',
    name: 'PCT 거더 (복합거더)',
    category: 'STEEL_COMPOSITE',
    standard_spans: { 45: 1320000, 50: 1320000, 60: 1320000 },
    min_span: 40,
    max_span: 60,
    avg_unit_cost: 1320000,
    description: '프리스트레스트 복합 거더'
  },
  // 특수 및 라멘
  STEEL_ARCH: {
    code: 'STEEL_ARCH',
    name: '강아치교 (Steel Arch)',
    category: 'SPECIAL',
    standard_spans: { 80: 3947000, 100: 3947000, 120: 3947000 },
    min_span: 70,
    max_span: 150,
    avg_unit_cost: 3947000,
    description: 'L=100m급 랜드마크 아치교 (연축교 비교3안)'
  },
  CABLE_STAYED: {
    code: 'CABLE_STAYED',
    name: '사장교 (Cable-Stayed)',
    category: 'SPECIAL',
    standard_spans: { 150: 4124750, 200: 4124750 },
    min_span: 120,
    max_span: 300,
    avg_unit_cost: 4124750,
    description: '주탑 및 케이블 포함 150m+ 특수 장경간 교량'
  },
  EXTRADOSED: {
    code: 'EXTRADOSED',
    name: '엑스트라도우즈드교 (E/D)',
    category: 'SPECIAL',
    standard_spans: { 70: 2357000, 80: 2357000, 100: 2357000 },
    min_span: 60,
    max_span: 150,
    avg_unit_cost: 2357000,
    description: '저탑 사장교 형태의 하이브리드 교량'
  },
  RC_RAHMEN: {
    code: 'RC_RAHMEN',
    name: '노출 R.C 라멘',
    category: 'RAHMEN_ARCH',
    standard_spans: { 15: 1455000, 20: 1455000, 25: 1455000 },
    min_span: 10,
    max_span: 30,
    avg_unit_cost: 1455000,
    description: '단경간 및 다경간 교대 일체형 라멘교'
  },
  RC_BOX: {
    code: 'RC_BOX',
    name: '노출 RC BOX',
    category: 'RAHMEN_ARCH',
    standard_spans: { 10: 1309500, 15: 1309500, 20: 1309500 },
    min_span: 8,
    max_span: 25,
    avg_unit_cost: 1309500,
    description: '개착식 박스 통로 및 수로 구조물'
  }
};

export const REV04_CONSTANTS = {
  BASE_STEEL_PRICE_TON: 715000, // 원/톤 (기준시점 66~77만 원의 평균)
  STEEL_WEIGHT_RATIO: 0.35, // 강재비 비중 35%
  MISC_COST_RATE: 0.10, // 기타공사비 직접비의 10%
  STANDARD_MARKUP_RATE: 0.40, // 제잡비 40.0%
  TEMP_FACILITY_PER_PIER: 55000000, // 교각 가시설 5,500만 원/기
  MASS_CONCRETE_M3: 70000, // 매스콘크리트 70,000 원/m3
  RETAINING_WALL_M: 992960, // 역T형 옹벽 1~5m 992,960 원/m
  EARTHWORK_PER_M_LENGTH: 50000 // 교량 연장 m당 표준 흙공사비 50,000 원
};

export const PILE_UNIT_PRICES = {
  DIRECT: { name: '직접항타', unitRate: 215000, desc: '연약지반, 소음 민원 적은 구간' },
  SIP: { name: '천공 후 매입 (S.I.P)', unitRate: 233000, desc: '오거 천공 및 시멘트 밀크 주입' },
  SDA: { name: '천공 후 매입 (S.D.A)', unitRate: 245000, desc: '이중 오거 관입, 자갈/호박돌층 표준' },
  PRD: { name: '천공 후 매입 (P.R.D)', unitRate: 341000, desc: '암반 천공 (DTH 해머)' }
};

export const ABUTMENT_UNIT_RATES_DIRECT: Record<number, number> = {
  6: 8246000,
  7: 8246000,
  8: 8421000,
  9: 9620000,
  10: 10854000,
  11: 12762000,
  12: 14583000,
  13: 16768977
};

export const PIER_T_UNIT_RATES: Record<string, Record<number, number>> = {
  'D2.0': { 10: 123183677, 15: 129269830, 20: 135339091, 25: 141416835, 30: 147494579 },
  'D2.3': { 10: 122257051, 15: 128138584, 20: 134020116, 25: 139901648, 30: 145783180, 35: 151664712 },
  'D2.5': { 10: 131244974, 15: 136996769, 20: 142792946, 25: 148538708, 30: 175685404, 35: 183276223, 40: 190917727 },
  'D2.8': { 10: 132425401, 15: 138818378, 20: 142211355, 25: 151604332, 30: 179438207, 35: 187676511, 40: 195914815, 45: 204153119, 50: 212391423 },
  'D3.0': { 10: 137075402, 15: 147751813, 20: 148076521, 25: 159780509, 30: 171751537, 35: 183595539, 40: 196045126, 45: 208761690, 50: 221351268, 55: 234546463, 60: 248008730 },
  'D3.2': { 10: 142113647, 15: 154056386, 20: 155023654, 25: 168061267, 30: 181383752, 35: 194584876, 40: 208417802, 45: 222535520, 50: 236531932, 55: 251160181, 60: 266073302 }
};

// ============================================================================
// 벤치마크 실적 데이터셋 (docs/ 6장 연축교 및 안동JCT)
// ============================================================================
export interface BenchmarkItem {
  id: string;
  name: string;
  location: string;
  bridgeParams: BridgeParameters;
  referenceDirectCostBillion: number; // 억원
  referenceTotalCostBillion: number; // 억원
  referenceUnitCostPerM2TenThousand: number; // 만원/m2
  description: string;
}

export const PRESET_BENCHMARKS: BenchmarkItem[] = [
  {
    id: 'yeonchuk-base',
    name: '연축교 원안 (개량형 PSC + 강합성)',
    location: '동북부 연결도로 (대전)',
    referenceDirectCostBillion: 113.17,
    referenceTotalCostBillion: 158.44,
    referenceUnitCostPerM2TenThousand: 247,
    description: '45+55+55 (155m PSC) + 80m 강합성 거더 (총연장 235m, B=26m)',
    bridgeParams: {
      id: 'yeonchuk-base',
      name: '연축교 원안',
      bridge_length: 235,
      bridge_width: 26,
      skew_angle: 0,
      spans: [
        { id: 's1', span_index: 1, span_length: 45, type: 'MODIFIED_PSC_BEAM', foundation: 'PILE' },
        { id: 's2', span_index: 2, span_length: 55, type: 'MODIFIED_PSC_BEAM', foundation: 'PILE' },
        { id: 's3', span_index: 3, span_length: 55, type: 'MODIFIED_PSC_BEAM', foundation: 'PILE' },
        { id: 's4', span_index: 4, span_length: 80, type: 'STEEL_BOX_CONTINUOUS_80M', foundation: 'PILE' }
      ],
      abutments: [
        { id: 'a1', name: 'A1', height: 9, foundation: 'PILE', pile_len: 15, pile_count: 50 },
        { id: 'a2', name: 'A2', height: 9, foundation: 'PILE', pile_len: 15, pile_count: 50 }
      ],
      piers: [
        { id: 'p1', name: 'P1', height: 18, diameter: 2.8, type: 'T_PIER', foundation: 'PILE', pile_len: 15, pile_count: 60 },
        { id: 'p2', name: 'P2', height: 22, diameter: 2.8, type: 'T_PIER', foundation: 'PILE', pile_len: 15, pile_count: 60 },
        { id: 'p3', name: 'P3', height: 20, diameter: 2.8, type: 'T_PIER', foundation: 'PILE', pile_len: 15, pile_count: 60 }
      ],
      pile_method: 'SDA',
      markup_rate: 0.40,
      steel_price_ton: 715000,
      apply_mss_adjustment: false,
      apply_fsm_adjustment: false
    }
  },
  {
    id: 'yeonchuk-alt1',
    name: '연축교 비교 1안 (경간 조정안)',
    location: '동북부 연결도로 (대전)',
    referenceDirectCostBillion: 126.38,
    referenceTotalCostBillion: 176.93,
    referenceUnitCostPerM2TenThousand: 240,
    description: '50+55+50+40 (195m PSC) + 70m 강합성 거더 (총연장 265m, B=26m)',
    bridgeParams: {
      id: 'yeonchuk-alt1',
      name: '연축교 비교 1안',
      bridge_length: 265,
      bridge_width: 26,
      skew_angle: 0,
      spans: [
        { id: 's1', span_index: 1, span_length: 50, type: 'MODIFIED_PSC_BEAM', foundation: 'PILE' },
        { id: 's2', span_index: 2, span_length: 55, type: 'MODIFIED_PSC_BEAM', foundation: 'PILE' },
        { id: 's3', span_index: 3, span_length: 50, type: 'MODIFIED_PSC_BEAM', foundation: 'PILE' },
        { id: 's4', span_index: 4, span_length: 40, type: 'MODIFIED_PSC_BEAM', foundation: 'PILE' },
        { id: 's5', span_index: 5, span_length: 70, type: 'STEEL_BOX_CONTINUOUS_80M', foundation: 'PILE' }
      ],
      abutments: [
        { id: 'a1', name: 'A1', height: 9, foundation: 'PILE', pile_len: 15, pile_count: 50 },
        { id: 'a2', name: 'A2', height: 9, foundation: 'PILE', pile_len: 15, pile_count: 50 }
      ],
      piers: [
        { id: 'p1', name: 'P1', height: 18, diameter: 2.8, type: 'T_PIER', foundation: 'PILE', pile_len: 15, pile_count: 60 },
        { id: 'p2', name: 'P2', height: 22, diameter: 2.8, type: 'T_PIER', foundation: 'PILE', pile_len: 15, pile_count: 60 },
        { id: 'p3', name: 'P3', height: 20, diameter: 2.8, type: 'T_PIER', foundation: 'PILE', pile_len: 15, pile_count: 60 },
        { id: 'p4', name: 'P4', height: 16, diameter: 2.8, type: 'T_PIER', foundation: 'PILE', pile_len: 15, pile_count: 60 }
      ],
      pile_method: 'SDA',
      markup_rate: 0.40,
      steel_price_ton: 715000,
      apply_mss_adjustment: false,
      apply_fsm_adjustment: false
    }
  },
  {
    id: 'yeonchuk-alt3',
    name: '연축교 비교 3안 (강아치교 랜드마크)',
    location: '동북부 연결도로 (대전)',
    referenceDirectCostBillion: 203.44,
    referenceTotalCostBillion: 284.82,
    referenceUnitCostPerM2TenThousand: 426,
    description: '45+50+55 (150m PSC) + 100m 강아치교 (총연장 250m, B=26m)',
    bridgeParams: {
      id: 'yeonchuk-alt3',
      name: '연축교 비교 3안 (아치교)',
      bridge_length: 250,
      bridge_width: 26,
      skew_angle: 0,
      spans: [
        { id: 's1', span_index: 1, span_length: 45, type: 'MODIFIED_PSC_BEAM', foundation: 'PILE' },
        { id: 's2', span_index: 2, span_length: 50, type: 'MODIFIED_PSC_BEAM', foundation: 'PILE' },
        { id: 's3', span_index: 3, span_length: 55, type: 'MODIFIED_PSC_BEAM', foundation: 'PILE' },
        { id: 's4', span_index: 4, span_length: 100, type: 'STEEL_ARCH', foundation: 'PILE' }
      ],
      abutments: [
        { id: 'a1', name: 'A1', height: 9, foundation: 'PILE', pile_len: 15, pile_count: 60 },
        { id: 'a2', name: 'A2', height: 9, foundation: 'PILE', pile_len: 15, pile_count: 60 }
      ],
      piers: [
        { id: 'p1', name: 'P1', height: 18, diameter: 3.0, type: 'T_PIER', foundation: 'PILE', pile_len: 15, pile_count: 70 },
        { id: 'p2', name: 'P2', height: 22, diameter: 3.2, type: 'T_PIER', foundation: 'PILE', pile_len: 15, pile_count: 80 },
        { id: 'p3', name: 'P3', height: 20, diameter: 3.0, type: 'T_PIER', foundation: 'PILE', pile_len: 15, pile_count: 70 }
      ],
      pile_method: 'PRD',
      markup_rate: 0.40,
      steel_price_ton: 715000,
      apply_mss_adjustment: false,
      apply_fsm_adjustment: false
    }
  },
  {
    id: 'andong-jct-alt1',
    name: '안동JCT교 비교 1안 (DR 거더교)',
    location: '상주-영덕 고속도로',
    referenceDirectCostBillion: 36.68,
    referenceTotalCostBillion: 51.35,
    referenceUnitCostPerM2TenThousand: 99,
    description: 'L=425m, B=12.15m (40+45+2@40+50+2@40+50+2@40) DR GIRDER',
    bridgeParams: {
      id: 'andong-jct-alt1',
      name: '안동JCT 비교 1안 (DR 거더)',
      bridge_length: 425,
      bridge_width: 12.15,
      skew_angle: 0,
      spans: [
        { id: 's1', span_index: 1, span_length: 40, type: 'DR_GIRDER', foundation: 'PILE' },
        { id: 's2', span_index: 2, span_length: 45, type: 'DR_GIRDER', foundation: 'PILE' },
        { id: 's3', span_index: 3, span_length: 40, type: 'DR_GIRDER', foundation: 'PILE' },
        { id: 's4', span_index: 4, span_length: 40, type: 'DR_GIRDER', foundation: 'PILE' },
        { id: 's5', span_index: 5, span_length: 50, type: 'DR_GIRDER', foundation: 'PILE' },
        { id: 's6', span_index: 6, span_length: 40, type: 'DR_GIRDER', foundation: 'PILE' },
        { id: 's7', span_index: 7, span_length: 40, type: 'DR_GIRDER', foundation: 'PILE' },
        { id: 's8', span_index: 8, span_length: 50, type: 'DR_GIRDER', foundation: 'PILE' },
        { id: 's9', span_index: 9, span_length: 40, type: 'DR_GIRDER', foundation: 'PILE' },
        { id: 's10', span_index: 10, span_length: 40, type: 'DR_GIRDER', foundation: 'PILE' }
      ],
      abutments: [
        { id: 'a1', name: 'A1', height: 8, foundation: 'PILE', pile_len: 12, pile_count: 24 },
        { id: 'a2', name: 'A2', height: 8, foundation: 'PILE', pile_len: 12, pile_count: 24 }
      ],
      piers: Array.from({ length: 9 }).map((_, i) => ({
        id: `p${i + 1}`,
        name: `P${i + 1}`,
        height: 15,
        diameter: 2.3,
        type: 'T_PIER',
        foundation: 'PILE',
        pile_len: 12,
        pile_count: 30
      })),
      pile_method: 'SDA',
      markup_rate: 0.40,
      steel_price_ton: 715000,
      apply_mss_adjustment: false,
      apply_fsm_adjustment: false
    }
  }
];

