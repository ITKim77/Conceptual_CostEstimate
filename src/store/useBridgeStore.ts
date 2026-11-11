// src/store/useBridgeStore.ts
import { create } from 'zustand';
import {
  BridgeParameters,
  CostBreakdown,
  AlternativeScenario,
  SpanItem,
  PierItem,
  AbutmentItem,
  PileMethod,
  SuperstructureType,
  TerrainParameters,
  AlignmentParameters
} from '../domain/models/bridge';
import { calculateBridgeCost } from '../domain/engine/cost_calculator';
import { PRESET_BENCHMARKS, BenchmarkItem } from '../domain/constants/rev04_database';
import {
  DEFAULT_TERRAIN,
  DEFAULT_ALIGNMENT,
  calculatePierFittings
} from '../domain/engine/terrain_alignment_calculator';

interface BridgeStoreState {
  // 1. [Red] 원천 사용자 입력 상태 (SSOT)
  projectName: string;
  bridgeParams: BridgeParameters;
  activeAlternativeId: string | null;
  alternatives: AlternativeScenario[];
  customBenchmarks: BenchmarkItem[];
  
  // 2. [Blue] 연산 및 인용 파생 상태 (Read-Only)
  costBreakdown: CostBreakdown;

  // 3. UI 조작 상태
  selectedViewMode: '3D' | 'TABLE' | 'ANALYTICS' | 'BENCHMARK';
  cameraPreset: 'iso' | 'elevation' | 'cross' | 'plan';
  activeTab: 'basic' | 'spans' | 'substructure' | 'piles' | 'terrain';

  // 4. 액션 (Red 인풋 갱신 및 파생 상태 동기화)
  setProjectName: (name: string) => void;
  updateBridgeParams: (partial: Partial<BridgeParameters>) => void;
  updateTerrainParams: (partial: Partial<TerrainParameters>) => void;
  updateAlignmentParams: (partial: Partial<AlignmentParameters>) => void;
  autoFitPiersToTerrain: () => void;
  updateSpan: (index: number, span: Partial<SpanItem>) => void;
  addSpan: (type?: SuperstructureType, length?: number) => void;
  removeSpan: (index: number) => void;
  updatePier: (index: number, pier: Partial<PierItem>) => void;
  addPier: () => void;
  removePier: (index: number) => void;
  updateAbutment: (index: number, abut: Partial<AbutmentItem>) => void;
  setPileMethod: (method: PileMethod) => void;
  applyBatchPileParams: (params: {
    abutPileLen?: number;
    abutPileCount?: number;
    pierPileLen?: number;
    pierPileCount?: number;
    foundationType?: 'DIRECT' | 'PILE' | 'MASS_CONCRETE';
  }) => void;

  // 대안 관리 액션 (원안/대안 구분 없음: 대안 1, 대안 2, ... 동등 비교)
  saveNewAlternative: (name?: string) => void;
  saveCurrentAlternative: (name?: string) => void;
  updateAlternativeName: (id: string, name: string) => void;
  registerCurrentAsAlternative: (name?: string) => void;
  updateCurrentAlternative: () => void;
  saveCurrentAsAlternative: (name: string, color?: string) => void;
  loadAlternative: (id: string) => void;
  deleteAlternative: (id: string) => void;
  loadBenchmarkPreset: (benchmarkId: string) => void;
  loadAllBenchmarks: () => void;
  addBenchmarkFromAlternative: (altId: string) => void;
  resetToInitialState: () => void;

  // UI 상태 액션
  setViewMode: (mode: '3D' | 'TABLE' | 'ANALYTICS' | 'BENCHMARK') => void;
  setCameraPreset: (preset: 'iso' | 'elevation' | 'cross' | 'plan') => void;
  setActiveTab: (tab: 'basic' | 'spans' | 'substructure' | 'piles' | 'terrain') => void;
}

