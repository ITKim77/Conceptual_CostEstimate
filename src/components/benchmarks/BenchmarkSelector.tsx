// src/components/benchmarks/BenchmarkSelector.tsx
import React from 'react';
import { useBridgeStore } from '../../store/useBridgeStore';
import { PRESET_BENCHMARKS } from '../../domain/constants/rev04_database';
import { Award, CheckCircle2, ArrowRight, BookOpen, Star } from 'lucide-react';

export const BenchmarkSelector: React.FC = () => {
  const {
    loadBenchmarkPreset,
    loadAllBenchmarks,
    activeAlternativeId,
    costBreakdown,
    customBenchmarks
  } = useBridgeStore();

  const allBenchmarks = [...PRESET_BENCHMARKS, ...customBenchmarks];

  return (
    <div className="space-y-5">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-amber-500" />
            고속도로 실시설계 실적 벤치마크 (Validation Benchmarks)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            `docs/고속도로 계획단계 교량 개략공사비 산정.md` 6장의 실제 타당성조사 및 기본설계 비교안 실적 데이터를 검증 및 로드합니다.
            {customBenchmarks.length > 0 && ` (사용자 등록 실적 ${customBenchmarks.length}개 포함)`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadAllBenchmarks()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-all shadow-xs"
            title="실적 벤치마크 비교안을 일괄 등록하여 대안 비교 탭에서 즉시 분석"
          >
            <BookOpen className="w-4 h-4" />
            표준 벤치마크 세트 로드
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {allBenchmarks.map((bm) => {
          const isCurrent = bm.id === activeAlternativeId || bm.bridgeParams?.id === activeAlternativeId;
          const calculatedTotalBillion = (costBreakdown.total_construction_cost / 100000000).toFixed(2);
          const calculatedUnitCostMan = Math.round(costBreakdown.unit_cost_per_m2 / 10000);

          return (
            <div
              key={bm.id}
              className={`p-5 rounded-xl border-2 transition-all bg-white flex flex-col justify-between ${
                isCurrent
                  ? 'border-amber-500 shadow-md ring-2 ring-amber-500/20'
                  : 'border-slate-200 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                        bm.isCustom
                          ? 'text-indigo-700 bg-indigo-50 border-indigo-200 flex items-center gap-1 inline-flex'
                          : 'text-amber-700 bg-amber-50 border-amber-200'
                      }`}
                    >
                      {bm.isCustom && <Star className="w-3 h-3 fill-indigo-600 text-indigo-600" />}
                      {bm.location}
                    </span>
                    <h3 className="text-sm font-extrabold text-slate-900 mt-1">{bm.name}</h3>
                  </div>
                  {isCurrent && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />
                      현재 로드됨
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 mt-2">{bm.description}</p>

                {/* Benchmark Reference vs Calculated Comparison */}
                <div className="grid grid-cols-2 gap-2 mt-4 p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                  <div>
                    <span className="text-slate-600 block text-[11px]">실적 총공사비 (기준)</span>
                    <span className="font-extrabold text-slate-900">{bm.referenceTotalCostBillion} 억원</span>
                    <span className="text-[10px] text-slate-600 block mt-0.5">
                      기준 ㎡당: {bm.referenceUnitCostPerM2TenThousand} 만원
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600 block text-[11px]">
                      {isCurrent ? '현재 모델 적산 결과' : '예상 산출 규모'}
                    </span>
                    <span className="font-extrabold text-blue-700">
                      {isCurrent ? `${calculatedTotalBillion} 억원` : `약 ${bm.referenceTotalCostBillion} 억원`}
                    </span>
                    <span className="text-[10px] text-blue-600 block mt-0.5">
                      {isCurrent ? `산출 ㎡당: ${calculatedUnitCostMan} 만원` : `약 ${bm.referenceUnitCostPerM2TenThousand} 만원`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-600">
                  {bm.bridgeParams.spans.length}개 경간 / B={bm.bridgeParams.bridge_width}m
                </span>
                <button
                  onClick={() => loadBenchmarkPreset(bm.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    isCurrent
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-slate-900 hover:bg-slate-800 text-white shadow-xs'
                  }`}
                >
                  <span>{isCurrent ? '새로고침' : '이 벤치마크 불러오기'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
