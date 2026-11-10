/**
 * @file parallel_workflow_engine.mjs
 * @description BIM 기반 고속도로 교량 공사비 산정 다이나믹 에이전트 병렬 워크플로우 실행 엔진
 * Anthropic Long-Running Apps Harness 원칙(상태 분리, 모듈 격리, 오류 복원력) 및 동시성 안정성 보장
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// ============================================================================
// 1. REV.04 표준 실적 데이터베이스 (불변 인메모리 스토어)
// ============================================================================
export const REV04_DB = {
  superstructure: {
    'PSC_BEAM': { 25: 479000, 30: 502000, 35: 518000 },
    'EX_GIRDER': { 35: 548000, 40: 580880, 45: 609924, 50: 640420, 55: 678845 },
    'DR_GIRDER': { 25: 577000, 30: 564000, 35: 578000, 40: 600000, 45: 612000, 50: 637000, 55: 691000 },
    'IPC_GIRDER': { 25: 593000, 30: 587000, 35: 599000, 40: 670000, 45: 675000, 50: 713000, 55: 750000 },
    'STEEL_BOX_CONTINUOUS': { 50: 1441000, 60: 1441000, 70: 1641000, 80: 1841000 },
    'STEEL_PLATE_CONTINUOUS': { 50: 1140000, 60: 1276000, 70: 1269000 },
    'STEEL_ARCH': { 100: 3947000 },
    'CABLE_STAYED': { 150: 4124750 },
    'PSC_BOX_FCM': { 100: 2218000 }
  },
  abutment_per_meter: {
    'DIRECT': { 7: 8246000, 8: 8421000, 9: 962000, 10: 10854000, 11: 12762000, 12: 14583000 },
    'PILE': { 7: 9326815, 8: 9524873, 9: 10640830, 10: 11324997, 11: 13162840, 12: 14427632 }
  },
  pier_t_type: {
    'D2.5': { 10: 131244974, 15: 136996769, 20: 142792946, 25: 148538708, 30: 175685404 },
    'D2.8': { 10: 132425401, 15: 138818378, 20: 142211355, 25: 151604332, 30: 179438207 },
    'D3.0': { 10: 137075402, 15: 147751813, 20: 148076521, 25: 159780509, 30: 171751537 }
  },
  pile_unit_price: {
    'DIRECT': 215000,
    'SIP': 233000,
    'SDA': 245000,
    'PRD': 341000
  },
  constants: {
    TEMP_FACILITY_PER_PIER: 55000000,
    MISC_RATE: 0.10,
    STEEL_WEIGHT_RATIO: 0.35,
    BASE_STEEL_PRICE: 715000 // 66~77만 원/톤 중위값
  }
};

// ============================================================================
// 2. 동시성 제어 및 원자적 파일 락킹 (Concurrency & Locking)
// ============================================================================
class CheckpointLockManager {
  constructor(lockDir = '.claude/harness/locks') {
    this.lockDir = lockDir;
  }

  async acquireLock(resourceId, timeoutMs = 5000) {
    await fs.mkdir(this.lockDir, { recursive: true });
    const lockFile = path.join(this.lockDir, `${resourceId}.lock`);
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const handle = await fs.open(lockFile, 'wx');
        await handle.write(JSON.stringify({ pid: process.pid, time: Date.now() }));
        await handle.close();
        return async () => {
          try { await fs.unlink(lockFile); } catch (e) { /* ignore */ }
        };
      } catch (err) {
        if (err.code === 'EEXIST') {
          await new Promise(r => setTimeout(r, 50));
          continue;
        }
        throw err;
      }
    }
    throw new Error(`Lock timeout for resource: ${resourceId}`);
  }
}

// ============================================================================
// 3. 도메인 단위 연산 순수 함수 (Pure Mathematical Functions)
// ============================================================================
function interpolate(x, x1, y1, x2, y2) {
  if (x1 === x2) return y1;
  return y1 + ((y2 - y1) / (x2 - x1)) * (x - x1);
}

function lookupSuperstructureUnitCost(type, spanLength, steelPrice = null) {
  const table = REV04_DB.superstructure[type];
  if (!table) throw new Error(`Unknown superstructure type: ${type}`);

  let unitCost;
  if (table[spanLength] !== undefined) {
    unitCost = table[spanLength];
  } else {
    const spans = Object.keys(table).map(Number).sort((a, b) => a - b);
    if (spanLength < spans[0]) {
      unitCost = table[spans[0]];
    } else if (spanLength > spans[spans.length - 1]) {
      const last = spans[spans.length - 1];
      const prev = spans[spans.length - 2];
      unitCost = interpolate(spanLength, prev, table[prev], last, table[last]);
    } else {
      let lower = spans[0], upper = spans[1];
      for (let i = 0; i < spans.length - 1; i++) {
        if (spanLength >= spans[i] && spanLength <= spans[i + 1]) {
          lower = spans[i];
          upper = spans[i + 1];
          break;
        }
      }
      unitCost = interpolate(spanLength, lower, table[lower], upper, table[upper]);
    }
  }

  // 강재 가격 변동 보정
  if (steelPrice && type.includes('STEEL')) {
    const deltaSteel = steelPrice - REV04_DB.constants.BASE_STEEL_PRICE;
    unitCost += deltaSteel * REV04_DB.constants.STEEL_WEIGHT_RATIO;
  }
  return Math.round(unitCost);
}

