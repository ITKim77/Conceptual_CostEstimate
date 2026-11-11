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
import { Plus, CheckCircle, TrendingUp, DollarSign, Layers } from 'lucide-react';

export const AlternativeComparison: React.FC = () => {
  const {
    alternatives,
    activeAlternativeId,
    loadAlternative,
    saveCurrentAsAlternative,
    deleteAlternative,
    bridgeParams
  } = useBridgeStore();

  const [newAltName, setNewAltName] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

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

  const handleSaveAlternative = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAltName.trim()) return;
    saveCurrentAsAlternative(newAltName.trim());
    setNewAltName('');
    setShowAddModal(false);
  };

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
            등록된 대안들 간의 총공사비, ㎡당 단가, 공종별 원가 구조를 다차원 비교합니다.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-lg text-xs font-bold shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          현재 설계를 새 대안으로 저장
        </button>
      </div>

      {/* Alternative Cards Selector */}
      {alternatives.length === 0 ? (
        <div className="bg-white p-10 rounded-xl border border-slate-200 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">등록된 대안이 없습니다 (원안 미등록 상태)</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            '3D BIM 모델러' 탭에서 교량 제원을 검토한 후, <strong>'대안 추가 현황'</strong> 바에서 <strong>'원안으로 등록'</strong>을 진행해 주세요.
            원안 확정 후 다양한 경간과 형식의 비교안을 추가하여 경제성을 다차원 분석할 수 있습니다.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {alternatives.map((alt, idx) => {
              const isActive = alt.id === activeAlternativeId;
              const totalCostBillion = (alt.costBreakdown.total_construction_cost / 100000000).toFixed(2);
              const unitCostMan = Math.round(alt.costBreakdown.unit_cost_per_m2 / 10000);
              const deltaPct = idx === 0 ? '0' : (((alt.costBreakdown.total_construction_cost - baseTotalCost) / baseTotalCost) * 100).toFixed(1);

              return (
                <div
                  key={alt.id}
                  onClick={() => loadAlternative(alt.id)}
                  className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all ${isActive ? 'border-indigo-600 bg-indigo-50/40 shadow-md ring-2 ring-indigo-500/20' : 'border-slate-200 bg-white hover:border-slate-300 shadow-xs'}`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-slate-900 truncate">{alt.name}</span>
                    {isActive ? (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded">
                        <CheckCircle className="w-3 h-3 text-indigo-600" />
                        선택됨
                      </span>
                    ) : (
                      idx === 0 && <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">기준(원안)</span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-extrabold text-indigo-700 tracking-tight">{totalCostBillion}</span>
                    <span className="text-xs font-semibold text-slate-600">억원</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-100">
                    <span>{unitCostMan} 만원/㎡</span>
                    {idx > 0 && (
                      <span className={`font-bold ${parseFloat(deltaPct) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {parseFloat(deltaPct) > 0 ? `+${deltaPct}%` : `${deltaPct}%`}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

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

          {/* Detailed Alternative Comparison Matrix Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">대안별 상세 경제성 및 규격 비교 매트릭스</h3>
              <span className="text-xs text-slate-500">REV.04 표준 적산 공식 적용</span>
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
                    <th className="py-2.5 px-3 text-center">원안 대비 증감</th>
                    <th className="py-2.5 px-3 text-center">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {alternatives.map((alt, idx) => {
                    const totalBillion = (alt.costBreakdown.total_construction_cost / 100000000).toFixed(2);
                    const directBillion = (alt.costBreakdown.direct_cost_total / 100000000).toFixed(2);
                    const unitCostMan = Math.round(alt.costBreakdown.unit_cost_per_m2 / 10000);
                    const deltaPct = idx === 0 ? '-' : `${(((alt.costBreakdown.total_construction_cost - baseTotalCost) / baseTotalCost) * 100).toFixed(1)}%`;
                    const isSelected = alt.id === activeAlternativeId;

                    return (
                      <tr key={alt.id} className={`hover:bg-slate-50 ${isSelected ? 'bg-indigo-50/30' : ''}`}>
                        <td className="py-2.5 px-3 font-bold text-slate-900 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: alt.color }}></span>
                          {alt.name}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          L={alt.bridgeParams.bridge_length}m / B={alt.bridgeParams.bridge_width}m
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 truncate max-w-[200px]">
                          {alt.bridgeParams.spans.map(s => `${s.span_length}m`).join('+')} ({alt.bridgeParams.spans[0]?.type})
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
                            <span className="text-slate-400">기준안</span>
                          ) : (
                            <span className={parseFloat(deltaPct) > 0 ? 'text-red-600' : 'text-emerald-600'}>
                              {parseFloat(deltaPct) > 0 ? `+${deltaPct}` : deltaPct}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {alternatives.length > 1 && idx > 0 && (
                            <button
                              onClick={() => deleteAlternative(alt.id)}
                              className="text-red-500 hover:text-red-700 font-bold text-[11px]"
                            >
                              삭제
                            </button>
                          )}
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

      {/* Save Alternative Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">현재 설계를 새 대안으로 저장</h3>
            <p className="text-xs text-slate-500 mb-4">
              현재 파라메터 제원(L={bridgeParams.bridge_length}m, {bridgeParams.spans.length}경간)을 별도 대안으로 보존합니다.
            </p>
            <form onSubmit={handleSaveAlternative} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">대안 명칭</label>
                <input
                  type="text"
                  required
                  value={newAltName}
                  onChange={(e) => setNewAltName(e.target.value)}
                  placeholder="예: 비교 2안 (장경간 강합성교안)"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-semibold focus:outline-none focus:border-indigo-600"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                >
                  저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
