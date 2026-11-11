// src/components/analytics/AlternativeComparison.tsx
import React, { useState } from 'react';
import { useBridgeStore } from '../../store/useBridgeStore';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { TrendingUp, DollarSign, Layers, Edit2, ArrowRight, Award, CheckCircle2, BookmarkPlus } from 'lucide-react';

export const AlternativeComparison: React.FC = () => {
  const {
    alternatives,
    activeAlternativeId,
    deleteAlternative,
    updateAlternativeName,
    customBenchmarks,
    addBenchmarkFromAlternative,
    setViewMode
  } = useBridgeStore();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const startRename = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditingName(currentName);
  };

  const submitRename = (id: string) => {
    if (editingName.trim()) {
      updateAlternativeName(id, editingName.trim());
    }
    setEditingId(null);
  };

  const handleAddBenchmark = (altId: string, altName: string) => {
    addBenchmarkFromAlternative(altId);
    setFeedbackMsg(`'${altName}' 대안이 [실적 벤치마크]에 성공적으로 추가되었습니다.`);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  // 1. Recharts 총공사비 비교 데이터셋 구성
  const totalCostChartData = alternatives.map((alt) => {
    const totalBillion = Math.round((alt.costBreakdown.total_construction_cost / 100000000) * 100) / 100;
    const directBillion = Math.round((alt.costBreakdown.direct_cost_total / 100000000) * 100) / 100;
    const unitCostTenThousand = Math.round(alt.costBreakdown.unit_cost_per_m2 / 10000);

    return {
      name: alt.name,
      총공사비: totalBillion,
      직접공사비: directBillion,
      'm2당단가(만원)': unitCostTenThousand,
      isActive: alt.id === activeAlternativeId
    };
  });

  // 2. 공종별 스택 바 데이터셋 구성
  const stackedChartData = alternatives.map((alt) => ({
    name: alt.name,
    상부공: Math.round((alt.costBreakdown.superstructure_cost / 100000000) * 10) / 10,
    하부공: Math.round((alt.costBreakdown.substructure_total / 100000000) * 10) / 10,
    기초공: Math.round((alt.costBreakdown.foundation_cost / 100000000) * 10) / 10,
    부대공: Math.round((alt.costBreakdown.ancillary_cost / 100000000) * 10) / 10,
    간접제잡비: Math.round(((alt.costBreakdown.miscellaneous_cost + alt.costBreakdown.indirect_cost_markup) / 100000000) * 10) / 10
  }));

  const baseAlt = alternatives[0] || null;
  const baseTotalCost = baseAlt ? baseAlt.costBreakdown.total_construction_cost : 1;

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600" />
            고속도로 교량 계획 대안별 공사비 및 경제성 비교 분석
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            등록된 {alternatives.length}개 대안 간의 총공사비, ㎡당 단가, 공종별 원가 구조를 다차원 비교 분석합니다.
          </p>
        </div>
        <button
          onClick={() => setViewMode('3D')}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm transition-all"
        >
          <span>3D BIM 제원 입력 패널로 이동</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* 벤치마크 추가 성공 알림 */}
      {feedbackMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center justify-between shadow-2xs animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button
            onClick={() => setViewMode('BENCHMARK')}
            className="text-xs underline text-emerald-700 hover:text-emerald-900 ml-3"
          >
            [실적 벤치마크] 탭에서 확인하기 →
          </button>
        </div>
      )}

      {/* Alternative Cards Selector */}
      {alternatives.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center space-y-4 shadow-xs">
          <div className="w-14 h-14 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Layers className="w-7 h-7" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">등록된 비교 대안이 없습니다</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            '3D BIM 모델러' 탭의 <strong>파라메트릭 제원 입력 패널</strong>에서 교량 제원을 조정한 후,
            패널 하단의 <strong>[➕ 새 대안으로 저장]</strong> 버튼을 눌러 여러 대안을 등록해주세요.
          </p>
          <button
            onClick={() => setViewMode('3D')}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-all"
          >
            <span>제원 입력 및 대안 추가하러 가기</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          {/* 🌟 2. 그래프 위 중복 대안 선택 카드 삭제 완료 -> 시원하게 비교 차트가 최상단에 바로 배치됨 */}

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Chart 1: 총공사비 및 직접공사비 비교 바 차트 */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-indigo-600" />
                대안별 총공사비 및 직접공사비 비교 (단위: 억원)
              </h3>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={totalCostChartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-10} textAnchor="end" />
                    <YAxis unit="억" tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(val: any) => [`${val} 억원`, '']}
                      contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="총공사비" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="직접공사비" fill="#93C5FD" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: 공종별 원가 구성 스택 바 차트 */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-sky-600" />
                공종별(상부/하부/기초/부대/간접비) 원가 비중 (단위: 억원)
              </h3>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stackedChartData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-10} textAnchor="end" />
                    <YAxis unit="억" tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(val: any) => [`${val} 억원`, '']}
                      contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    <Bar dataKey="상부공" stackId="a" fill="#3B82F6" />
                    <Bar dataKey="하부공" stackId="a" fill="#10B981" />
                    <Bar dataKey="기초공" stackId="a" fill="#F59E0B" />
                    <Bar dataKey="부대공" stackId="a" fill="#8B5CF6" />
                    <Bar dataKey="간접제잡비" stackId="a" fill="#94A3B8" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 🌟 3. 상세 비교 매트릭스 테이블 (관리 열: 벤치마크 추가 + 삭제) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">대안별 상세 경제성 및 규격 비교 매트릭스</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">우측 관리 항목에서 대안을 <strong>'실적 벤치마크'</strong>에 등록하거나 삭제할 수 있습니다.</p>
              </div>
              <span className="text-xs text-slate-500 font-semibold">REV.04 표준 적산 공식 적용</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">대안 구분</th>
                    <th className="py-2.5 px-3">총연장(L) / 폭원(B)</th>
                    <th className="py-2.5 px-3">경간 구성</th>
                    <th className="py-2.5 px-3 text-right">직접공사비</th>
                    <th className="py-2.5 px-3 text-right">총공사비</th>
                    <th className="py-2.5 px-3 text-right">㎡당 단가</th>
                    <th className="py-2.5 px-3 text-center">상대 차이</th>
                    <th className="py-2.5 px-3 text-center">관리 (벤치마크/삭제)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {alternatives.map((alt, idx) => {
                    const totalBillion = (alt.costBreakdown.total_construction_cost / 100000000).toFixed(2);
                    const directBillion = (alt.costBreakdown.direct_cost_total / 100000000).toFixed(2);
                    const unitCostMan = Math.round(alt.costBreakdown.unit_cost_per_m2 / 10000);
                    const deltaPct = idx === 0 ? '-' : `${(((alt.costBreakdown.total_construction_cost - baseTotalCost) / baseTotalCost) * 100).toFixed(1)}%`;
                    const isSelected = alt.id === activeAlternativeId;

                    const isAlreadyBenchmark = customBenchmarks.some(
                      (cb) => cb.id === `bm_${alt.id}` || cb.name === `[실적] ${alt.name}`
                    );

                    return (
                      <tr key={alt.id} className={`hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50/30' : ''}`}>
                        <td className="py-2.5 px-3 font-bold text-slate-900 flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: alt.color }}></span>
                          {editingId === alt.id ? (
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && submitRename(alt.id)}
                              onBlur={() => submitRename(alt.id)}
                              autoFocus
                              className="px-1.5 py-0.5 text-xs font-bold border border-indigo-500 rounded bg-white"
                            />
                          ) : (
                            <span className="flex items-center gap-1">
                              {alt.name}
                              <button
                                onClick={(e) => startRename(alt.id, alt.name, e)}
                                className="text-slate-400 hover:text-indigo-600 p-0.5"
                                title="이름 수정"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          L={alt.bridgeParams.bridge_length}m / B={alt.bridgeParams.bridge_width}m
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 truncate max-w-[200px]">
                          {alt.bridgeParams.spans.map((s) => `${s.span_length}m`).join('+')} ({alt.bridgeParams.spans[0]?.type})
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                          {directBillion} 억
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-extrabold text-indigo-700">
                          {totalBillion} 억원
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                          {unitCostMan.toLocaleString()} 만원
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold">
                          {idx === 0 ? (
                            <span className="text-slate-400">대안 1 대비</span>
                          ) : (
                            <span className={parseFloat(deltaPct) > 0 ? 'text-red-600' : 'text-emerald-600'}>
                              {parseFloat(deltaPct) > 0 ? `+${deltaPct}` : deltaPct}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* 벤치마크 추가 버튼 */}
                            {isAlreadyBenchmark ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 rounded border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                벤치마크 등록됨
                              </span>
                            ) : (
                              <button
                                onClick={() => handleAddBenchmark(alt.id, alt.name)}
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 rounded border border-amber-300 transition-all shadow-2xs"
                                title="이 대안을 실적 벤치마크에 등록하여 언제든 레퍼런스로 참조할 수 있습니다."
                              >
                                <BookmarkPlus className="w-3 h-3 text-amber-600" />
                                벤치마크 추가
                              </button>
                            )}

                            {/* 삭제 버튼 */}
                            <button
                              onClick={() => {
                                if (confirm(`'${alt.name}' 대안을 삭제하시겠습니까?`)) {
                                  deleteAlternative(alt.id);
                                }
                              }}
                              className="text-red-500 hover:text-red-700 font-bold text-[11px] px-1 py-0.5 hover:bg-red-50 rounded transition-colors"
                            >
                              삭제
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
