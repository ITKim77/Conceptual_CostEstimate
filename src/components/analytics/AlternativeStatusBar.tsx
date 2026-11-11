// src/components/analytics/AlternativeStatusBar.tsx
import React, { useState, useEffect } from 'react';
import { useBridgeStore } from '../../store/useBridgeStore';
import {
  GitBranch,
  Plus,
  CheckCircle,
  Save,
  Trash2,
  Bookmark,
  Star,
  Info
} from 'lucide-react';

export const AlternativeStatusBar: React.FC = () => {
  const {
    projectName,
    setProjectName,
    bridgeParams,
    activeAlternativeId,
    alternatives,
    registerCurrentAsAlternative,
    updateCurrentAlternative,
    loadAlternative,
    deleteAlternative,
    costBreakdown
  } = useBridgeStore();

  const isBaseRegistered = alternatives.length > 0;
  const currentTotalBillion = (costBreakdown.total_construction_cost / 100000000).toFixed(2);

  // 대안명 입력 상태 (기본값: 원안이 없으면 '원안 (기본 계획안)', 있으면 '비교 N안')
  const defaultSuggestedName = !isBaseRegistered
    ? '원안 (기본 계획안)'
    : `비교 ${alternatives.length}안`;

  const [inputAltName, setInputAltName] = useState(defaultSuggestedName);
  const [isEditingName, setIsEditingName] = useState(false);

  useEffect(() => {
    if (!isEditingName) {
      setInputAltName(!isBaseRegistered ? '원안 (기본 계획안)' : `비교 ${alternatives.length}안`);
    }
  }, [alternatives.length, isBaseRegistered, isEditingName]);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    registerCurrentAsAlternative(inputAltName);
    setIsEditingName(false);
  };

  const activeAlt = alternatives.find((a) => a.id === activeAlternativeId);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3.5 space-y-3 print:hidden">
      {/* 1. 상단: 프로젝트 명 입력 및 등록 상태 안내 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2 flex-1">
          <label className="text-xs font-bold text-red-600 flex items-center gap-1 shrink-0">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            프로젝트 명:
          </label>
          <input
            type="text"
            value={projectName || bridgeParams.name}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="교량 프로젝트 명칭을 입력하세요 (예: OO고속도로 제1교량 계획)"
            className="w-full max-w-md px-2.5 py-1 text-xs font-bold text-slate-900 border-2 border-red-200 rounded-md bg-red-50/20 focus:border-red-600 focus:outline-none"
          />
        </div>

        {/* 원안 결정 상태 뱃지 */}
        <div className="flex items-center gap-2">
          {!isBaseRegistered ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200 animate-pulse">
              <Info className="w-3.5 h-3.5 text-amber-600" />
              대안 미등록 (3D 모델러에서 원안 등록 필요)
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              원안 확정 완료 (총 {alternatives.length}개 대안 등록됨)
            </span>
          )}
        </div>
      </div>

      {/* 2. 대안 등록 현황 칩 리스트 (Chips) */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-700 flex items-center gap-1 shrink-0">
          <GitBranch className="w-3.5 h-3.5 text-indigo-600" />
          대안 추가 현황:
        </span>

        {alternatives.length === 0 ? (
          <span className="text-xs text-slate-400 italic">
            현재 3D 모델러의 설계를 아래 폼에서 '원안'으로 등록하세요.
          </span>
        ) : (
          alternatives.map((alt, idx) => {
            const isActive = alt.id === activeAlternativeId;
            const altBillion = (alt.costBreakdown.total_construction_cost / 100000000).toFixed(1);

            return (
              <div
                key={alt.id}
                onClick={() => loadAlternative(alt.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all border ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                {alt.isBase ? (
                  <Star className={`w-3.5 h-3.5 ${isActive ? 'text-amber-300 fill-amber-300' : 'text-amber-500 fill-amber-500'}`} />
                ) : (
                  <Bookmark className="w-3.5 h-3.5 opacity-70" />
                )}
                <span>{alt.name}</span>
                <span className={`text-[10px] font-mono px-1 rounded ${isActive ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-200/80 text-slate-600'}`}>
                  {altBillion}억
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteAlternative(alt.id);
                  }}
                  className={`p-0.5 rounded hover:bg-red-500 hover:text-white transition-colors ml-0.5 ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}
                  title="이 대안 삭제"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* 3. 3D 모델러 설계안 결정 및 대안 추가 액션 폼 */}
      <form onSubmit={handleRegister} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
          <span className="text-xs font-bold text-slate-700 shrink-0">
            {!isBaseRegistered ? '★ 원안 명칭:' : '+ 새 대안 명칭:'}
          </span>
          <input
            type="text"
            required
            value={inputAltName}
            onChange={(e) => {
              setInputAltName(e.target.value);
              setIsEditingName(true);
            }}
            placeholder={!isBaseRegistered ? '원안 (기본 계획안)' : `비교 ${alternatives.length}안`}
            className="w-full sm:max-w-xs px-2.5 py-1 text-xs font-bold text-slate-900 border border-slate-300 rounded-md bg-white focus:outline-none focus:border-indigo-600"
          />
          <span className="text-[11px] text-slate-500 shrink-0">
            (현재 3D 제원: L={bridgeParams.bridge_length}m / 약 {currentTotalBillion}억원)
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {activeAlt && (
            <button
              type="button"
              onClick={() => updateCurrentAlternative()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-all shadow-2xs"
              title="현재 활성화된 대안을 수정된 3D 제원으로 덮어쓰기"
            >
              <Save className="w-3.5 h-3.5 text-slate-500" />
              <span>현재 대안 갱신</span>
            </button>
          )}

          <button
            type="submit"
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-bold text-white shadow-xs transition-all ${
              !isBaseRegistered
                ? 'bg-amber-500 hover:bg-amber-600'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {!isBaseRegistered ? (
              <>
                <Star className="w-3.5 h-3.5 fill-white" />
                <span>원안으로 등록 (확정)</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>비교안으로 추가</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
