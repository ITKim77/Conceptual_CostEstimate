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
  SuperstructureType
} from '../domain/models/bridge';
import { calculateBridgeCost } from '../domain/engine/cost_calculator';
import { PRESET_BENCHMARKS } from '../domain/constants/rev04_database';

interface BridgeStoreState {
  // 1. [Red] 원천 사용자 입력 상태 (SSOT)
  bridgeParams: BridgeParameters;
  activeAlternativeId: string;
  alternatives: AlternativeScenario[];
  
  // 2. [Blue] 연산 및 인용 파생 상태 (Read-Only)
  costBreakdown: CostBreakdown;

  // 3. UI 조작 상태
  selectedViewMode: '3D' | 'TABLE' | 'ANALYTICS' | 'BENCHMARK';
  cameraPreset: 'iso' | 'elevation' | 'cross' | 'plan';
  activeTab: 'basic' | 'spans' | 'substructure' | 'piles';

  // 4. 액션 (Red 인풋 갱신 및 파생 상태 동기화)
  updateBridgeParams: (partial: Partial<BridgeParameters>) => void;
  updateSpan: (index: number, span: Partial<SpanItem>) => void;
  addSpan: (type?: SuperstructureType, length?: number) => void;
  removeSpan: (index: number) => void;
  updatePier: (index: number, pier: Partial<PierItem>) => void;
  addPier: () => void;
  removePier: (index: number) => void;
  updateAbutment: (index: number, abut: Partial<AbutmentItem>) => void;
  setPileMethod: (method: PileMethod) => void;

  // 대안 관리 액션
  saveCurrentAsAlternative: (name: string, color?: string) => void;
  loadAlternative: (id: string) => void;
  deleteAlternative: (id: string) => void;
  loadBenchmarkPreset: (benchmarkId: string) => void;

  // UI 상태 액션
  setViewMode: (mode: '3D' | 'TABLE' | 'ANALYTICS' | 'BENCHMARK') => void;
  setCameraPreset: (preset: 'iso' | 'elevation' | 'cross' | 'plan') => void;
  setActiveTab: (tab: 'basic' | 'spans' | 'substructure' | 'piles') => void;
}

const initialBenchmark = PRESET_BENCHMARKS[0];
const initialParams: BridgeParameters = JSON.parse(JSON.stringify(initialBenchmark.bridgeParams));
const initialBreakdown = calculateBridgeCost(initialParams);

const initialAlternatives: AlternativeScenario[] = PRESET_BENCHMARKS.map((bm, idx) => {
  const params = JSON.parse(JSON.stringify(bm.bridgeParams));
  const breakdown = calculateBridgeCost(params);
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
  return {
    id: bm.id,
    name: bm.name,
    bridgeParams: params,
    costBreakdown: breakdown,
    color: colors[idx % colors.length],
    isBase: idx === 0
  };
});

export const useBridgeStore = create<BridgeStoreState>((set, get) => ({
  bridgeParams: initialParams,
  activeAlternativeId: initialBenchmark.id,
  alternatives: initialAlternatives,
  costBreakdown: initialBreakdown,
  selectedViewMode: '3D',
  cameraPreset: 'iso',
  activeTab: 'basic',

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

  saveCurrentAsAlternative: (name, color = '#6366F1') => {
    set((state) => {
      const newId = `alt_${Date.now()}`;
      const paramsCopy = JSON.parse(JSON.stringify(state.bridgeParams));
      paramsCopy.id = newId;
      paramsCopy.name = name;
      const breakdown = calculateBridgeCost(paramsCopy);
      const newAlt: AlternativeScenario = {
        id: newId,
        name,
        bridgeParams: paramsCopy,
        costBreakdown: breakdown,
        color
      };
      return {
        alternatives: [...state.alternatives, newAlt],
        activeAlternativeId: newId
      };
    });
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
      if (state.alternatives.length <= 1) return state;
      const filtered = state.alternatives.filter((a) => a.id !== id);
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
    const bm = PRESET_BENCHMARKS.find((b) => b.id === benchmarkId);
    if (!bm) return;
    const paramsCopy = JSON.parse(JSON.stringify(bm.bridgeParams));
    set({
      bridgeParams: paramsCopy,
      activeAlternativeId: bm.id,
      costBreakdown: calculateBridgeCost(paramsCopy)
    });
  },

  setViewMode: (mode) => set({ selectedViewMode: mode }),
  setCameraPreset: (preset) => set({ cameraPreset: preset }),
  setActiveTab: (tab) => set({ activeTab: tab })
}));
