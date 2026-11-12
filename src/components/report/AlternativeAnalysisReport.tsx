// src/components/report/AlternativeAnalysisReport.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useBridgeStore } from '../../store/useBridgeStore';
import { AlternativeScenario, BridgeParameters, SpanItem, SuperstructureType } from '../../domain/models/bridge';
import { SUPERSTRUCTURE_CATALOG } from '../../domain/constants/rev04_database';
import { classifySuperstructure } from '../viewer3d/bridge_geometry_builders';
import {
  BimAlternativeSnapshot,
  captureAlternativeBimSnapshots
} from '../viewer3d/bridge_scene_builder';
import {
  ArrowLeft,
  Award,
  Camera,
  CheckCircle2,
  FileText,
  Layers,
  Loader2,
  MapPin,
  Printer
} from 'lucide-react';

function formatBillion(won: number): string {
  return (won / 100000000).toFixed(2);
}

function getApproxLanesText(widthMeters: number): string {
  if (widthMeters >= 28) return '왕복 6차로 이상 광폭 고속도로';
  if (widthMeters >= 21) return '왕복 4~6차로 표준 고속도로';
  if (widthMeters >= 15) return '왕복 4차로 고속도로';
  if (widthMeters >= 11) return '왕복 2~3차로 도로';
  return '왕복 2차로 소폭 도로';
}

