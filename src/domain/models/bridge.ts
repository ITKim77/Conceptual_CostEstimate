// src/domain/models/bridge.ts

export type SuperstructureType =
  | 'PSC_BEAM'
  | 'EX_GIRDER'
  | 'BICON_GIRDER'
  | 'UDPC'
  | 'DR_GIRDER'
  | 'PnP_GIRDER'
  | 'IPC_GIRDER'
  | 'PSC_e_BEAM'
  | 'MODIFIED_PSC_BEAM'
  | 'PF_BEAM'
  | 'RPF_BEAM'
  | 'Precom_GIRDER'
  | 'Turnover_GIRDER'
  | 'CPI_BEAM'
  | 'MSP_GIRDER'
  | 'IH_GIRDER'
  | 'WPC_GIRDER'
  | 'SPLICED_GIRDER_G'
  | 'SPLICED_GIRDER_B'
  | 'OPTIMIZED_GIRDER'
  | 'HIGH_STRENGTH_SEG_BEAM'
  | 'TOP_GIRDER'
  | 'IT_GIRDER'
  | 'EX_GIRDER_2'
  | 'PSC_BOX_ILM'
  | 'PSC_BOX_MSS'
  | 'PSC_BOX_FSM'
  | 'PSC_BOX_FCM'
  | 'STEEL_BOX_SIMPLE'
  | 'STEEL_BOX_CONTINUOUS'
  | 'STEEL_BOX_CONTINUOUS_80M'
  | 'RATIONALIZED_PLATE'
  | 'STEEL_PLATE'
  | 'PCT_GIRDER'
  | 'STEEL_ARCH'
  | 'CABLE_STAYED'
  | 'EXTRADOSED'
  | 'RC_RAHMEN'
  | 'RC_BOX';

export type FoundationType = 'DIRECT' | 'PILE' | 'MASS_CONCRETE';

export type PileMethod = 'DIRECT' | 'SIP' | 'SDA' | 'PRD';

export interface SpanItem {
  id: string;
  span_index: number;
  span_length: number; // m [Red]
  type: SuperstructureType; // [Red]
  foundation: FoundationType; // [Red]
  custom_unit_cost?: number; // optional manual override
}

export interface AbutmentItem {
  id: string;
  name: string; // e.g. "A1", "A2"
  height: number; // m [Red]
  foundation: FoundationType; // [Red]
  pile_len: number; // m [Red]
  pile_count: number; // [Red]
}

export interface PierItem {
  id: string;
  name: string; // e.g. "P1", "P2"
  height: number; // m [Red]
  diameter: number; // m (2.0, 2.3, 2.5, 2.8, 3.0, 3.2) [Red]
  type: 'T_PIER' | 'PI_PIER' | 'MULTI_COLUMN' | 'HOLLOW_RECTANGULAR'; // [Red]
  foundation: FoundationType; // [Red]
  pile_len: number; // m [Red]
  pile_count: number; // [Red]
}

export type TerrainType = 'RIVER_CROSSING' | 'VALLEY' | 'FLAT_CROSSROAD' | 'MOUNTAIN_PASS';

export interface TerrainParameters {
  type: TerrainType;
  valley_depth: number; // m (지반 저면 심도, 예: 18m) [Red]
  water_level: number; // m (수면 표고 또는 하천 수위, 예: 3m) [Red]
  river_width: number; // m (하천 폭원 또는 계곡 바닥 폭, 예: 60m) [Red]
  bearing_stratum_depth: number; // m (지표면 아래 지지층 심도 -> 말뚝 소요 길이, 예: 15m) [Red]
}

export interface AlignmentParameters {
  curve_radius: number; // m (평면 곡선 반경, 0은 직선, 300~2000m 곡선교) [Red]
  longitudinal_slope: number; // % (종단경사, -3.0% ~ +3.0%) [Red]
  start_elevation: number; // m (시점 계획고 FG0, 예: 25.0m) [Red]
}

export interface BridgeParameters {
  id: string;
  name: string; // [Red]
  bridge_length: number; // m [Red]
  bridge_width: number; // m [Red]
  skew_angle: number; // deg [Red]
  spans: SpanItem[]; // [Red]
  abutments: AbutmentItem[]; // [Red]
  piers: PierItem[]; // [Red]
  pile_method: PileMethod; // [Red]
  markup_rate: number; // 0.40 ~ 0.439 (40% ~ 43.9%) [Red]
  steel_price_ton: number; // 원/톤 (기본 715,000) [Red]
  apply_mss_adjustment: boolean; // [Red]
  apply_fsm_adjustment: boolean; // [Red]
  terrain?: TerrainParameters; // [Red] 지형 파라미터
  alignment?: AlignmentParameters; // [Red] 선형 파라미터
  coordinates?: { lat: number; lng: number }; // [Red] 실측 국토 위경도 좌표 (교량 중심)
  alignmentEndpoints?: {
    startLat: number;
    startLng: number;
    endLat: number;
    endLng: number;
    azimuthDeg: number; // 정북=0, 동=90 기준 방위각
  };
  locationName?: string; // [Red] 국토 지명/주소
  description?: string;
}

export interface SpanCostDetail {
  span_index: number;
  span_length: number;
  type: SuperstructureType;
  area_m2: number;
  unit_cost_m2: number;
  direct_cost: number;
  note?: string;
}

export interface PierCostDetail {
  name: string;
  height: number;
  diameter: number;
  base_unit_cost: number;
  width_factor: number;
  direct_cost: number;
}

export interface CostBreakdown {
  // Directly Computed [Blue]
  superstructure_cost: number;
  span_details: SpanCostDetail[];
  abutment_cost: number;
  pier_cost: number;
  pier_details: PierCostDetail[];
  substructure_total: number;
  foundation_cost: number;
  total_pile_length: number;
  ancillary_cost: number;
  temp_facility_cost: number;
  earthwork_cost: number;
  direct_cost_total: number;
  
  // Markups & Totals [Blue]
  miscellaneous_cost: number; // 10%
  indirect_cost_markup: number; // direct_cost * markup_rate
  total_construction_cost: number;
  unit_cost_per_m2: number;
  total_deck_area_m2: number;
}

export interface AlternativeScenario {
  id: string;
  name: string; // e.g. "원안", "비교 1안", "비교 2안"
  bridgeParams: BridgeParameters;
  costBreakdown: CostBreakdown;
  color: string;
  isBase?: boolean;
}