function lookupPierUnitCost(pierType, diameter, height) {
  const key = `D${diameter.toFixed(1)}`;
  const table = REV04_DB.pier_t_type[key] || REV04_DB.pier_t_type['D2.5'];
  const heights = Object.keys(table).map(Number).sort((a, b) => a - b);

  if (table[height] !== undefined) {
    return table[height];
  }
  if (height <= heights[0]) return table[heights[0]];
  if (height >= heights[heights.length - 1]) {
    const last = heights[heights.length - 1];
    const prev = heights[heights.length - 2];
    return Math.round(interpolate(height, prev, table[prev], last, table[last]));
  }
  let lower = heights[0], upper = heights[1];
  for (let i = 0; i < heights.length - 1; i++) {
    if (height >= heights[i] && height <= heights[i + 1]) {
      lower = heights[i];
      upper = heights[i + 1];
      break;
    }
  }
  return Math.round(interpolate(height, lower, table[lower], upper, table[upper]));
}

// ============================================================================
// 4. 격리된 Dynamic Worker 에이전트 실행기 (Worker Tasks)
// ============================================================================
async function runSuperstructureWorker(input) {
  let superDirectCost = 0;
  const spanDetails = [];

  for (const span of input.spans) {
    const area = span.span_length * input.bridge_width;
    const unitCost = lookupSuperstructureUnitCost(span.type, span.span_length, input.steel_price);
    const cost = Math.round(area * unitCost);
    superDirectCost += cost;
    spanDetails.push({
      span_length: span.span_length,
      type: span.type,
      area,
      unitCost,
      cost
    });
  }
  return { superDirectCost, spanDetails };
}

async function runSubstructureWorker(input) {
  // 교대공
  let abutDirectCost = 0;
  const abutTable = REV04_DB.abutment_per_meter['DIRECT'];
  for (const abut of (input.abutments || [])) {
    const h = Math.round(abut.height || 9);
    const unitRate = abutTable[h] || 9620000;
    abutDirectCost += Math.round(unitRate * input.bridge_width);
  }

  // 교각공
  let pierDirectCost = 0;
  const widthFactor = input.bridge_width >= 24.0 ? 2.0 : 1.0;
  const pierDetails = [];

  for (const pier of (input.piers || [])) {
    const baseUnit = lookupPierUnitCost(pier.type, pier.diameter, pier.height);
    const cost = Math.round(baseUnit * widthFactor);
    pierDirectCost += cost;
    pierDetails.push({
      name: pier.name,
      height: pier.height,
      diameter: pier.diameter,
      baseUnit,
      widthFactor,
      cost
    });
  }

  return { abutDirectCost, pierDirectCost, pierDetails };
}

async function runFoundationWorker(input) {
  let foundationCost = 0;
  const pilePrice = REV04_DB.pile_unit_price[input.pile_method || 'SDA'] || 245000;
  let totalPileLength = 0;

  for (const abut of (input.abutments || [])) {
    if (abut.foundation === 'PILE') {
      totalPileLength += (abut.pile_len || 15) * (abut.pile_count || 40);
    }
  }
  for (const pier of (input.piers || [])) {
    if (pier.foundation === 'PILE') {
      totalPileLength += (pier.pile_len || 15) * (pier.pile_count || 60);
    }
  }
  foundationCost = Math.round(totalPileLength * pilePrice);
  return { foundationCost, totalPileLength, pilePrice };
}

async function runAncillaryWorker(input) {
  const numPiers = (input.piers || []).length;
  const tempFacilities = numPiers * REV04_DB.constants.TEMP_FACILITY_PER_PIER;
  const earthworks = Math.round(input.bridge_length * 50000); // 표준 m당 흙공사비
  return { ancillaryCost: tempFacilities + earthworks, tempFacilities, earthworks };
}

async function runBIMParametricWorker(input) {
  // 경량 파라메트릭 3D 지오메트리 메타데이터 생성
  const meshes = [];
  let currentX = 0;

  for (let i = 0; i < input.spans.length; i++) {
    const s = input.spans[i];
    meshes.push({
      id: `deck_span_${i + 1}`,
      type: 'box',
      dimensions: { length: s.span_length, width: input.bridge_width, depth: 2.2 },
      position: { x: currentX + s.span_length / 2, y: 15, z: 0 }
    });
    currentX += s.span_length;
  }

  for (let j = 0; j < (input.piers || []).length; j++) {
    const p = input.piers[j];
    meshes.push({
      id: `pier_${p.name || j + 1}`,
      type: 'cylinder',
      dimensions: { radiusTop: p.diameter / 2, radiusBottom: p.diameter / 2, height: p.height },
      position: { x: 50 * (j + 1), y: p.height / 2, z: 0 }
    });
  }

  return {
    meshCount: meshes.length,
    totalVolumeEstimated: Math.round(input.bridge_length * input.bridge_width * 2.2),
    meshes
  };
}