function explainSuperstructureForStudent(spans: SpanItem[]): {
  shortName: string;
  easyTitle: string;
  description: string;
} {
  const uniqueTypes = Array.from(new Set(spans.map((s) => s.type)));
  const mainType: SuperstructureType = uniqueTypes[0] || 'PSC_BEAM';
  const metaName = SUPERSTRUCTURE_CATALOG[mainType]?.name || mainType;
  const cat = classifySuperstructure(mainType);

  const mixedPrefix =
    uniqueTypes.length > 1
      ? `총 ${spans.length}개 경간에 ${uniqueTypes.length}가지 교량 형식을 혼합 적용한 구조입니다. 주요 구간인 `
      : '';

  switch (cat) {
    case 'ARCH':
      return {
        shortName: uniqueTypes.length > 1 ? `혼합 (${metaName} 포함)` : metaName,
        easyTitle: '아치 리브와 케이블로 상판을 지지하는 아치 교량',
        description: `${mixedPrefix}활 모양의 강철 아치 리브가 상부에서 행어 케이블로 교량 상판을 매달아 하중을 지탱하는 구조입니다. 하천이나 깊은 계곡 중앙에 교각을 세우기 어려울 때 긴 경간을 한 번에 횡단하기에 유리합니다.`
      };
    case 'CABLE_STAYED':
      return {
        shortName: uniqueTypes.length > 1 ? `혼합 (${metaName} 포함)` : metaName,
        easyTitle: '주탑에서 사선 케이블로 상판을 지지하는 사장교',
        description: `${mixedPrefix}교량 중간에 높은 주탑을 세우고, 주탑에서 뻗어 나온 강철 케이블로 교량 상판을 비스듬히 끌어당겨 지탱하는 형식입니다. 매우 긴 하천이나 계곡을 건너는 장경간 구간에 적합하며 경관성이 뛰어납니다.`
      };
    case 'EXTRADOSED':
      return {
        shortName: uniqueTypes.length > 1 ? `혼합 (${metaName} 포함)` : metaName,
        easyTitle: '사장교와 박스거더의 장점을 결합한 저탑 하이브리드 교량',
        description: `${mixedPrefix}사장교보다 주탑 높이를 낮추고 상판 자체도 두꺼운 콘크리트 박스 단면으로 설계한 형식입니다. 바람에 의한 진동이 적고 공사비도 일반 사장교보다 절감되어 중·장경간 고속도로 교량에 널리 적용됩니다.`
      };
    case 'PSC_BOX_FCM':
      return {
        shortName: uniqueTypes.length > 1 ? `혼합 (${metaName} 포함)` : metaName,
        easyTitle: '교각 위에서 좌우 균형을 맞춰 이어 붙이는 변단면 콘크리트 박스 교량',
        description: `${mixedPrefix}하천이나 계곡 아래에 동바리(가설 지지대)를 세우지 않고, 교각 상단에서 좌우 균형을 맞추며 콘크리트 박스 세그먼트를 순차적으로 이어 붙이는(FCM) 공법입니다. 교각 부위가 두껍고 경간 중앙이 얇은 곡선 형태를 띱니다.`
      };
    case 'PSC_BOX':
      return {
        shortName: uniqueTypes.length > 1 ? `혼합 (${metaName} 포함)` : metaName,
        easyTitle: '속이 빈 사다리꼴 콘크리트 상자 단면 교량',
        description: `${mixedPrefix}큰 콘크리트 상자 내부를 비워 자중은 줄이면서 비틀림과 무거운 차량 하중에 강하게 저항하도록 만든 교량입니다. 교량 하부 외관이 깔끔하고 다경간 연속 구간에 적합합니다.`
      };
    case 'STEEL_BOX':
      return {
        shortName: uniqueTypes.length > 1 ? `혼합 (${metaName} 포함)` : metaName,
        easyTitle: '강철 상자 대들보를 적용한 곡선 대응 강박스 교량',
        description: `${mixedPrefix}속이 빈 사다리꼴 강철 상자(Steel Box) 여러 개를 나란히 배치해 교량 상판을 지지하는 형식입니다. 콘크리트 교량보다 가볍고 비틀림 저항력이 커서 곡률 반경이 작은 커브 구간에도 안정적으로 적용됩니다.`
      };
    case 'RATIONALIZED_PLATE':
      return {
        shortName: uniqueTypes.length > 1 ? `혼합 (${metaName} 포함)` : metaName,
        easyTitle: '2개의 대형 강철 I형 주형으로 단순화한 소수주형 강교',
        description: `${mixedPrefix}기존처럼 강철 빔을 여러 개 배치하지 않고, 강성이 큰 대형 강철 대들보 2개와 가로보로 단순하게 구성하여 제작 물량과 공사 기간을 줄이는 합리화 강교 형식입니다.`
      };
    case 'STEEL_PLATE':
      return {
        shortName: uniqueTypes.length > 1 ? `혼합 (${metaName} 포함)` : metaName,
        easyTitle: 'I형 강철 대들보를 다수 배치한 강판형 교량',
        description: `${mixedPrefix}강철 판을 I자 단면으로 용접한 대들보 여러 개를 나란히 설치해 상판을 받치는 교량입니다. 부재가 가벼워 좁은 계곡이나 곡선 도로 현장에서도 조립과 가설이 용이합니다.`
      };
    case 'RC_RAHMEN':
      return {
        shortName: uniqueTypes.length > 1 ? `혼합 (${metaName} 포함)` : metaName,
        easyTitle: '상판과 교대 벽체가 일체로 연결된 문틀형 라멘 교량',
        description: `${mixedPrefix}교량 상판과 양쪽 끝 벽체(교대)가 교량받침 없이 ㄷ자 형태로 일체화된 구조입니다. 지진 저항력이 우수하고 유지관리 요소가 적어 소규모 하천이나 도로 횡단에 경제적입니다.`
      };
    case 'RC_BOX':
      return {
        shortName: uniqueTypes.length > 1 ? `혼합 (${metaName} 포함)` : metaName,
        easyTitle: '사각형 콘크리트 폐합 단면 암거형 구조물 (RC BOX)',
        description: `${mixedPrefix}상·하부 슬래브와 양쪽 측벽이 모두 콘크리트로 일체 구성된 상자형 통로 구조물입니다. 소규모 하천, 농로 또는 지하차도 통로 구간에서 시공이 간편하고 내구성이 높습니다.`
      };
    case 'PSC_LOW_DEPTH':
      return {
        shortName: uniqueTypes.length > 1 ? `혼합 (${metaName} 포함)` : metaName,
        easyTitle: '대들보 두께를 낮춘 저형고 복합 거더 교량',
        description: `${mixedPrefix}콘크리트 거더 내부에 강재 보강을 결합해 교량 대들보의 높이(형고)를 얇게 줄인 형식입니다. 교량 아래로 차량이나 하천이 통과할 여유 높이(형하공간)를 확보해야 할 때 유리합니다.`
      };
    case 'PSC_U_TROUGH':
      return {
        shortName: uniqueTypes.length > 1 ? `혼합 (${metaName} 포함)` : metaName,
        easyTitle: 'U자형 개방 단면 콘크리트 거더 교량',
        description: `${mixedPrefix}대들보 단면이 넓은 U자 형태로 구성되어 횡방향 안정성과 비틀림 저항이 우수하고 하부 미관도 단정한 개량형 콘크리트 교량입니다.`
      };
    case 'PSC_GIRDER_HAUNCHED':
      return {
        shortName: uniqueTypes.length > 1 ? `혼합 (${metaName} 포함)` : metaName,
        easyTitle: '지점부를 두껍게 보강한 변단면 개량형 PSC 거더 교량',
        description: `${mixedPrefix}하중이 크게 집중되는 양쪽 교각 위 단면은 두껍게, 중앙부는 날씬하게 설계하여 재료를 절감하면서도 경간 길이를 늘릴 수 있는 개량형 거더 교량입니다.`
      };
    case 'PSC_GIRDER_I':
    default:
      return {
        shortName: uniqueTypes.length > 1 ? `혼합 (${metaName} 포함)` : metaName,
        easyTitle: '공장 제작 I형 콘크리트 대들보를 거치하는 표준 교량',
        description: `${mixedPrefix}공장에서 사전 제작한 콘크리트 빔(PSC BEAM)을 교각 위에 나란히 거치한 뒤 상부 콘크리트 바닥판을 타설해 완성하는 형식입니다. 공사비가 경제적이고 시공성이 검증된 고속도로 표준 교량입니다.`
      };
  }
}

