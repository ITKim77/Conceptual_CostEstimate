// src/components/input/ParametricInputPanel.tsx
import React, { useState, useEffect } from 'react';
import { useBridgeStore } from '../../store/useBridgeStore';
import { SSOTInput, SSOTSelect, SSOTConstant } from '../common/SSOTFields';
import { SUPERSTRUCTURE_CATALOG, PILE_UNIT_PRICES, REV04_CONSTANTS } from '../../domain/constants/rev04_database';
import { SuperstructureType, PileMethod, FoundationType } from '../../domain/models/bridge';
import {
  Plus,
  Trash2,
  Sliders,
  ShieldAlert,
  Cpu,
  Save,
  CheckCircle2,
  Wrench,
  AlertCircle,
  FolderPlus
} from 'lucide-react';

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
    setPileMethod,
    applyBatchPileParams,
    // 대안 관리 액션 (원안/대안 구분 없음)
    alternatives,
    activeAlternativeId,
    saveNewAlternative,
    saveCurrentAlternative,
    costBreakdown
  } = useBridgeStore();

  const activeAlt = alternatives.find((a) => a.id === activeAlternativeId);

  // 대안명 입력 상태: 현재 활성 대안의 이름 또는 기본 제원 이름으로 동기화
  const [altName, setAltName] = useState(
    activeAlt ? activeAlt.name : bridgeParams.name || `대안 ${alternatives.length + 1}`
  );

  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    if (activeAlt) {
      setAltName(activeAlt.name);
    } else {
      setAltName(bridgeParams.name || `대안 ${alternatives.length + 1}`);
    }
  }, [activeAlternativeId, activeAlt, alternatives.length, bridgeParams.name]);

  const showFeedback = (msg: string) => {
    setSaveMessage(msg);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  // 1. 현재 대안에 저장 (값 변경 후 반영을 위한 별도 저장 버튼)
  const handleSaveCurrent = () => {
    const finalName = altName.trim() || `대안 ${alternatives.length || 1}`;
    saveCurrentAlternative(finalName);
    showFeedback(`'${finalName}'에 변경 제원이 저장·반영되었습니다.`);
  };

  // 2. 새 대안으로 저장 (현재 제원으로 새 대안 생성)
  const handleSaveAsNew = () => {
    const defaultNextName = `대안 ${alternatives.length + 1}`;
    // 만약 현재 활성 대안과 같은 이름이면 새 번호 부여
    let finalName = altName.trim();
    if (!finalName || (activeAlt && finalName === activeAlt.name)) {
      finalName = defaultNextName;
    }
    saveNewAlternative(finalName);
    showFeedback(`'${finalName}'이(가) 새로운 대안으로 저장되었습니다.`);
  };

  // 말뚝 일괄 설정 상태
  const [batchAbutLen, setBatchAbutLen] = useState<number>(15);
  const [batchAbutCount, setBatchAbutCount] = useState<number>(40);
  const [batchPierLen, setBatchPierLen] = useState<number>(15);
  const [batchPierCount, setBatchPierCount] = useState<number>(50);
  const [batchFoundation, setBatchFoundation] = useState<FoundationType>('PILE');

  const handleApplyBatchPiles = () => {
    applyBatchPileParams({
      abutPileLen: batchAbutLen,
      abutPileCount: batchAbutCount,
      pierPileLen: batchPierLen,
      pierPileCount: batchPierCount,
      foundationType: batchFoundation
    });
    showFeedback('모든 하부구조에 말뚝 제원이 일괄 적용되었습니다.');
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden">
      {/* Panel Header & SSOT Rules Banner */}
      <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
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
          className={`flex-1 py-1.5 rounded-lg transition-all ${
            activeTab === 'basic'
              ? 'bg-white text-red-600 shadow-sm font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          기본 제원
        </button>
        <button
          onClick={() => setActiveTab('spans')}
          className={`flex-1 py-1.5 rounded-lg transition-all ${
            activeTab === 'spans'
              ? 'bg-white text-red-600 shadow-sm font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          경간 구성 ({bridgeParams.spans.length})
        </button>
        <button
          onClick={() => setActiveTab('substructure')}
          className={`flex-1 py-1.5 rounded-lg transition-all ${
            activeTab === 'substructure'
              ? 'bg-white text-red-600 shadow-sm font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          교대·교각
        </button>
        <button
          onClick={() => setActiveTab('piles')}
          className={`flex-1 py-1.5 rounded-lg transition-all ${
            activeTab === 'piles'
              ? 'bg-white text-red-600 shadow-sm font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          기초·말뚝 ({bridgeParams.piers.length + bridgeParams.abutments.length}개소)
        </button>
      </div>

      {/* Tab Contents Container (Scrollable) */}
      <div className="p-4 flex-1 overflow-y-auto space-y-4">
        {/* 1. 기본 제원 탭 (프로젝트명/대안명 중복 인풋 제거: 하단 및 헤더에서 단 1곳씩 정의) */}
        {activeTab === 'basic' && (
          <div className="space-y-4">
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
                  <div key={abut.id} className="p-2.5 rounded-lg border-2 border-red-200 bg-red-50/10 space-y-2">
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
                    <div className="pt-1 border-t border-red-100 flex items-center justify-between text-[11px] text-slate-600">
                      <span>기초: {abut.foundation === 'PILE' ? '강관말뚝' : abut.foundation === 'DIRECT' ? '직접기초' : '매스콘크리트'}</span>
                      {abut.foundation === 'PILE' && (
                        <span className="font-semibold text-red-700">
                          {abut.pile_count}본 × {abut.pile_len}m
                        </span>
                      )}
                    </div>
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
                    <div className="pt-1 border-t border-red-100 flex items-center justify-between text-[11px] text-slate-600">
                      <span>기초: {pier.foundation === 'PILE' ? '강관말뚝' : pier.foundation === 'DIRECT' ? '직접기초' : '매스콘크리트'}</span>
                      {pier.foundation === 'PILE' && (
                        <span className="font-semibold text-red-700">
                          {pier.pile_count}본 × {pier.pile_len}m
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 4. 기초·말뚝 제원 탭 */}
        {activeTab === 'piles' && (
          <div className="space-y-4">
            {/* 산정 근거 안내 박스 */}
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs space-y-1 text-slate-700">
              <div className="flex items-center gap-1.5 font-bold text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span>강관말뚝 (D508×12mm) 기초공사비 산정 기준 (REV.04)</span>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-600">
                기초공비 = <span className="font-mono font-bold text-red-700">∑(말뚝 본수 × 말뚝 길이 L)</span> × <span className="font-mono text-blue-700">공법별 단가(원/m)</span>
                <br />
                교대 및 교각의 <strong>지지층 심도(말뚝 길이)</strong>와 <strong>폭원/하중별 소요 본수</strong>를 아래에서 직접 설정할 수 있습니다.
              </p>
            </div>

            {/* 시공 공법 선택 */}
            <SSOTSelect
              label="강관말뚝 (D508) 시공 공법 선택"
              value={bridgeParams.pile_method}
              onChange={(e) => setPileMethod(e.target.value as PileMethod)}
            >
              {Object.entries(PILE_UNIT_PRICES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.name} ({v.unitRate.toLocaleString()}원/m) - {v.desc}
                </option>
              ))}
            </SSOTSelect>

            {/* 일괄 적용 도구 */}
            <div className="p-3 rounded-lg border border-indigo-200 bg-indigo-50/40 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-bold text-indigo-900">
                <span className="flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                  말뚝 제원 일괄 설정 도구
                </span>
                <button
                  onClick={handleApplyBatchPiles}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-bold shadow-xs transition-all"
                >
                  전체 하부구조 일괄 적용
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">교대(A1,A2) 표준 길이 / 본수</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="number"
                      value={batchAbutLen}
                      onChange={(e) => setBatchAbutLen(parseFloat(e.target.value) || 0)}
                      className="px-2 py-1 border border-slate-300 rounded text-xs"
                      placeholder="길이(m)"
                    />
                    <input
                      type="number"
                      value={batchAbutCount}
                      onChange={(e) => setBatchAbutCount(parseInt(e.target.value) || 0)}
                      className="px-2 py-1 border border-slate-300 rounded text-xs"
                      placeholder="본수(본)"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">교각(P1~Pn) 표준 길이 / 본수</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      type="number"
                      value={batchPierLen}
                      onChange={(e) => setBatchPierLen(parseFloat(e.target.value) || 0)}
                      className="px-2 py-1 border border-slate-300 rounded text-xs"
                      placeholder="길이(m)"
                    />
                    <input
                      type="number"
                      value={batchPierCount}
                      onChange={(e) => setBatchPierCount(parseInt(e.target.value) || 0)}
                      className="px-2 py-1 border border-slate-300 rounded text-xs"
                      placeholder="본수(본)"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 교대별 개별 상세 제원 입력 */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-800">교대(A1, A2) 기초 상세 제원</span>
              <div className="space-y-2">
                {bridgeParams.abutments.map((abut, aIdx) => (
                  <div key={abut.id} className="p-3 rounded-lg border-2 border-red-200 bg-red-50/10 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-red-700">
                      <span>{abut.name} 교대 기초</span>
                      <span className="text-[11px] font-mono text-blue-700">
                        {abut.foundation === 'PILE'
                          ? `총연장: ${(abut.pile_len * abut.pile_count).toLocaleString()}m (${Math.round((abut.pile_len * abut.pile_count * (PILE_UNIT_PRICES[bridgeParams.pile_method]?.unitRate || 245000)) / 1000000)}백만원)`
                          : abut.foundation === 'DIRECT' ? '직접기초 (말뚝공비 없음)' : '매스콘크리트'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <SSOTSelect
                        label="기초 형식"
                        value={abut.foundation}
                        onChange={(e) => updateAbutment(aIdx, { foundation: e.target.value as FoundationType })}
                      >
                        <option value="PILE">강관말뚝기초 (PILE)</option>
                        <option value="DIRECT">직접기초 (DIRECT)</option>
                        <option value="MASS_CONCRETE">매스콘크리트</option>
                      </SSOTSelect>

                      {abut.foundation === 'PILE' ? (
                        <>
                          <SSOTInput
                            label="말뚝 길이 (L)"
                            unit="m"
                            type="number"
                            min="5"
                            max="60"
                            step="1"
                            value={abut.pile_len}
                            onChange={(e) => updateAbutment(aIdx, { pile_len: parseFloat(e.target.value) || 0 })}
                            helperText="지지층 심도"
                          />
                          <SSOTInput
                            label="말뚝 본수 (N)"
                            unit="본"
                            type="number"
                            min="1"
                            max="150"
                            step="1"
                            value={abut.pile_count}
                            onChange={(e) => updateAbutment(aIdx, { pile_count: parseInt(e.target.value) || 0 })}
                            helperText="개소당 소요 본수"
                          />
                        </>
                      ) : (
                        <div className="col-span-2 flex items-center justify-center p-2 text-xs text-slate-500 bg-slate-50 rounded border border-slate-200">
                          직접/매스기초 적용 시 강관말뚝 공비 미발생
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 교각별 개별 상세 제원 입력 */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-800">교각(P1, P2...) 기초 상세 제원</span>
              <div className="space-y-2">
                {bridgeParams.piers.map((pier, pIdx) => (
                  <div key={pier.id} className="p-3 rounded-lg border-2 border-red-200 bg-red-50/10 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-red-700">
                      <span>{pier.name} 교각 기초</span>
                      <span className="text-[11px] font-mono text-blue-700">
                        {pier.foundation === 'PILE'
                          ? `총연장: ${(pier.pile_len * pier.pile_count).toLocaleString()}m (${Math.round((pier.pile_len * pier.pile_count * (PILE_UNIT_PRICES[bridgeParams.pile_method]?.unitRate || 245000)) / 1000000)}백만원)`
                          : pier.foundation === 'DIRECT' ? '직접기초 (말뚝공비 없음)' : '매스콘크리트'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <SSOTSelect
                        label="기초 형식"
                        value={pier.foundation}
                        onChange={(e) => updatePier(pIdx, { foundation: e.target.value as FoundationType })}
                      >
                        <option value="PILE">강관말뚝기초 (PILE)</option>
                        <option value="DIRECT">직접기초 (DIRECT)</option>
                        <option value="MASS_CONCRETE">매스콘크리트</option>
                      </SSOTSelect>

                      {pier.foundation === 'PILE' ? (
                        <>
                          <SSOTInput
                            label="말뚝 길이 (L)"
                            unit="m"
                            type="number"
                            min="5"
                            max="70"
                            step="1"
                            value={pier.pile_len}
                            onChange={(e) => updatePier(pIdx, { pile_len: parseFloat(e.target.value) || 0 })}
                            helperText="지지층 심도"
                          />
                          <SSOTInput
                            label="말뚝 본수 (N)"
                            unit="본"
                            type="number"
                            min="1"
                            max="200"
                            step="1"
                            value={pier.pile_count}
                            onChange={(e) => updatePier(pIdx, { pile_count: parseInt(e.target.value) || 0 })}
                            helperText="기당 소요 본수"
                          />
                        </>
                      ) : (
                        <div className="col-span-2 flex items-center justify-center p-2 text-xs text-slate-500 bg-slate-50 rounded border border-slate-200">
                          직접/매스기초 적용 시 강관말뚝 공비 미발생
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 고정 단가 안내 */}
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-slate-600" />
                기초공 및 제잡비 표준 상수 (REV.04 Black)
              </span>
              <div className="space-y-1">
                <SSOTConstant
                  label="하부공 가시설비"
                  value={REV04_CONSTANTS.TEMP_FACILITY_PER_PIER}
                  unit="원/기"
                  description="교각 터파기 흙막이 가시설 일괄 반영"
                />
                <SSOTConstant
                  label="강관말뚝 규격"
                  value={508}
                  unit="mm"
                  description="강관말뚝 D508×12mm 고속도로 표준 적용"
                />
                <SSOTConstant
                  label="표준 매스콘크리트 단가"
                  value={REV04_CONSTANTS.MASS_CONCRETE_M3}
                  unit="원/m³"
                  description="직접기초 심도보강 및 교대 배면 Mass"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 🌟 4. 입력된 제원 아래 '새 대안으로 저장' 및 '저장' 버튼 영역 (사용자 요구사항 1~4 완벽 부합) */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 space-y-2.5 shrink-0">
        {/* 알림 메시지 */}
        {saveMessage && (
          <div className="flex items-center gap-1.5 p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{saveMessage}</span>
          </div>
        )}

        <div className="space-y-1">
          {/* 대안명 단일 입력 필드 (SSOT Red: 시스템 전체에서 대안명은 오직 여기서만 입력!) */}
          <SSOTInput
            label="대안 명칭 (단일 정의 SSOT)"
            value={altName}
            onChange={(e) => {
              setAltName(e.target.value);
              updateBridgeParams({ name: e.target.value });
            }}
            placeholder={`예: 대안 ${alternatives.length || 1} (PSC 빔교)`}
            helperText="현재 제원의 명칭을 지정합니다. 변경 후 아래 [저장]을 눌러야 반영됩니다."
          />
        </div>

        {/* 액션 버튼 군 */}
        <div className="flex items-center gap-2 pt-1">
          {/* 1. 저장 버튼: 현재 선택된 대안에 수정된 제원과 대안명을 반영하여 저장 */}
          <button
            onClick={handleSaveCurrent}
            className="flex-1 py-2 px-3 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center justify-center gap-1.5 transition-all"
            title="현재 선택된 대안에 위에서 수정한 제원과 이름을 저장·반영합니다."
          >
            <Save className="w-4 h-4" />
            <span>{activeAlt ? `'${activeAlt.name}' 변경사항 저장` : '현재 제원 저장'}</span>
          </button>

          {/* 2. 새 대안으로 저장: 현재 제원으로 새로운 대안을 추가 생성하여 저장 */}
          <button
            onClick={handleSaveAsNew}
            className="py-2 px-3.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-1.5 transition-all whitespace-nowrap"
            title="현재 입력된 제원으로 새 대안을 생성하여 보관합니다."
          >
            <FolderPlus className="w-4 h-4" />
            <span>새 대안으로 저장</span>
          </button>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
          <span>현재 산출 총공사비: <strong className="text-slate-800 font-mono">{(costBreakdown.total_construction_cost / 100000000).toFixed(1)}억원</strong></span>
          <span className="text-[10px] text-slate-400">등록된 대안: {alternatives.length}개</span>
        </div>
      </div>
    </div>
  );
};
