// src/components/analytics/AlternativeStatusBar.tsx
import React from 'react';
import { useBridgeStore } from '../../store/useBridgeStore';
import {
  GitBranch,
  Trash2,
  Bookmark,
  Info,
  CheckCircle2,
  FileText
} from 'lucide-react';

export const AlternativeStatusBar: React.FC = () => {
  const {
    activeAlternativeId,
    alternatives,
    loadAlternative,
    deleteAlternative,
    costBreakdown,
    setViewMode
  } = useBridgeStore();

  const currentTotalBillion = (costBreakdown.total_construction_cost / 100000000).toFixed(2);
  const activeAlt = alternatives.find((a) => a.id === activeAlternativeId);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 py-1">
      {/* 좌측: 대안 내비게이션 칩 목록 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 shrink-0 mr-1">
          <GitBranch className="w-4 h-4 text-indigo-600" />
          <span>대안 내비게이션:</span>
        </div>

        {alternatives.length === 0 ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Info className="w-3.5 h-3.5 text-amber-500" />
            <span>등록된 대안 없음 (3D 모델러의 제원 입력 패널에서 <strong>[새 대안으로 저장]</strong>을 실행하세요)</span>
          </div>
        ) : (
          alternatives.map((alt) => {
            const isActive = alt.id === activeAlternativeId;
            const altBillion = (alt.costBreakdown.total_construction_cost / 100000000).toFixed(1);

            return (
              <div
                key={alt.id}
                onClick={() => loadAlternative(alt.id)}
                className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold cursor-pointer transition-all border shadow-2xs ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-200 ring-offset-1'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:border-slate-400'
                }`}
                title="클릭하여 이 대안을 활성화하고 제원을 로드합니다."
              >
                <Bookmark className={`w-3 h-3 ${isActive ? 'text-amber-300 fill-amber-300' : 'text-slate-400'}`} />
                <span>{alt.name}</span>
                <span
                  className={`text-[10px] font-mono px-1 rounded ${
                    isActive ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 text-slate-600'
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

      {/* 우측: 현재 활성 상태 및 공사비 요약 */}
      <div className="flex items-center gap-2 shrink-0 text-xs">
        {activeAlt ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
            <CheckCircle2 className="w-3 h-3 text-indigo-600" />
            선택: {activeAlt.name}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
            신규 제원 편집 중
          </span>
        )}
        <span className="text-[11px] text-slate-500">
          표시 공사비: <strong className="font-mono text-indigo-700">{currentTotalBillion}억원</strong>
        </span>
        <button
          type="button"
          onClick={() => setViewMode('REPORT')}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold shadow-2xs transition-all"
          title="입력된 대안별 BIM 스틸컷 및 쉬운 공사비 분석 보고서(A4 PDF)를 생성합니다."
        >
          <FileText className="w-3.5 h-3.5" />
          <span>보고서 생성 (PDF)</span>
        </button>
      </div>
    </div>
  );
};