function explainAlignmentEasy(params: BridgeParameters): string {
  const align = params.alignment;
  const parts: string[] = [];

  if (!align || !align.curve_radius || align.curve_radius === 0) {
    parts.push('직선 선형');
  } else {
    const absR = Math.abs(align.curve_radius);
    const dir = align.curve_radius > 0 ? '우측' : '좌측';
    const sharpness = absR >= 1000 ? '완만한' : absR >= 500 ? '표준' : '급한';
    parts.push(`${dir} ${sharpness} 곡선(반지름 R=${absR}m)`);
  }

  const slope = align?.longitudinal_slope ?? 0;
  if (Math.abs(slope) < 0.05) {
    parts.push('평탄 종단(경사 0%)');
  } else {
    const dirSlope = slope > 0 ? '오르막' : '내리막';
    parts.push(`종단경사 ${slope > 0 ? '+' : ''}${slope}% (${dirSlope})`);
  }

  const skew = params.skew_angle || 0;
  if (Math.abs(skew) < 0.5) {
    parts.push('직각 교차(사각 0°)');
  } else {
    const rotText = skew > 0 ? '반시계방향(+)' : '시계방향(-)';
    parts.push(`사각 ${Math.abs(skew)}° (${rotText} 사교)`);
  }

  return parts.join(' · ');
}

/**
 * 순수 SVG 기반 대안별 총공사비·직접비 비교 막대 그래프 (인쇄/PDF 시 레이아웃 깨짐 없음)
 */
