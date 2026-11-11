// src/components/input/ParametricInputPanel.tsx
import React from 'react';
import { useBridgeStore } from '../../store/useBridgeStore';
import { SSOTInput, SSOTSelect, SSOTConstant } from '../common/SSOTFields';
import { SUPERSTRUCTURE_CATALOG, PILE_UNIT_PRICES, REV04_CONSTANTS } from '../../domain/constants/rev04_database';
import { SuperstructureType, PileMethod } from '../../domain/models/bridge';
import { Plus, Trash2, Layers, Sliders, ShieldAlert, Cpu } from 'lucide-react';

export const ParametricInputPanel: React.FC = () => {
  const {
    bridgeParams,
    activeTab,
    setActiveTab,
    updateBridgeParams,
    updateSpan,
    addSpan,
    removeSpan,
    updatePier,
    addPier,
    removePier,
    updateAbutment,
    setPileMethod
  } = useBridgeStore();

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
      {/* Panel Header & SSOT Rules Banner */}
      <div className="p-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Sliders className="w-4 h-4 text-red-500" />
            파라메트릭 제원 입력 패널 (SSOT)
          </h2>
          <p className="text-[11px] text-slate-500">
            <span className="text-red-600 font-bold">빨간색 테두리</span> 필드는 시스템 원천 입력값으로 단 한 곳에서만 정의됩니다.
          </p>
        </div>
        <div className="flex items-center gap-1 bg-red-50 text-red-700 px-2 py-1 rounded text-[10px] font-bold border border-red-200">
          <ShieldAlert className="w-3 h-3 text-red-500" />
          단일 위치 정의 준수
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-100/60 p-1 gap-1 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('basic')}
          className={`flex-1 py-1.5 rounded-lg transition-all ${activeTab === 'basic' ? 'bg-white text-red-600 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
        >
          기본 제원
        </button>
        <button
          onClick={() => setActiveTab('spans')}
          className={`flex-1 py-1.5 rounded-lg transition-all ${activeTab === 'spans' ? 'bg-white text-red-600 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
        >
          경간 구성 ({bridgeParams.spans.length})
        </button>
        <button
          onClick={() => setActiveTab('substructure')}
          className={`flex-1 py-1.5 rounded-lg transition-all ${activeTab === 'substructure' ? 'bg-white text-red-600 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
        >
          교대·교각
        </button>
        <button
          onClick={() => setActiveTab('piles')}
          className={`flex-1 py-1.5 rounded-lg transition-all ${activeTab === 'piles' ? 'bg-white text-red-600 shadow-sm font-bold' : 'text-slate-600 hover:text-slate-900'}`}
        >
          기초·제잡비
        </button>
      </div>

      {/* Tab Contents Container */}
      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {/* 1. 기본 제원 탭 */}
        {activeTab === 'basic' && (
          <div className="space-y-4">
            <SSOTInput
              label="교량 프로젝트/대안 명칭"
              value={bridgeParams.name}
              onChange={(e) => updateBridgeParams({ name: e.target.value })}
              placeholder="예: 연축교 고가차도 대안 1안"
            />

            <div className="grid grid-cols-2 gap-3">
              <SSOTInput
                label="교량 총연장 (L)"
                unit="m"
                type="number"
                min="10"
                max="3000"
                step="1"
                value={bridgeParams.bridge_length}
                onChange={(e) => updateBridgeParams({ bridge_length: parseFloat(e.target.value) || 0 })}
                helperText="경간 합산 시 자동 동기화"
              />
              <SSOTInput
                label="상부 전폭원 (B)"
                unit="m"
                type="number"
                min="6"
                max="50"
                step="0.1"
                value={bridgeParams.bridge_width}
                onChange={(e) => updateBridgeParams({ bridge_width: parseFloat(e.target.value) || 0 })}
                helperText="왕복 4차로 표준 24~26m"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <SSOTInput
                label="교량 사각 (Skew Angle)"
                unit="도 (°)"
                type="number"
                min="0"
                max="60"
                step="1"
                value={bridgeParams.skew_angle}
                onChange={(e) => updateBridgeParams({ skew_angle: parseFloat(e.target.value) || 0 })}
                helperText="20도 이상 시 상부공 4% 할증 자동"
              />
              <SSOTInput
                label="간접비/제잡비율"
                unit="비율"
                type="number"
                min="0.30"
                max="0.55"
                step="0.001"
                value={bridgeParams.markup_rate}
                onChange={(e) => updateBridgeParams({ markup_rate: parseFloat(e.target.value) || 0.40 })}
                helperText="고속도로 표준 40.0% ~ 43.9%"
              />
            </div>

            <SSOTInput
              label="현재 강판 원자재 시세"
              unit="원/톤"
              type="number"
              min="500000"
              max="2000000"
              step="10000"
              value={bridgeParams.steel_price_ton}
              onChange={(e) => updateBridgeParams({ steel_price_ton: parseFloat(e.target.value) || 715000 })}
              helperText="기준시점: 715,000원 (강재비 비중 35% 연동 보정)"
            />
          </div>
        )}

        {/* 2. 경간 구성 탭 */}
        {activeTab === 'spans' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-bold text-slate-700">개별 경간 배열 및 상부 형식</span>
              <button
                onClick={() => addSpan()}
                className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded text-xs font-bold shadow-sm transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                경간 추가
              </button>
            </div>

            <div className="space-y-2.5">
              {bridgeParams.spans.map((span, idx) => (
                <div
                  key={span.id}
                  className="p-3 rounded-lg border-2 border-red-200 bg-red-50/10 space-y-2 shadow-xs"
                >
                  <div className="flex items-center justify-between text-xs font-bold text-red-700">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-500"></span>
                      #{idx + 1} 경간 ({span.span_length}m)
                    </span>
                    {bridgeParams.spans.length > 1 && (
                      <button
                        onClick={() => removeSpan(idx)}
                        className="text-slate-400 hover:text-red-600 p-1"
                        title="경간 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <SSOTInput
                      label="경간장 (Span Length)"
                      unit="m"
                      type="number"
                      min="10"
                      max="200"
                      step="1"
                      value={span.span_length}
                      onChange={(e) => updateSpan(idx, { span_length: parseFloat(e.target.value) || 0 })}
                    />
                    <SSOTSelect
                      label="상부 구조 형식"
                      value={span.type}
                      onChange={(e) => updateSpan(idx, { type: e.target.value as SuperstructureType })}
                    >
                      {Object.values(SUPERSTRUCTURE_CATALOG).map((cat) => (
                        <option key={cat.code} value={cat.code}>
                          {cat.name}
                        </option>
                      ))}
                    </SSOTSelect>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. 교대·교각 탭 */}
        {activeTab === 'substructure' && (
          <div className="space-y-4">
            {/* 교대 (A1 & A2) */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-800">교대 (Abutments A1, A2)</span>
              <div className="grid grid-cols-2 gap-2">
                {bridgeParams.abutments.map((abut, aIdx) => (
                  <div key={abut.id} className="p-2.5 rounded-lg border-2 border-red-200 bg-red-50/10 space-y-1.5">
                    <span className="text-xs font-bold text-red-600">{abut.name} 교대</span>
                    <SSOTInput
                      label="교대 높이 (H)"
                      unit="m"
                      type="number"
                      min="5"
                      max="15"
                      step="0.5"
                      value={abut.height}
                      onChange={(e) => updateAbutment(aIdx, { height: parseFloat(e.target.value) || 9 })}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 교각 목록 */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">교각 (Piers P1, P2...)</span>
                <button
                  onClick={() => addPier()}
                  className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded text-xs font-bold shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  교각 추가
                </button>
              </div>

              <div className="space-y-2">
                {bridgeParams.piers.map((pier, pIdx) => (
                  <div key={pier.id} className="p-2.5 rounded-lg border-2 border-red-200 bg-red-50/10 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-red-700">
                      <span>{pier.name} 교각</span>
                      {bridgeParams.piers.length > 1 && (
                        <button
                          onClick={() => removePier(pIdx)}
                          className="text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <SSOTInput
                        label="교각 높이 (H)"
                        unit="m"
                        type="number"
                        min="5"
                        max="70"
                        step="0.5"
                        value={pier.height}
                        onChange={(e) => updatePier(pIdx, { height: parseFloat(e.target.value) || 15 })}
                      />
                      <SSOTSelect
                        label="기둥 직경 (D)"
                        value={pier.diameter}
                        onChange={(e) => updatePier(pIdx, { diameter: parseFloat(e.target.value) || 2.8 })}
                      >
                        <option value="2.0">D2.0m</option>
                        <option value="2.3">D2.3m</option>
                        <option value="2.5">D2.5m</option>
                        <option value="2.8">D2.8m (표준)</option>
                        <option value="3.0">D3.0m</option>
                        <option value="3.2">D3.2m</option>
                      </SSOTSelect>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 4. 기초·제잡비 탭 */}
        {activeTab === 'piles' && (
          <div className="space-y-4">
            <SSOTSelect
              label="강관말뚝 (D508) 시공 공법"
              value={bridgeParams.pile_method}
              onChange={(e) => setPileMethod(e.target.value as PileMethod)}
            >
              {Object.entries(PILE_UNIT_PRICES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.name} ({v.unitRate.toLocaleString()}원/m) - {v.desc}
                </option>
              ))}
            </SSOTSelect>

            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-slate-600" />
                시스템 고정 단가 및 가정값 (REV.04 Black)
              </span>
              <div className="space-y-1">
                <SSOTConstant
                  label="하부공 가시설비"
                  value={REV04_CONSTANTS.TEMP_FACILITY_PER_PIER}
                  unit="원/기"
                  description="교각 터파기 흙막이 가시설 일괄 반영"
                />
                <SSOTConstant
                  label="기타공사비율"
                  value={10.0}
                  unit="%"
                  description="직접공사비의 10% 자동 계상"
                />
                <SSOTConstant
                  label="강재비 투입 비중"
                  value={35.0}
                  unit="%"
                  description="강상부 직접공사비 중 강재 순수비중"
                />
                <SSOTConstant
                  label="표준 매스콘크리트 단가"
                  value={REV04_CONSTANTS.MASS_CONCRETE_M3}
                  unit="원/m³"
                  description="교대 배면 및 직접기초 심도보강"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
