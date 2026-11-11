// src/App.tsx
import React, { useState } from 'react';
import { useBridgeStore } from './store/useBridgeStore';
import { Bridge3DViewer } from './components/viewer3d/Bridge3DViewer';
import { ParametricInputPanel } from './components/input/ParametricInputPanel';
import { CostReportTable } from './components/report/CostReportTable';
import { AlternativeComparison } from './components/analytics/AlternativeComparison';
import { BenchmarkSelector } from './components/benchmarks/BenchmarkSelector';
import { AlternativeStatusBar } from './components/analytics/AlternativeStatusBar';
import { SSOTDerivedValue } from './components/common/SSOTFields';
import {
  Box,
  FileSpreadsheet,
  TrendingUp,
  Award,
  Layers,
  Sparkles,
  GitBranch,
  RotateCcw,
  AlertTriangle
} from 'lucide-react';

export const App: React.FC = () => {
  const {
    projectName,
    setProjectName,
    bridgeParams,
    costBreakdown,
    selectedViewMode,
    setViewMode,
    alternatives,
    activeAlternativeId,
    loadAlternative,
    resetToInitialState
  } = useBridgeStore();

  const [showResetModal, setShowResetModal] = useState(false);

  const totalCostBillion = (costBreakdown.total_construction_cost / 100000000).toFixed(2);
  const directCostBillion = (costBreakdown.direct_cost_total / 100000000).toFixed(2);
  const unitCostMan = Math.round(costBreakdown.unit_cost_per_m2 / 10000);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100/80">
      {/* 1. Global Navigation Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs print:hidden">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Logo & Project Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center text-white shadow-md shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-extrabold text-slate-900 tracking-tight">
                  BIM 기반 고속도로 교량 공사비 산정 및 대안비교 시스템
                </h1>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                  REV.04
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                도로/교량 계획단계 개략공사비 산정 표준 DB 및 파라메트릭 3D BIM 연동 엔진
              </p>
            </div>
          </div>

          {/* 🌟 프로젝트 명 단일 입력 필드 (SSOT Red - 전역 유일 입력처) */}
          <div className="flex items-center gap-1.5 bg-red-50/50 border-2 border-red-200 hover:border-red-300 focus-within:border-red-600 px-3 py-1.5 rounded-lg transition-all shadow-2xs">
            <span className="text-[11px] font-extrabold text-red-600 whitespace-nowrap flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              프로젝트 명:
            </span>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="예: OO고속도로 제1교량 계획"
              className="bg-transparent text-xs font-bold text-slate-900 focus:outline-none w-36 sm:w-56 placeholder-slate-400"
            />
          </div>

          {/* Alternative Quick Switcher & Project Reset Button */}
          <div className="hidden md:flex items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs">
              <GitBranch className="w-4 h-4 text-slate-500" />
              <span className="font-semibold text-slate-600">활성 대안:</span>
              <select
                value={activeAlternativeId || ''}
                onChange={(e) => e.target.value && loadAlternative(e.target.value)}
                className="bg-transparent font-bold text-indigo-700 focus:outline-none cursor-pointer max-w-[160px] truncate"
              >
                {alternatives.length === 0 ? (
                  <option value="">대안 미등록 (신규 제원)</option>
                ) : (
                  alternatives.map((alt) => (
                    <option key={alt.id} value={alt.id}>
                      {alt.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Reset Button */}
            <button
              onClick={() => setShowResetModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-red-50 hover:border-red-300 text-slate-700 hover:text-red-600 text-xs font-bold transition-all shadow-xs"
              title="프로젝트 초기화 및 기본 상태로 복귀"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>초기화</span>
            </button>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setViewMode('3D')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${selectedViewMode === '3D' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Box className="w-4 h-4" />
              <span>3D BIM 모델러</span>
            </button>
            <button
              onClick={() => setViewMode('ANALYTICS')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${selectedViewMode === 'ANALYTICS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>대안 비교 ({alternatives.length})</span>
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${selectedViewMode === 'TABLE' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>적산 산출서</span>
            </button>
            <button
              onClick={() => setViewMode('BENCHMARK')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${selectedViewMode === 'BENCHMARK' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Award className="w-4 h-4 text-amber-500" />
              <span>실적 벤치마크</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Top Summary KPI Ribbon (Blue Derived Indicators) */}
      <section className="bg-white border-b border-slate-200/80 px-4 py-3 print:hidden shadow-xs">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-3">
          <SSOTDerivedValue
            label="총공사비 (Total Cost)"
            value={`${totalCostBillion} 억`}
            unit="원"
            subtext={`직접비 + 제잡비(${(bridgeParams.markup_rate * 100).toFixed(1)}%)`}
            size="lg"
          />
          <SSOTDerivedValue
            label="직접공사비 (Direct Cost)"
            value={`${directCostBillion} 억`}
            unit="원"
            subtext="상부+교대+교각+기초+부대공"
          />
          <SSOTDerivedValue
            label="㎡당 개략단가"
            value={`${unitCostMan.toLocaleString()}`}
            unit="만원/㎡"
            subtext={`총 ${costBreakdown.unit_cost_per_m2.toLocaleString()} 원/㎡`}
          />
          <SSOTDerivedValue
            label="교량 규모 (L × B)"
            value={`${bridgeParams.bridge_length} × ${bridgeParams.bridge_width}`}
            unit="m"
            subtext={`총 바닥판 면적 ${costBreakdown.total_deck_area_m2.toLocaleString()} m²`}
          />
          <SSOTDerivedValue
            label="경간 구성"
            value={`${bridgeParams.spans.length}개 경간`}
            unit={`${bridgeParams.spans[0]?.type || 'PSC'}`}
            subtext={`하부 교각 ${bridgeParams.piers.length}기 + 교대 2개소`}
          />
        </div>
      </section>

      {/* 3. Main Workspace Area */}
      <main className="max-w-7xl mx-auto px-4 py-5 flex-1 w-full">
        {selectedViewMode === '3D' && (
          <div className="space-y-4">
            {/* 3D BIM 모델러 대안 추가 현황 및 원안 결정 바 */}
            <AlternativeStatusBar />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left 7 Columns: 3D BIM Viewer & Viewport Controls */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <Bridge3DViewer />

                {/* Sub-breakdown Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-500 block">상부공 직접비</span>
                    <span className="text-sm font-extrabold text-blue-700">
                      {(costBreakdown.superstructure_cost / 100000000).toFixed(2)} 억원
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {Math.round((costBreakdown.superstructure_cost / (costBreakdown.direct_cost_total || 1)) * 100)}% 비중
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-500 block">하부공(교대+교각)</span>
                    <span className="text-sm font-extrabold text-blue-700">
                      {(costBreakdown.substructure_total / 100000000).toFixed(2)} 억원
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {Math.round((costBreakdown.substructure_total / (costBreakdown.direct_cost_total || 1)) * 100)}% 비중
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                    <span className="text-[11px] font-bold text-slate-500 block">기초공 (강관말뚝)</span>
                    <span className="text-sm font-extrabold text-blue-700">
                      {(costBreakdown.foundation_cost / 100000000).toFixed(2)} 억원
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      총연장 {costBreakdown.total_pile_length.toLocaleString()}m
                    </span>
                  </div>
                </div>
              </div>

              {/* Right 5 Columns: SSOT Parametric Input Panel */}
              <div className="lg:col-span-5 h-[620px]">
                <ParametricInputPanel />
              </div>
            </div>
          </div>
        )}

        {selectedViewMode === 'ANALYTICS' && <AlternativeComparison />}
        {selectedViewMode === 'TABLE' && <CostReportTable />}
        {selectedViewMode === 'BENCHMARK' && <BenchmarkSelector />}
      </main>

      {/* 4. Global Footer with SSOT Rules Legend */}
      <footer className="bg-white border-t border-slate-200 py-3.5 px-4 text-xs text-slate-500 print:hidden mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <span className="font-bold text-slate-700">UI/UX 데이터 표현 규약 (SSOT):</span>
            <span className="flex items-center gap-1.5 font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              사용자 입력값 (Red)
            </span>
            <span className="flex items-center gap-1.5 font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              인용·연산값 (Blue)
            </span>
            <span className="flex items-center gap-1.5 font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
              <span className="w-2 h-2 rounded-full bg-slate-800"></span>
              고정·가정값 (Black)
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            <span>적산 기준: REV.04 실적 DB</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-emerald-600 font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Anthropic 하네스 아키텍처 적용
            </span>
          </div>
        </div>
      </footer>
      {/* 5. Reset Project Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-red-600 mb-2">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">프로젝트 초기화</h3>
                <p className="text-xs text-slate-500">기본 설정으로 되돌립니다</p>
              </div>
            </div>
            <p className="text-xs text-slate-600 mt-3 leading-relaxed">
              현재 편집 중인 교량 제원 및 모든 등록된 비교안이 삭제되고, <strong className="text-slate-900 font-bold">신규 프로젝트 기본 상태(원안 1개)</strong>로 초기화됩니다. 계속 진행하시겠습니까?
            </p>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  resetToInitialState();
                  setShowResetModal(false);
                }}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 shadow-sm"
              >
                초기화 실행
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