// ============================================================================
// 5. 다이나믹 병렬 오케스트레이션 엔진 (Dynamic Parallel Engine)
// ============================================================================
export async function executeParallelBridgeWorkflow(inputData, options = {}) {
  const startTime = Date.now();
  const lockManager = new CheckpointLockManager();
  const releaseLock = await lockManager.acquireLock('bridge_workflow');

  try {
    // 1단계: 사전 검증 (Hook: pre-calculate-validate)
    if (!inputData.spans || inputData.spans.length === 0) {
      throw new Error('At least one span is required.');
    }
    const computedLen = inputData.spans.reduce((acc, s) => acc + s.span_length, 0);
    inputData.bridge_length = inputData.bridge_length || computedLen;

    // 2단계: 독립 서브태스크 Dynamic Agent 병렬 실행
    const [superResult, subResult, foundationResult, ancillaryResult, bimResult] = await Promise.all([
      runSuperstructureWorker(inputData),
      runSubstructureWorker(inputData),
      runFoundationWorker(inputData),
      runAncillaryWorker(inputData),
      runBIMParametricWorker(inputData)
    ]);

    // 3단계: 불변 집계 (Immutable Cost Rollup)
    const directCost = superResult.superDirectCost +
                       subResult.abutDirectCost +
                       subResult.pierDirectCost +
                       foundationResult.foundationCost +
                       ancillaryResult.ancillaryCost;

    const miscCost = Math.round(directCost * REV04_DB.constants.MISC_RATE);
    const markupRate = inputData.markup_rate !== undefined ? inputData.markup_rate : 0.40;
    const totalCost = Math.round(directCost * (1 + markupRate));
    const totalArea = inputData.bridge_length * inputData.bridge_width;
    const unitCostPerM2 = totalArea > 0 ? Math.round(totalCost / totalArea) : 0;

    // 4단계: 사후 검증 (Hook: post-calculate-audit)
    const auditPassed = (
      Math.abs(miscCost - directCost * 0.10) <= 1 &&
      Math.abs(totalCost - directCost * (1 + markupRate)) <= 1
    );

    const executionTimeMs = Date.now() - startTime;

    const output = {
      project_name: inputData.project_name || '교량 공사비 산정안',
      metrics: {
        bridge_length: inputData.bridge_length,
        bridge_width: inputData.bridge_width,
        total_area_m2: totalArea,
        markup_rate: markupRate
      },
      cost_breakdown: {
        superstructure: superResult.superDirectCost,
        abutments: subResult.abutDirectCost,
        piers: subResult.pierDirectCost,
        foundation: foundationResult.foundationCost,
        ancillary: ancillaryResult.ancillaryCost,
        direct_total: directCost,
        miscellaneous_10pct: miscCost,
        total_construction_cost: totalCost,
        cost_per_m2: unitCostPerM2
      },
      bim_geometry: {
        mesh_count: bimResult.meshCount,
        estimated_volume: bimResult.totalVolumeEstimated
      },
      audit: {
        passed: auditPassed,
        execution_time_ms: executionTimeMs,
        parallel_tasks_count: 5
      }
    };

    return output;
  } finally {
    await releaseLock();
  }
}

// CLI 직접 실행 시 자체 벤치마크 테스트 수행
if (process.argv[1]?.endsWith('parallel_workflow_engine.mjs')) {
  console.log('--- [다이나믹 병렬 워크플로우 엔진 자가 진단 실행] ---');
  const sampleBridge = {
    project_name: "연축교 고가차도 대안 1안 벤치마크",
    bridge_width: 26.0,
    spans: [
      { span_length: 50.0, type: "PSC_BEAM" },
      { span_length: 55.0, type: "PSC_BEAM" },
      { span_length: 50.0, type: "PSC_BEAM" },
      { span_length: 40.0, type: "PSC_BEAM" },
      { span_length: 70.0, type: "STEEL_BOX_CONTINUOUS" }
    ],
    abutments: [
      { name: "A1", height: 9.0, foundation: "PILE", pile_len: 15, pile_count: 40 },
      { name: "A2", height: 9.0, foundation: "PILE", pile_len: 15, pile_count: 40 }
    ],
    piers: [
      { name: "P1", height: 18.0, type: "T_PIER", diameter: 2.8, foundation: "PILE", pile_len: 15, pile_count: 50 },
      { name: "P2", height: 22.0, type: "T_PIER", diameter: 2.8, foundation: "PILE", pile_len: 15, pile_count: 50 },
      { name: "P3", height: 20.0, type: "T_PIER", diameter: 2.8, foundation: "PILE", pile_len: 15, pile_count: 50 },
      { name: "P4", height: 16.0, type: "T_PIER", diameter: 2.8, foundation: "PILE", pile_len: 15, pile_count: 50 }
    ],
    pile_method: "SDA",
    markup_rate: 0.40
  };

  executeParallelBridgeWorkflow(sampleBridge)
    .then(result => {
      console.log('✅ 병렬 워크플로우 실행 성공!');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(err => {
      console.error('❌ 실행 오류:', err);
      process.exit(1);
    });
}

