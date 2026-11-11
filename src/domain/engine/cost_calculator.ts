// src/domain/engine/cost_calculator.ts
import {
  BridgeParameters,
  CostBreakdown,
  SpanCostDetail,
  PierCostDetail
} from '../models/bridge';
import {
  SUPERSTRUCTURE_CATALOG,
  REV04_CONSTANTS,
  PILE_UNIT_PRICES,
  ABUTMENT_UNIT_RATES_DIRECT,
  PIER_T_UNIT_RATES
} from '../constants/rev04_database';

export function linearInterpolate(x: number, x1: number, y1: number, x2: number, y2: number): number {
  if (x1 === x2) return y1;
  return y1 + ((y2 - y1) / (x2 - x1)) * (x - x1);
}

export function calculateSuperstructureSpanUnitCost(
  type: string,
  spanLength: number,
  steelPriceTon: number = REV04_CONSTANTS.BASE_STEEL_PRICE_TON,
  applyMSS: boolean = false,
  totalLength: number = 700
): number {
  const meta = SUPERSTRUCTURE_CATALOG[type as keyof typeof SUPERSTRUCTURE_CATALOG];
  if (!meta) {
    return 600000; // default fallback if unknown
  }

  const spans = Object.keys(meta.standard_spans).map(Number).sort((a, b) => a - b);
  let baseUnitCost: number;

  if (meta.standard_spans[spanLength] !== undefined) {
    baseUnitCost = meta.standard_spans[spanLength];
  } else if (spans.length === 1) {
    baseUnitCost = meta.standard_spans[spans[0]];
  } else if (spanLength <= spans[0]) {
    baseUnitCost = meta.standard_spans[spans[0]];
  } else if (spanLength >= spans[spans.length - 1]) {
    const last = spans[spans.length - 1];
    const prev = spans[spans.length - 2];
    baseUnitCost = linearInterpolate(spanLength, prev, meta.standard_spans[prev], last, meta.standard_spans[last]);
  } else {
    let lower = spans[0];
    let upper = spans[1];
    for (let i = 0; i < spans.length - 1; i++) {
      if (spanLength >= spans[i] && spanLength <= spans[i + 1]) {
        lower = spans[i];
        upper = spans[i + 1];
        break;
      }
    }
    baseUnitCost = linearInterpolate(spanLength, lower, meta.standard_spans[lower], upper, meta.standard_spans[upper]);
  }

  // 1. 강재 시세 변동 보정 (강박스, 강판형, 소수주형 등)
  if (meta.category === 'STEEL_COMPOSITE' || type.includes('STEEL')) {
    const deltaSteelTon = steelPriceTon - REV04_CONSTANTS.BASE_STEEL_PRICE_TON;
    baseUnitCost += deltaSteelTon * REV04_CONSTANTS.STEEL_WEIGHT_RATIO;
  }

  // 2. M.S.S 공법 교량 연장 보정 (700m 기준 100m당 +-7%)
  if (applyMSS && (type === 'PSC_BOX_MSS')) {
    const lengthDelta100m = (totalLength - 700) / 100;
    const factor = 1 - (lengthDelta100m * 0.07);
    baseUnitCost = baseUnitCost * Math.max(0.7, Math.min(1.3, factor));
  }

  return Math.round(baseUnitCost);
}

export function calculatePierCost(
  diameter: number,
  height: number,
  bridgeWidth: number
): { baseCost: number; widthFactor: number; directCost: number } {
  const dKey = `D${diameter.toFixed(1)}`;
  const table = PIER_T_UNIT_RATES[dKey] || PIER_T_UNIT_RATES['D2.5'];
  const heights = Object.keys(table).map(Number).sort((a, b) => a - b);

  let baseCost: number;
  if (table[height] !== undefined) {
    baseCost = table[height];
  } else if (height <= heights[0]) {
    baseCost = table[heights[0]];
  } else if (height >= heights[heights.length - 1]) {
    const last = heights[heights.length - 1];
    const prev = heights[heights.length - 2];
    baseCost = linearInterpolate(height, prev, table[prev], last, table[last]);
  } else {
    let lower = heights[0];
    let upper = heights[1];
    for (let i = 0; i < heights.length - 1; i++) {
      if (height >= heights[i] && height <= heights[i + 1]) {
        lower = heights[i];
        upper = heights[i + 1];
        break;
      }
    }
    baseCost = linearInterpolate(height, lower, table[lower], upper, table[upper]);
  }

  // 왕복 4차로(24m 이상) 광폭 교량 폭원 계수 (1.8~2.0배, 기본 2.0배)
  const widthFactor = bridgeWidth >= 24.0 ? 2.0 : 1.0;
  const directCost = Math.round(baseCost * widthFactor);

  return { baseCost: Math.round(baseCost), widthFactor, directCost };
}

export function calculateAbutmentCost(height: number, bridgeWidth: number): number {
  const h = Math.round(Math.max(6, Math.min(13, height)));
  const unitRatePerMeter = ABUTMENT_UNIT_RATES_DIRECT[h] || 9620000;
  return Math.round(unitRatePerMeter * bridgeWidth);
}

