// src/components/analytics/AlternativeStatusBar.tsx
import React from 'react';
import { useBridgeStore } from '../../store/useBridgeStore';
import {
  GitBranch,
  Trash2,
  Bookmark,
  Info,
  CheckCircle2
} from 'lucide-react';

export const AlternativeStatusBar: React.FC = () => {
  const {
    activeAlternativeId,
    alternatives,
    loadAlternative,
    deleteAlternative,
    costBreakdown
  } = useBridgeStore();

  const currentTotalBillion = (costBreakdown.total_construction_cost / 100000000).toFixed(2);
  const activeAlt = alternatives.find((a) => a.id === activeAlternativeId);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-3.5 space-y-2.5 print:hidden">
      {/* 1. 상단: 대안 현황 요약 정보 헤더 (입력란 없음: SSOT 준수) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="text-xs font-bold text-slate-800">
            대안 추가 현황 ({alternatives.length}개 보관 중)
          </span>
          {activeAlt ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
              <CheckCircle2 className="w-3 h-3 text-indigo-600" />
              현재 선택: {activeAlt.name}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              <Info className="w-3 h-3 text-amber-600" />
              선택된 대안 없음 (신규 제원)
            </span>
          )}
        </div>

        <div className="text-[11px] text-slate-500 font-medium">
          현재 표시 중인 교량 공사비: <span className="font-mono font-bold text-indigo-600">{currentTotalBillion}억원</span>
        </div>
      </div>

      {/* 2. 대안 등록 현황 칩 리스트 (Chips: 클릭 시 로드, 삭제 버튼 제공) */}
      <div className="flex flex-wrap items-center gap-2">
        {alternatives.length === 0 ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-400 py-1">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>등록된 대안이 없습니다. 아래 제원 입력 패널에서 제원을 설정한 후 <strong>'새 대안으로 저장'</strong>을 누르세요.</span>
          </div>
        ) : (
          alternatives.map((alt) => {
            const isActive = alt.id === activeAlternativeId;
            const altBillion = (alt.costBreakdown.total_construction_cost / 100000000).toFixed(1);

            return (
              <div
                key={alt.id}
                onClick={() => loadAlternative(alt.id)}
                className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all border shadow-2xs ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-200 ring-offset-1'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                }`}
                title="클릭하여 이 대안의 제원을 아래 입력 패널에 불러옵니다."
              >
                <Bookmark className={`w-3.5 h-3.5 ${isActive ? 'text-amber-300 fill-amber-300' : 'text-slate-400'}`} />
                <span>{alt.name}</span>
                <span
                  className={`text-[10px] font-mono px-1 rounded ${
                    isActive ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {altBillion}억
                </span>

                {/* 삭제 버튼 */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`'${alt.name}' 대안을 삭제하시겠습니까?`)) {
                      deleteAlternative(alt.id);
                    }
                  }}
                  className={`p-0.5 rounded transition-colors ml-0.5 ${
                    isActive
                      ? 'text-indigo-200 hover:bg-red-500 hover:text-white'
                      : 'text-slate-400 hover:bg-red-50 hover:text-red-600'
                  }`}
                  title="이 대안 삭제"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* 안내 문구 */}
      {alternatives.length > 0 && (
        <p className="text-[11px] text-slate-400 pt-1 flex items-center gap-1">
          <span>💡 <strong>이용 안내:</strong> 대안 칩을 클릭하면 해당 제원이 아래 입력 패널에 로드됩니다. 값을 변경한 후 반영하려면 패널 아래의 <strong>[저장]</strong> 버튼을 누르세요.</span>
        </p>
      )}
    </div>
  );
};