export const DEFAULT_CLEAN_BRIDGE: BridgeParameters = {
  id: '',
  name: '',
  bridge_length: 120,
  bridge_width: 24,
  skew_angle: 0,
  spans: [
    { id: 's1', span_index: 1, span_length: 40, type: 'PSC_BEAM', foundation: 'PILE' },
    { id: 's2', span_index: 2, span_length: 40, type: 'PSC_BEAM', foundation: 'PILE' },
    { id: 's3', span_index: 3, span_length: 40, type: 'PSC_BEAM', foundation: 'PILE' }
  ],
  abutments: [
    { id: 'a1', name: 'A1', height: 9, foundation: 'PILE', pile_len: 15, pile_count: 40 },
    { id: 'a2', name: 'A2', height: 9, foundation: 'PILE', pile_len: 15, pile_count: 40 }
  ],
  piers: [
    { id: 'p1', name: 'P1', height: 16, diameter: 2.5, type: 'T_PIER', foundation: 'PILE', pile_len: 15, pile_count: 50 },
    { id: 'p2', name: 'P2', height: 16, diameter: 2.5, type: 'T_PIER', foundation: 'PILE', pile_len: 15, pile_count: 50 }
  ],
  pile_method: 'SDA',
  markup_rate: 0.40,
  steel_price_ton: 715000,
  apply_mss_adjustment: false,
  apply_fsm_adjustment: false,
  terrain: JSON.parse(JSON.stringify(DEFAULT_TERRAIN)),
  alignment: JSON.parse(JSON.stringify(DEFAULT_ALIGNMENT)),
  description: '신규 교량 기본 설계 (40m × 3경간 PSC BEAM, B=24m 왕복 4차로 표준)'
};

/**
 * 원안을 포함한 전면 초기화 상태 생성 (원안도 초기화 대상)
 */
export function createDefaultCleanState() {
  const baseParams: BridgeParameters = JSON.parse(JSON.stringify(DEFAULT_CLEAN_BRIDGE));
  const baseBreakdown = calculateBridgeCost(baseParams);

  return {
    projectName: '',
    bridgeParams: baseParams,
    activeAlternativeId: null as string | null,
    alternatives: [] as AlternativeScenario[],
    customBenchmarks: [] as BenchmarkItem[],
    costBreakdown: baseBreakdown,
    selectedViewMode: '3D' as const,
    cameraPreset: 'iso' as const,
    activeTab: 'basic' as const
  };
}