export function calculateBridgeCost(params: BridgeParameters): CostBreakdown {
  const totalLength = params.spans.reduce((sum, s) => sum + s.span_length, 0);
  const bridgeLength = params.bridge_length || totalLength;
  const totalDeckArea = bridgeLength * params.bridge_width;

  // 사각(Skew) 보정: 20도 이상 시 상부공 4% 할증
  const skewRad = (params.skew_angle * Math.PI) / 180;
  const skewMultiplier = params.skew_angle >= 20 ? 1.04 : 1.0;
  const skewWidthMultiplier = Math.cos(skewRad) > 0 ? (1 / Math.cos(skewRad)) : 1.0;

  // 1. 상부공 산출
  let superstructureCost = 0;
  const spanDetails: SpanCostDetail[] = [];

  params.spans.forEach((span, idx) => {
    const area = span.span_length * params.bridge_width;
    const unitCost = span.custom_unit_cost || calculateSuperstructureSpanUnitCost(
      span.type,
      span.span_length,
      params.steel_price_ton,
      params.apply_mss_adjustment,
      bridgeLength
    );
    const adjustedUnitCost = Math.round(unitCost * skewMultiplier);
    const cost = Math.round(area * adjustedUnitCost);
    superstructureCost += cost;

    spanDetails.push({
      span_index: idx + 1,
      span_length: span.span_length,
      type: span.type,
      area_m2: Math.round(area * 10) / 10,
      unit_cost_m2: adjustedUnitCost,
      direct_cost: cost
    });
  });

  // 2. 교대공 산출
  let abutmentCost = 0;
  const effectiveAbutmentWidth = params.bridge_width * (params.skew_angle > 0 ? skewWidthMultiplier : 1.0);
  params.abutments.forEach(abut => {
    abutmentCost += calculateAbutmentCost(abut.height, effectiveAbutmentWidth);
  });

  // 3. 교각공 산출
  let pierCost = 0;
  const pierDetails: PierCostDetail[] = [];
  params.piers.forEach(pier => {
    const { baseCost, widthFactor, directCost } = calculatePierCost(
      pier.diameter,
      pier.height,
      params.bridge_width
    );
    pierCost += directCost;
    pierDetails.push({
      name: pier.name,
      height: pier.height,
      diameter: pier.diameter,
      base_unit_cost: baseCost,
      width_factor: widthFactor,
      direct_cost: directCost
    });
  });

  const substructureTotal = abutmentCost + pierCost;

  // 4. 기초공 (강관말뚝 D508) 산출
  const pileRateInfo = PILE_UNIT_PRICES[params.pile_method] || PILE_UNIT_PRICES.SDA;
  const pileUnitPrice = pileRateInfo.unitRate;
  let totalPileLength = 0;

  params.abutments.forEach(abut => {
    if (abut.foundation === 'PILE') {
      totalPileLength += (abut.pile_len || 15) * (abut.pile_count || 40);
    }
  });

  params.piers.forEach(pier => {
    if (pier.foundation === 'PILE') {
      totalPileLength += (pier.pile_len || 15) * (pier.pile_count || 50);
    }
  });

  const foundationCost = Math.round(totalPileLength * pileUnitPrice);

  // 5. 가시설 및 부대공/토공
  const tempFacilityCost = params.piers.length * REV04_CONSTANTS.TEMP_FACILITY_PER_PIER;
  const earthworkCost = Math.round(bridgeLength * REV04_CONSTANTS.EARTHWORK_PER_M_LENGTH);
  const ancillaryCost = tempFacilityCost + earthworkCost;

  // 6. 직접공사비 합계
  const directCostTotal = superstructureCost + substructureTotal + foundationCost + ancillaryCost;

  // 7. 기타공사비 (10%) 및 제잡비 (40.0% ~ 43.9%)
  const miscellaneousCost = Math.round(directCostTotal * REV04_CONSTANTS.MISC_COST_RATE);
  const markupRate = params.markup_rate !== undefined ? params.markup_rate : REV04_CONSTANTS.STANDARD_MARKUP_RATE;
  const indirectCostMarkup = Math.round(directCostTotal * markupRate);
  const totalConstructionCost = Math.round(directCostTotal * (1 + markupRate));

  const unitCostPerM2 = totalDeckArea > 0 ? Math.round(totalConstructionCost / totalDeckArea) : 0;

  return {
    superstructure_cost: superstructureCost,
    span_details: spanDetails,
    abutment_cost: abutmentCost,
    pier_cost: pierCost,
    pier_details: pierDetails,
    substructure_total: substructureTotal,
    foundation_cost: foundationCost,
    total_pile_length: totalPileLength,
    ancillary_cost: ancillaryCost,
    temp_facility_cost: tempFacilityCost,
    earthwork_cost: earthworkCost,
    direct_cost_total: directCostTotal,
    miscellaneous_cost: miscellaneousCost,
    indirect_cost_markup: indirectCostMarkup,
    total_construction_cost: totalConstructionCost,
    unit_cost_per_m2: unitCostPerM2,
    total_deck_area_m2: Math.round(totalDeckArea * 10) / 10
  };
}