const ReportComparisonSvgChart: React.FC<{
  items: AlternativeScenario[];
  minCostId: string;
}> = ({ items, minCostId }) => {
  const displayItems = items.slice(0, 7);
  const maxBillion = Math.max(
    10,
    ...displayItems.map((it) => it.costBreakdown.total_construction_cost / 100000000)
  );
  const chartMax = Math.ceil((maxBillion * 1.18) / 10) * 10 || 10;

  return (
    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/70">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-extrabold text-slate-800">
          대안별 총공사비 비교 (단위: 억 원)
        </span>
        <div className="flex items-center gap-3 text-[10px] text-slate-600">
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-indigo-600 inline-block" />
            총공사비 (간접비 포함)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
            최저 공사비 대안
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-sky-300 inline-block" />
            직접공사비
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        {displayItems.map((alt) => {
          const totalB = alt.costBreakdown.total_construction_cost / 100000000;
          const directB = alt.costBreakdown.direct_cost_total / 100000000;
          const totalPct = Math.min(100, (totalB / chartMax) * 100);
          const directPct = Math.min(100, (directB / chartMax) * 100);
          const isCheapest = alt.id === minCostId;

          return (
            <div key={alt.id} className="grid grid-cols-12 items-center gap-2 text-[10px]">
              <div className="col-span-3 font-bold text-slate-800 truncate flex items-center gap-1">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: alt.color || '#4F46E5' }}
                />
                <span className="truncate">{alt.name}</span>
              </div>
              <div className="col-span-7 relative h-5 bg-white border border-slate-200 rounded overflow-hidden">
                <div
                  className={`h-full rounded-r transition-all ${
                    isCheapest ? 'bg-emerald-500' : 'bg-indigo-600'
                  }`}
                  style={{ width: `${Math.max(4, totalPct)}%` }}
                />
                <div
                  className="absolute top-0 left-0 h-2 bg-sky-300/80 rounded-r"
                  style={{ width: `${Math.max(3, directPct)}%` }}
                />
              </div>
              <div className="col-span-2 text-right font-mono font-extrabold text-slate-900">
                {totalB.toFixed(1)}억
                {isCheapest && (
                  <span className="ml-1 text-[9px] text-emerald-700 font-sans font-bold">★최저</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const AlternativeAnalysisReport: React.FC = () => {
  const { projectName, alternatives, bridgeParams, costBreakdown, setViewMode } = useBridgeStore();
  const [snapshots, setSnapshots] = useState<Record<string, BimAlternativeSnapshot>>({});
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureStatus, setCaptureStatus] = useState('');

  // 등록된 대안이 없으면 현재 편집 중인 교량 계획을 '기준 계획안'으로 포함
  const reportItems: AlternativeScenario[] = useMemo(() => {
    if (alternatives.length > 0) return alternatives;
    return [
      {
        id: 'current_draft',
        name: bridgeParams.name || '현재 계획 교량 (기본안)',
        bridgeParams,
        costBreakdown,
        color: '#4F46E5',
        isBase: true
      }
    ];
  }, [alternatives, bridgeParams, costBreakdown]);

  const runSnapshotCapture = useCallback(async () => {
    setIsCapturing(true);
    setCaptureStatus(`3D BIM 모델 스틸컷 준비 중... (0/${reportItems.length})`);
    try {
      const imgs = await captureAlternativeBimSnapshots(
        reportItems.map((it) => ({ id: it.id, bridgeParams: it.bridgeParams })),
        {
          terrainVerticalScale: 1.0,
          onProgress: (done, total, currentName) => {
            setCaptureStatus(
              done < total
                ? `3D BIM 모델 스틸컷 촬영 중 (${done + 1}/${total}): ${currentName}`
                : `스틸컷 ${total}건 촬영 완료`
            );
          }
        }
      );
      setSnapshots(imgs);
    } finally {
      setIsCapturing(false);
    }
  }, [reportItems]);

  useEffect(() => {
    void runSnapshotCapture();
  }, [runSnapshotCapture]);

  const sortedByCost = useMemo(
    () =>
      [...reportItems].sort(
        (a, b) => a.costBreakdown.total_construction_cost - b.costBreakdown.total_construction_cost
      ),
    [reportItems]
  );

  const cheapestAlt = sortedByCost[0];
  const mostExpensiveAlt = sortedByCost[sortedByCost.length - 1];
  const baseAlt = reportItems[0];
  const primaryParams = baseAlt.bridgeParams;
  const totalPages = 1 + reportItems.length;
  const reportDate = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const displayProjectTitle =
    projectName?.trim() || primaryParams.locationName || primaryParams.name || '고속도로 교량 건설 계획';

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* 비인쇄 상단 액션 컨트롤 바 */}
      <div className="print:hidden bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-extrabold text-slate-900">
              대안별 공사비 비교 분석 보고서 (A4 PDF)
            </h2>
            <span className="text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full border border-indigo-200">
              총 {totalPages}페이지 (총괄 1p + 대안별 {reportItems.length}p)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {isCapturing ? (
              <span className="inline-flex items-center gap-1.5 text-amber-700 font-semibold">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {captureStatus}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                대안별 3D BIM 모델 스틸컷 및 공사비 분석 내용이 A4 용지 규격에 맞춰 정리되었습니다.
                <span className="text-slate-400 font-normal ml-1">
                  (인쇄 창에서 대상: &apos;PDF로 저장&apos;, 용지: A4, &apos;배경 그래픽&apos; 체크 권장)
                </span>
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('ANALYTICS')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>대안 비교</span>
          </button>

          <button
            type="button"
            onClick={() => void runSnapshotCapture()}
            disabled={isCapturing}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 text-indigo-700 text-xs font-bold transition-all"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>스틸컷 다시 찍기</span>
          </button>

          <button
            type="button"
            onClick={handlePrintPdf}
            disabled={isCapturing}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 text-white text-xs font-extrabold shadow-md transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>A4 PDF 출력 / 저장</span>
          </button>
        </div>
      </div>

      {/* A4 페이지 미리보기 및 인쇄 루트 */}
      <div className="report-print-root overflow-x-auto pb-6 print:overflow-visible print:pb-0">
        {/* ================================================================
            PAGE 1: 종합 요약 · 현황 쉬운 해설 · 대안별 비교표 & 그래프
           ================================================================ */}
        <section className="report-a4-page">
          <div className="space-y-4">
            {/* 상단 표지 헤더 */}
            <div className="bg-slate-900 text-white rounded-xl p-4 flex items-center justify-between border-b-4 border-amber-400">
              <h1 className="text-lg font-extrabold leading-snug">
                {displayProjectTitle} — 대안별 공사비 분석 보고서
              </h1>
              <div className="text-right text-[10px] text-slate-300 shrink-0 ml-4">
                <div className="font-bold text-white">{reportDate}</div>
                <div className="mt-0.5">비교 대안: 총 {reportItems.length}개 안</div>
              </div>
            </div>

            {/* 1. 계획 현장 및 도로 선형 현황 */}
            <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-indigo-600" />
                  1. 교량 계획 위치 및 도로 선형 현황
                </h2>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                  {primaryParams.locationName || '고속도로 계획 노선'}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 text-[11px]">
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">교량 연장 / 폭원</span>
                  <strong className="text-slate-900">
                    {primaryParams.bridge_length}m × {primaryParams.bridge_width}m
                  </strong>
                  <span className="text-[10px] text-indigo-600 block">
                    {getApproxLanesText(primaryParams.bridge_width)}
                  </span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">위치 좌표</span>
                  <strong className="text-slate-900 font-mono text-[10px]">
                    {primaryParams.coordinates
                      ? `위도 ${primaryParams.coordinates.lat.toFixed(4)}° / 경도 ${primaryParams.coordinates.lng.toFixed(4)}°`
                      : '표준 지형'}
                  </strong>
                  <span className="text-[10px] text-slate-500 block">실측 지형(DEM) 반영</span>
                </div>
                <div className="p-2.5 rounded bg-slate-50 border border-slate-100 col-span-2">
                  <span className="text-[10px] text-slate-500 block">도로 선형 조건 (평면 · 종단 · 사각)</span>
                  <strong className="text-slate-900 text-[10.5px] leading-tight block mt-0.5">
                    {explainAlignmentEasy(primaryParams)}
                  </strong>
                </div>
              </div>
            </div>

            {/* 2. 대안별 공사비 비교표 */}
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  2. 대안별 공사비 및 교량 형식 비교
                </h2>
                <span className="text-[10px] text-slate-500">
                  기준: 1안({baseAlt.name}) 대비 증감률
                </span>
              </div>

              <table className="w-full text-[10.5px] text-left">
                <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                  <tr>
                    <th className="py-1.5 px-2.5">대안 이름</th>
                    <th className="py-1.5 px-2">교량 상부구조 형식</th>
                    <th className="py-1.5 px-2">연장 / 교각 수</th>
                    <th className="py-1.5 px-2 text-right">직접공사비</th>
                    <th className="py-1.5 px-2 text-right">총공사비</th>
                    <th className="py-1.5 px-2 text-right">1㎡당 단가</th>
                    <th className="py-1.5 px-2.5 text-center">비교</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportItems.slice(0, 6).map((alt, idx) => {
                    const isMin = alt.id === cheapestAlt.id && reportItems.length > 1;
                    const diffPct =
                      idx === 0
                        ? 0
                        : ((alt.costBreakdown.total_construction_cost -
                            baseAlt.costBreakdown.total_construction_cost) /
                            (baseAlt.costBreakdown.total_construction_cost || 1)) *
                          100;
                    const info = explainSuperstructureForStudent(alt.bridgeParams.spans);
                    return (
                      <tr key={alt.id} className={isMin ? 'bg-emerald-50/50 font-semibold' : ''}>
                        <td className="py-1.5 px-2.5 font-bold text-slate-900">
                          <span className="inline-flex items-center gap-1">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: alt.color || '#4F46E5' }}
                            />
                            {alt.name}
                            {isMin && (
                              <span className="text-[9px] bg-emerald-600 text-white px-1 py-0.2 rounded font-bold">
                                최저가
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-slate-700 truncate max-w-[140px]">
                          {info.shortName}
                        </td>
                        <td className="py-1.5 px-2 text-slate-600">
                          L={alt.bridgeParams.bridge_length}m / 교각 {alt.bridgeParams.piers.length}기
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono text-slate-700">
                          {formatBillion(alt.costBreakdown.direct_cost_total)}억
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-extrabold text-indigo-700">
                          {formatBillion(alt.costBreakdown.total_construction_cost)}억
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono text-slate-800">
                          {Math.round(alt.costBreakdown.unit_cost_per_m2 / 10000).toLocaleString()}만
                        </td>
                        <td className="py-1.5 px-2.5 text-center font-bold">
                          {idx === 0 ? (
                            <span className="text-slate-400">기준안</span>
                          ) : (
                            <span className={diffPct > 0 ? 'text-rose-600' : 'text-emerald-600'}>
                              {diffPct > 0 ? `+${diffPct.toFixed(1)}%` : `${diffPct.toFixed(1)}%`}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {reportItems.length > 6 && (
                <div className="px-3 py-1 bg-amber-50 text-[10px] text-amber-800 border-t border-amber-200">
                  ※ 총 {reportItems.length}개 대안 중 상위 6개 안을 표에 요약했으며, 모든 대안의 상세 내역과 3D 스틸컷은 다음 페이지부터 1개씩 제공됩니다.
                </div>
              )}
            </div>

            {/* 3. 한눈에 보는 공사비 비교 막대 그래프 */}
            <ReportComparisonSvgChart items={reportItems} minCostId={cheapestAlt.id} />

            {/* 3. 종합 분석 결론 */}
            <div className="rounded-lg border-2 border-emerald-200 bg-emerald-50/60 p-3 flex items-start gap-2.5">
              <Award className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-[11px] text-slate-800 leading-relaxed">
                <strong className="text-emerald-900 block mb-0.5">
                  3. 종합 분석 결론
                </strong>
                {reportItems.length === 1 ? (
                  <span>
                    현재 계획된 <b>[{cheapestAlt.name}]</b>의 예상 총공사비는{' '}
                    <b className="text-indigo-700">
                      {formatBillion(cheapestAlt.costBreakdown.total_construction_cost)}억 원
                    </b>
                    (1㎡당 약{' '}
                    <b>
                      {Math.round(cheapestAlt.costBreakdown.unit_cost_per_m2 / 10000).toLocaleString()}만 원
                    </b>
                    )입니다. 비교 대안을 추가로 저장하면 경제성과 교량 형식을 나란히 비교할 수 있습니다.
                  </span>
                ) : (
                  <span>
                    비교한 {reportItems.length}개 대안 가운데 건설 비용이 가장 경제적인 안은{' '}
                    <b className="text-emerald-800">[{cheapestAlt.name}]</b>으로 총공사비{' '}
                    <b>{formatBillion(cheapestAlt.costBreakdown.total_construction_cost)}억 원</b>입니다.{' '}
                    최대 공사비 안인 <b>[{mostExpensiveAlt.name}]</b>(
                    {formatBillion(mostExpensiveAlt.costBreakdown.total_construction_cost)}억 원) 대비 약{' '}
                    <b className="text-emerald-700">
                      {formatBillion(
                        mostExpensiveAlt.costBreakdown.total_construction_cost -
                          cheapestAlt.costBreakdown.total_construction_cost
                      )}
                      억 원
                    </b>
                    의 예산 차이가 발생하므로, 경제성 우선 시 <b>{cheapestAlt.name}</b>을, 장경간 횡단이나 경관성 확보가 필요한 경우에는 특수교 대안을 검토하는 것이 타당합니다.
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 페이지 1 푸터 */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
            <span>{displayProjectTitle} · 교량 대안별 공사비 분석 보고서</span>
            <span className="font-mono font-bold text-slate-600">
              Page 1 / {totalPages}
            </span>
          </div>
        </section>

        {/* ================================================================
            PAGES 2 ~ N: 각 대안별 A4 1페이지 전담 (BIM 스틸컷 2컷 + 현황·공사비 분석)
           ================================================================ */}
        {reportItems.map((alt, idx) => {
          const p = alt.bridgeParams;
          const cb = alt.costBreakdown;
          const snap = snapshots[alt.id];
          const structInfo = explainSuperstructureForStudent(p.spans);

          const totalB = formatBillion(cb.total_construction_cost);
          const directB = formatBillion(cb.direct_cost_total);
          const unitMan = Math.round(cb.unit_cost_per_m2 / 10000);
          const indirectAndMisc = cb.miscellaneous_cost + cb.indirect_cost_markup;

          const totalDenominator = cb.total_construction_cost || 1;
          const pctSuper = Math.round((cb.superstructure_cost / totalDenominator) * 100);
          const pctSub = Math.round((cb.substructure_total / totalDenominator) * 100);
          const pctFound = Math.round((cb.foundation_cost / totalDenominator) * 100);
          const pctAnc = Math.round((cb.ancillary_cost / totalDenominator) * 100);
          const pctInd = Math.max(0, 100 - pctSuper - pctSub - pctFound - pctAnc);

          const diffFromBasePct =
            idx === 0
              ? 0
              : ((cb.total_construction_cost - baseAlt.costBreakdown.total_construction_cost) /
                  (baseAlt.costBreakdown.total_construction_cost || 1)) *
                100;

          const maxPierHeight = p.piers.length > 0 ? Math.max(...p.piers.map((pr) => pr.height)) : 0;
          const totalPilesCount =
            p.abutments.reduce((acc, ab) => acc + (ab.foundation === 'PILE' ? ab.pile_count : 0), 0) +
            p.piers.reduce((acc, pr) => acc + (pr.foundation === 'PILE' ? pr.pile_count : 0), 0);

          const spanLengthSummary = p.spans.map((sp) => `${sp.span_length}m`).join(' + ');

          return (
            <section key={alt.id} className="report-a4-page">
              <div className="space-y-3.5">
                {/* 대안 헤더 배너 */}
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: alt.color || '#4F46E5' }}
                      />
                      <span className="text-[10px] font-bold text-indigo-600">
                        제{idx + 1}안 상세 분석
                      </span>
                      {alt.id === cheapestAlt.id && reportItems.length > 1 && (
                        <span className="text-[9.5px] font-extrabold bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                          최저 공사비
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-extrabold text-slate-900 mt-0.5">
                      [{alt.name}] 3D BIM 모델 및 공사비 분석
                    </h2>
                  </div>

                  <div className="text-right bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5">
                    <span className="text-[10px] text-indigo-700 font-bold block">예상 총공사비</span>
                    <span className="text-base font-extrabold text-indigo-900 font-mono">
                      {totalB} 억 원
                    </span>
                    <span className="text-[10px] text-slate-600 block">
                      1㎡당 {unitMan.toLocaleString()}만 원
                      {idx > 0 &&
                        ` · 1안 대비 ${diffFromBasePct > 0 ? '+' : ''}${diffFromBasePct.toFixed(1)}%`}
                    </span>
                  </div>
                </div>

                {/* ① 3D BIM 모델 스틸컷 2컷 */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-indigo-600" />
                      1) 3D BIM 모델 스틸컷
                    </h3>
                    <span className="text-[10px] text-slate-500">
                      {structInfo.shortName} · 교량 {p.bridge_length}m + 접속 토공
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="border border-slate-300 rounded-lg overflow-hidden bg-slate-950">
                      <div className="aspect-video w-full flex items-center justify-center bg-slate-900 overflow-hidden">
                        {snap?.isoDataUrl ? (
                          <img
                            src={snap.isoDataUrl}
                            alt={`${alt.name} 3D BIM 투시 조감 스틸컷`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            {isCapturing ? '3D 투시 스틸컷 생성 중...' : '스틸컷 없음'}
                          </span>
                        )}
                      </div>
                      <div className="bg-slate-800 text-slate-200 text-[10px] font-semibold px-2.5 py-1 flex items-center justify-between">
                        <span>[그림 1] 3D 전체 조감도</span>
                        <span className="text-sky-300">상·하부 및 접속 토공</span>
                      </div>
                    </div>

                    <div className="border border-slate-300 rounded-lg overflow-hidden bg-slate-950">
                      <div className="aspect-video w-full flex items-center justify-center bg-slate-900 overflow-hidden">
                        {snap?.elevationDataUrl ? (
                          <img
                            src={snap.elevationDataUrl}
                            alt={`${alt.name} 측면 종단 스틸컷`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            {isCapturing ? '측면 종단 스틸컷 생성 중...' : '스틸컷 없음'}
                          </span>
                        )}
                      </div>
                      <div className="bg-slate-800 text-slate-200 text-[10px] font-semibold px-2.5 py-1 flex items-center justify-between">
                        <span>[그림 2] 측면 종단도</span>
                        <span className="text-amber-300">{p.spans.length}경간 ({spanLengthSummary})</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ② 교량 구조 형식 및 주요 제원 */}
                <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold text-slate-900">
                      2) 교량 구조 형식 및 주요 제원 — {structInfo.easyTitle}
                    </h3>
                  </div>
                  <p className="text-[10.5px] text-slate-700 leading-relaxed bg-white p-2.5 rounded border border-slate-200">
                    {structInfo.description}
                  </p>

                  <div className="grid grid-cols-4 gap-2 text-[10px]">
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <span className="text-slate-500 block">교량 연장 및 폭원</span>
                      <strong className="text-slate-900 text-[11px]">
                        {p.bridge_length}m × {p.bridge_width}m
                      </strong>
                      <span className="text-indigo-600 block mt-0.5">
                        교면 면적 {cb.total_deck_area_m2.toLocaleString()}㎡
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <span className="text-slate-500 block">경간 구성</span>
                      <strong className="text-slate-900 text-[11px]">
                        총 {p.spans.length}개 경간
                      </strong>
                      <span className="text-slate-600 block mt-0.5 truncate" title={spanLengthSummary}>
                        {spanLengthSummary}
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <span className="text-slate-500 block">하부구조 (교각 · 교대)</span>
                      <strong className="text-slate-900 text-[11px]">
                        교각 {p.piers.length}기 · 교대 2개소
                      </strong>
                      <span className="text-slate-600 block mt-0.5">
                        최고 교각 높이 약 {maxPierHeight.toFixed(1)}m
                      </span>
                    </div>
                    <div className="bg-white p-2 rounded border border-slate-200">
                      <span className="text-slate-500 block">기초 형식</span>
                      <strong className="text-slate-900 text-[11px]">
                        {totalPilesCount > 0 ? `강관 말뚝 ${totalPilesCount}본` : '직접 기초'}
                      </strong>
                      <span className="text-slate-600 block mt-0.5">
                        {cb.total_pile_length > 0
                          ? `총 연장 ${cb.total_pile_length.toLocaleString()}m (${p.pile_method})`
                          : '암반 직접 지지'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ③ 공종별 공사비 구성 분석 */}
                <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-extrabold text-slate-900">
                      3) 공종별 공사비 구성 분석
                    </h3>
                    <span className="text-[10px] text-slate-500">
                      직접비 {directB}억 + 기타·간접비 {formatBillion(indirectAndMisc)}억 ={' '}
                      <b className="text-indigo-700">{totalB}억 원</b>
                    </span>
                  </div>

                  {/* 100% 누적 비율 바 */}
                  <div className="space-y-1">
                    <div className="h-4 w-full rounded-full overflow-hidden flex border border-slate-200 text-[9px] font-bold text-white text-center leading-4">
                      {pctSuper > 0 && (
                        <div className="bg-blue-600" style={{ width: `${pctSuper}%` }}>
                          {pctSuper >= 10 ? `상부 ${pctSuper}%` : ''}
                        </div>
                      )}
                      {pctSub > 0 && (
                        <div className="bg-emerald-500" style={{ width: `${pctSub}%` }}>
                          {pctSub >= 10 ? `하부 ${pctSub}%` : ''}
                        </div>
                      )}
                      {pctFound > 0 && (
                        <div className="bg-amber-500" style={{ width: `${pctFound}%` }}>
                          {pctFound >= 8 ? `기초 ${pctFound}%` : ''}
                        </div>
                      )}
                      {pctAnc > 0 && (
                        <div className="bg-violet-500" style={{ width: `${pctAnc}%` }}>
                          {pctAnc >= 8 ? `${pctAnc}%` : ''}
                        </div>
                      )}
                      {pctInd > 0 && (
                        <div className="bg-slate-400" style={{ width: `${pctInd}%` }}>
                          {pctInd >= 10 ? `간접 ${pctInd}%` : ''}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 공종별 상세 내역표 */}
                  <table className="w-full text-[10px] text-left border-t border-slate-200">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="py-1.5 px-2">공종 구분</th>
                        <th className="py-1.5 px-2">주요 시공 내용</th>
                        <th className="py-1.5 px-2 text-right">공사비</th>
                        <th className="py-1.5 px-2 text-right">구성비</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-1.5 px-2 font-bold text-blue-700">① 상부공</td>
                        <td className="py-1.5 px-2 text-slate-600">
                          교량 바닥판·교면포장 및 거더·아치·케이블 등 상부 본체 ({p.spans.length}경간)
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900">
                          {formatBillion(cb.superstructure_cost)}억 원
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono text-slate-600">{pctSuper}%</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 font-bold text-emerald-700">② 하부공</td>
                        <td className="py-1.5 px-2 text-slate-600">
                          양단 교대 2개소 및 중간 교각 {p.piers.length}기
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900">
                          {formatBillion(cb.substructure_total)}억 원
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono text-slate-600">{pctSub}%</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 font-bold text-amber-700">③ 기초공</td>
                        <td className="py-1.5 px-2 text-slate-600">
                          {cb.total_pile_length > 0
                            ? `강관 말뚝 기초 시공 (D508, 총 연장 ${cb.total_pile_length.toLocaleString()}m)`
                            : '직접 기초 (단단한 암반 지지)'}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900">
                          {formatBillion(cb.foundation_cost)}억 원
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono text-slate-600">{pctFound}%</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 font-bold text-violet-700">④ 부대·가시설·토공</td>
                        <td className="py-1.5 px-2 text-slate-600">
                          방호울타리·신축이음 등 부대공, 물막이 가시설 및 교대 접속 토공
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900">
                          {formatBillion(cb.ancillary_cost)}억 원
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono text-slate-600">{pctAnc}%</td>
                      </tr>
                      <tr>
                        <td className="py-1.5 px-2 font-bold text-slate-600">⑤ 기타·간접제잡비</td>
                        <td className="py-1.5 px-2 text-slate-600">
                          기타공사(10%) 및 간접공사비·제잡비({(p.markup_rate * 100).toFixed(1)}%)
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900">
                          {formatBillion(indirectAndMisc)}억 원
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono text-slate-600">{pctInd}%</td>
                      </tr>
                      <tr className="bg-indigo-50/70 font-extrabold text-indigo-950">
                        <td className="py-1.5 px-2" colSpan={2}>
                          총공사비 합계 (직접비 {directB}억 원 + 간접·제잡비 포함)
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono text-indigo-700">
                          {totalB}억 원
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono">100%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 페이지 푸터 */}
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
                <span>
                  {displayProjectTitle} · [{alt.name}] 상세 분석
                </span>
                <span className="font-mono font-bold text-slate-600">
                  Page {idx + 2} / {totalPages}
                </span>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