export const useBridgeStore = create<BridgeStoreState>((set, get) => ({
  ...createDefaultCleanState(),

  updateBridgeParams: (partial) => {
    set((state) => {
      const newParams = { ...state.bridgeParams, ...partial };
      const newBreakdown = calculateBridgeCost(newParams);
      return {
        bridgeParams: newParams,
        costBreakdown: newBreakdown
      };
    });
  },

  updateTerrainParams: (partial) => {
    set((state) => {
      const currentTerrain = state.bridgeParams.terrain || DEFAULT_TERRAIN;
      const newTerrain = { ...currentTerrain, ...partial };
      const newParams = { ...state.bridgeParams, terrain: newTerrain };
      return {
        bridgeParams: newParams
      };
    });
  },

  updateAlignmentParams: (partial) => {
    set((state) => {
      const currentAlignment = state.bridgeParams.alignment || DEFAULT_ALIGNMENT;
      const newAlignment = { ...currentAlignment, ...partial };
      const newParams = { ...state.bridgeParams, alignment: newAlignment };
      return {
        bridgeParams: newParams
      };
    });
  },

  autoFitPiersToTerrain: () => {
    set((state) => {
      const { bridgeParams } = state;
      const terrain = bridgeParams.terrain || DEFAULT_TERRAIN;
      const alignment = bridgeParams.alignment || DEFAULT_ALIGNMENT;
      const bridgeLength = bridgeParams.bridge_length;
      const spans = bridgeParams.spans;

      let cumX = 0;
      const newPiers = bridgeParams.piers.map((pier, idx) => {
        if (idx < spans.length - 1) {
          cumX += spans[idx].span_length;
        } else {
          cumX = (bridgeLength / (bridgeParams.piers.length + 1)) * (idx + 1);
        }

        const { fittedPierHeight, fittedPileLength } = calculatePierFittings(
          cumX,
          bridgeLength,
          2.5,
          terrain,
          alignment
        );

        return {
          ...pier,
          height: fittedPierHeight,
          pile_len: fittedPileLength
        };
      });

      const newAbuts = bridgeParams.abutments.map((abut) => ({
        ...abut,
        pile_len: terrain.bearing_stratum_depth || 15
      }));

      const newParams = {
        ...bridgeParams,
        piers: newPiers,
        abutments: newAbuts
      };

      const newBreakdown = calculateBridgeCost(newParams);

      return {
        bridgeParams: newParams,
        costBreakdown: newBreakdown
      };
    });
  },

  updateSpan: (index, spanPartial) => {
    set((state) => {
      const newSpans = [...state.bridgeParams.spans];
      newSpans[index] = { ...newSpans[index], ...spanPartial };
      const totalLen = newSpans.reduce((sum, s) => sum + s.span_length, 0);
      const newParams = {
        ...state.bridgeParams,
        spans: newSpans,
        bridge_length: totalLen
      };
      const newBreakdown = calculateBridgeCost(newParams);
      return {
        bridgeParams: newParams,
        costBreakdown: newBreakdown
      };
    });
  },

  addSpan: (type = 'MODIFIED_PSC_BEAM', length = 45) => {
    set((state) => {
      const newSpans = [...state.bridgeParams.spans];
      const newIndex = newSpans.length + 1;
      newSpans.push({
        id: `span_${Date.now()}`,
        span_index: newIndex,
        span_length: length,
        type,
        foundation: 'PILE'
      });
      const totalLen = newSpans.reduce((sum, s) => sum + s.span_length, 0);
      const newParams = {
        ...state.bridgeParams,
        spans: newSpans,
        bridge_length: totalLen
      };
      return {
        bridgeParams: newParams,
        costBreakdown: calculateBridgeCost(newParams)
      };
    });
  },

  removeSpan: (index) => {
    set((state) => {
      if (state.bridgeParams.spans.length <= 1) return state;
      const newSpans = state.bridgeParams.spans
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, span_index: i + 1 }));
      const totalLen = newSpans.reduce((sum, s) => sum + s.span_length, 0);
      const newParams = {
        ...state.bridgeParams,
        spans: newSpans,
        bridge_length: totalLen
      };
      return {
        bridgeParams: newParams,
        costBreakdown: calculateBridgeCost(newParams)
      };
    });
  },

  updatePier: (index, pierPartial) => {
    set((state) => {
      const newPiers = [...state.bridgeParams.piers];
      newPiers[index] = { ...newPiers[index], ...pierPartial };
      const newParams = { ...state.bridgeParams, piers: newPiers };
      return {
        bridgeParams: newParams,
        costBreakdown: calculateBridgeCost(newParams)
      };
    });
  },

  addPier: () => {
    set((state) => {
      const newPiers = [...state.bridgeParams.piers];
      const nextNum = newPiers.length + 1;
      newPiers.push({
        id: `pier_${Date.now()}`,
        name: `P${nextNum}`,
        height: 18,
        diameter: 2.8,
        type: 'T_PIER',
        foundation: 'PILE',
        pile_len: 15,
        pile_count: 50
      });
      const newParams = { ...state.bridgeParams, piers: newPiers };
      return {
        bridgeParams: newParams,
        costBreakdown: calculateBridgeCost(newParams)
      };
    });
  },

  removePier: (index) => {
    set((state) => {
      if (state.bridgeParams.piers.length <= 1) return state;
      const newPiers = state.bridgeParams.piers
        .filter((_, i) => i !== index)
        .map((p, i) => ({ ...p, name: `P${i + 1}` }));
      const newParams = { ...state.bridgeParams, piers: newPiers };
      return {
        bridgeParams: newParams,
        costBreakdown: calculateBridgeCost(newParams)
      };
    });
  },

  updateAbutment: (index, abutPartial) => {
    set((state) => {
      const newAbuts = [...state.bridgeParams.abutments];
      newAbuts[index] = { ...newAbuts[index], ...abutPartial };
      const newParams = { ...state.bridgeParams, abutments: newAbuts };
      return {
        bridgeParams: newParams,
        costBreakdown: calculateBridgeCost(newParams)
      };
    });
  },

  setPileMethod: (method) => {
    set((state) => {
      const newParams = { ...state.bridgeParams, pile_method: method };
      return {
        bridgeParams: newParams,
        costBreakdown: calculateBridgeCost(newParams)
      };
    });
  },

  applyBatchPileParams: ({ abutPileLen, abutPileCount, pierPileLen, pierPileCount, foundationType }) => {
    set((state) => {
      const newAbuts = state.bridgeParams.abutments.map((a) => ({
        ...a,
        foundation: foundationType !== undefined ? foundationType : a.foundation,
        pile_len: abutPileLen !== undefined ? abutPileLen : a.pile_len,
        pile_count: abutPileCount !== undefined ? abutPileCount : a.pile_count
      }));

      const newPiers = state.bridgeParams.piers.map((p) => ({
        ...p,
        foundation: foundationType !== undefined ? foundationType : p.foundation,
        pile_len: pierPileLen !== undefined ? pierPileLen : p.pile_len,
        pile_count: pierPileCount !== undefined ? pierPileCount : p.pile_count
      }));

      const newParams = {
        ...state.bridgeParams,
        abutments: newAbuts,
        piers: newPiers
      };

      return {
        bridgeParams: newParams,
        costBreakdown: calculateBridgeCost(newParams)
      };
    });
  },

  setProjectName: (name) => {
    set((state) => {
      const updatedParams = { ...state.bridgeParams, name };
      return {
        projectName: name,
        bridgeParams: updatedParams
      };
    });
  },

  saveNewAlternative: (customName) => {
    set((state) => {
      const nextIndex = state.alternatives.length + 1;
      const defaultName = `대안 ${nextIndex}`;
      const name = (customName && customName.trim()) || state.bridgeParams.name || defaultName;

      const newId = `alt_${Date.now()}`;
      const paramsCopy: BridgeParameters = JSON.parse(JSON.stringify(state.bridgeParams));
      paramsCopy.id = newId;
      paramsCopy.name = name;
      const breakdown = calculateBridgeCost(paramsCopy);

      const colorPalette = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#64748B'];
      const color = colorPalette[state.alternatives.length % colorPalette.length];

      const newAlt: AlternativeScenario = {
        id: newId,
        name,
        bridgeParams: paramsCopy,
        costBreakdown: breakdown,
        color,
        isBase: false
      };

      return {
        alternatives: [...state.alternatives, newAlt],
        activeAlternativeId: newId,
        bridgeParams: paramsCopy,
        costBreakdown: breakdown
      };
    });
  },

  saveCurrentAlternative: (customName) => {
    const state = get();
    if (!state.activeAlternativeId || state.alternatives.length === 0) {
      get().saveNewAlternative(customName);
      return;
    }

    set((state) => {
      const currentIdx = state.alternatives.findIndex((a) => a.id === state.activeAlternativeId);
      if (currentIdx === -1) {
        return state;
      }

      const paramsCopy = JSON.parse(JSON.stringify(state.bridgeParams));
      if (customName && customName.trim()) {
        paramsCopy.name = customName.trim();
      }
      const breakdown = calculateBridgeCost(paramsCopy);

      const updatedAlts = [...state.alternatives];
      updatedAlts[currentIdx] = {
        ...updatedAlts[currentIdx],
        name: paramsCopy.name || updatedAlts[currentIdx].name,
        bridgeParams: paramsCopy,
        costBreakdown: breakdown
      };

      return {
        alternatives: updatedAlts,
        bridgeParams: paramsCopy,
        costBreakdown: breakdown
      };
    });
  },

  updateAlternativeName: (id, name) => {
    set((state) => {
      const updatedAlts = state.alternatives.map((a) => (a.id === id ? { ...a, name } : a));
      let updatedParams = state.bridgeParams;
      if (state.activeAlternativeId === id) {
        updatedParams = { ...state.bridgeParams, name };
      }
      return {
        alternatives: updatedAlts,
        bridgeParams: updatedParams
      };
    });
  },

  registerCurrentAsAlternative: (customName) => {
    get().saveNewAlternative(customName);
  },

  updateCurrentAlternative: () => {
    get().saveCurrentAlternative();
  },

  saveCurrentAsAlternative: (name, color = '#6366F1') => {
    get().saveNewAlternative(name);
  },

  loadAlternative: (id) => {
    const state = get();
    const alt = state.alternatives.find((a) => a.id === id);
    if (!alt) return;
    const paramsCopy = JSON.parse(JSON.stringify(alt.bridgeParams));
    set({
      bridgeParams: paramsCopy,
      activeAlternativeId: id,
      costBreakdown: calculateBridgeCost(paramsCopy)
    });
  },

  deleteAlternative: (id) => {
    set((state) => {
      const filtered = state.alternatives.filter((a) => a.id !== id);
      if (filtered.length === 0) {
        return {
          alternatives: [],
          activeAlternativeId: null
        };
      }
      const nextActive = filtered[0].id;
      return {
        alternatives: filtered,
        activeAlternativeId: nextActive,
        bridgeParams: JSON.parse(JSON.stringify(filtered[0].bridgeParams)),
        costBreakdown: calculateBridgeCost(filtered[0].bridgeParams)
      };
    });
  },

  loadBenchmarkPreset: (benchmarkId) => {
    const allBm = [...PRESET_BENCHMARKS, ...get().customBenchmarks];
    const bm = allBm.find((b) => b.id === benchmarkId);
    if (!bm) return;
    const paramsCopy = JSON.parse(JSON.stringify(bm.bridgeParams));
    const breakdown = calculateBridgeCost(paramsCopy);
    
    set((state) => {
      // 대안 목록에 이미 없으면 추가
      const exists = state.alternatives.some((a) => a.id === bm.id);
      let newAlts = state.alternatives;
      if (!exists) {
        newAlts = [
          ...state.alternatives,
          {
            id: bm.id,
            name: bm.name,
            bridgeParams: paramsCopy,
            costBreakdown: breakdown,
            color: '#10B981'
          }
        ];
      }
      return {
        bridgeParams: paramsCopy,
        activeAlternativeId: bm.id,
        alternatives: newAlts,
        costBreakdown: breakdown
      };
    });
  },

  loadAllBenchmarks: () => {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6'];
    const benchmarkAlts: AlternativeScenario[] = PRESET_BENCHMARKS.map((bm, idx) => {
      const params = JSON.parse(JSON.stringify(bm.bridgeParams));
      return {
        id: bm.id,
        name: bm.name,
        bridgeParams: params,
        costBreakdown: calculateBridgeCost(params),
        color: colors[idx % colors.length],
        isBase: idx === 0
      };
    });
    set({
      alternatives: benchmarkAlts,
      activeAlternativeId: benchmarkAlts[0].id,
      bridgeParams: JSON.parse(JSON.stringify(benchmarkAlts[0].bridgeParams)),
      costBreakdown: calculateBridgeCost(benchmarkAlts[0].bridgeParams)
    });
  },

  addBenchmarkFromAlternative: (altId) => {
    set((state) => {
      const targetAlt = state.alternatives.find((a) => a.id === altId);
      if (!targetAlt) return state;

      const exists = state.customBenchmarks.some(
        (cb) => cb.id === `bm_${targetAlt.id}` || cb.name === `[실적] ${targetAlt.name}`
      );
      if (exists) return state;

      const directBillion = Math.round((targetAlt.costBreakdown.direct_cost_total / 100000000) * 100) / 100;
      const totalBillion = Math.round((targetAlt.costBreakdown.total_construction_cost / 100000000) * 100) / 100;
      const unitCostTenThousand = Math.round(targetAlt.costBreakdown.unit_cost_per_m2 / 10000);

      const newBenchmark: BenchmarkItem = {
        id: `bm_${targetAlt.id}`,
        name: `[실적] ${targetAlt.name}`,
        location: state.projectName || '계획 프로젝트',
        referenceDirectCostBillion: directBillion,
        referenceTotalCostBillion: totalBillion,
        referenceUnitCostPerM2TenThousand: unitCostTenThousand,
        description: `L=${targetAlt.bridgeParams.bridge_length}m, B=${targetAlt.bridgeParams.bridge_width}m (${targetAlt.bridgeParams.spans.length}경간 ${targetAlt.bridgeParams.spans[0]?.type || ''})`,
        bridgeParams: JSON.parse(JSON.stringify(targetAlt.bridgeParams)),
        isCustom: true
      };

      return {
        customBenchmarks: [...state.customBenchmarks, newBenchmark]
      };
    });
  },

  resetToInitialState: () => {
    set(createDefaultCleanState());
  },

  setViewMode: (mode) => set({ selectedViewMode: mode }),
  setCameraPreset: (preset) => set({ cameraPreset: preset }),
  setActiveTab: (tab) => set({ activeTab: tab })
}));
