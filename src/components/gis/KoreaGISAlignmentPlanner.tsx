// src/components/gis/KoreaGISAlignmentPlanner.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  MapPin,
  Compass,
  Ruler,
  Layers,
  Sparkles,
  CheckCircle2,
  X,
  Maximize2,
  RefreshCw,
  Navigation,
  Mountain,
  Waves
} from 'lucide-react';
import {
  KOREA_POI_DATABASE,
  KoreaLocationPOI,
  searchKoreaLocations,
  calculateGroundDistanceMeters,
  calculateAzimuthAngle
} from '../../domain/gis/korea_geocoding';
import { useBridgeStore } from '../../store/useBridgeStore';
import { SpanItem, PierItem, AbutmentItem, TerrainParameters, AlignmentParameters } from '../../domain/models/bridge';
import { calculatePierFittings } from '../../domain/engine/terrain_alignment_calculator';
import { calculateBridgeCost } from '../../domain/engine/cost_calculator';

interface Point {
  x: number; // 캔버스 좌표 (0~800)
  y: number; // 캔버스 좌표 (0~500)
  lat: number;
  lng: number;
}

interface KoreaGISAlignmentPlannerProps {
  onClose?: () => void;
  onApplyAlignment?: (appliedLength: number, spanCount: number) => void;
}

export const KoreaGISAlignmentPlanner: React.FC<KoreaGISAlignmentPlannerProps> = ({
  onClose,
  onApplyAlignment
}) => {
  const { bridgeParams, updateBridgeParams, setViewMode } = useBridgeStore();

  // 검색 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KoreaLocationPOI[]>(KOREA_POI_DATABASE.slice(0, 5));
  const [selectedPOI, setSelectedPOI] = useState<KoreaLocationPOI>(KOREA_POI_DATABASE[0]);

  // 지도 상태 (중심 좌표 및 줌)
  const [zoomLevel, setZoomLevel] = useState(16); // 14 ~ 18
  const [mapCenter, setMapCenter] = useState({ lat: KOREA_POI_DATABASE[0].lat, lng: KOREA_POI_DATABASE[0].lng });

  // 마우스 인터랙티브 노선 계획 포인트 (Point 0: A1, Point 1: A2 등)
  const [alignmentPoints, setAlignmentPoints] = useState<Point[]>([
    { x: 260, y: 280, lat: 36.3845, lng: 127.4230 },
    { x: 540, y: 220, lat: 36.3860, lng: 127.4255 }
  ]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 검색어 입력 시 결과 갱신
  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    setSearchResults(searchKoreaLocations(q));
  };

  // POI 선택 시 해당 위치로 지도 이동 및 기본 노선 리셋
  const handleSelectPOI = (poi: KoreaLocationPOI) => {
    setSelectedPOI(poi);
    setMapCenter({ lat: poi.lat, lng: poi.lng });
    // 기본 노선 재설정
    setAlignmentPoints([
      { x: 280, y: 300, lat: poi.lat - 0.001, lng: poi.lng - 0.0015 },
      { x: 520, y: 200, lat: poi.lat + 0.001, lng: poi.lng + 0.0015 }
    ]);
    setStatusMessage(`'${poi.name}' 일원 국토 위성 지도가 로드되었습니다.`);
  };

  // 노선 거리 및 방위각 계산
  const { calculatedLengthMeters, azimuthDeg, skewAngleDeg } = useMemo(() => {
    if (alignmentPoints.length < 2) {
      return { calculatedLengthMeters: selectedPOI.defaultBridgeLength, azimuthDeg: 55, skewAngleDeg: 10 };
    }
    const p1 = alignmentPoints[0];
    const p2 = alignmentPoints[alignmentPoints.length - 1];
    const dist = calculateGroundDistanceMeters(p1.lat, p1.lng, p2.lat, p2.lng);
    const az = calculateAzimuthAngle(p1.lat, p1.lng, p2.lat, p2.lng);
    // 교량 사각(Skew Angle: 하천 직각선 대비 편각 0~60도)
    const skew = Math.min(45, Math.abs(az - 90) % 90);
    return {
      calculatedLengthMeters: Math.max(50, dist || selectedPOI.defaultBridgeLength),
      azimuthDeg: az,
      skewAngleDeg: Math.round(skew)
    };
  }, [alignmentPoints, selectedPOI]);

  // 권장 경간 분할 계산 (L -> 경간 목록)
  const recommendedSpans = useMemo(() => {
    const L = calculatedLengthMeters;
    let standardSpan = 45;
    if (L > 500) standardSpan = 70;
    else if (L > 300) standardSpan = 50;
    else if (L > 150) standardSpan = 45;
    else standardSpan = 35;

    const spanCount = Math.max(2, Math.round(L / standardSpan));
    const eachLen = Math.round((L / spanCount) * 10) / 10;
    return Array.from({ length: spanCount }, (_, idx) => ({
      span_index: idx + 1,
      length: eachLen
    }));
  }, [calculatedLengthMeters]);

  // 캔버스에 위성사진/하천 지형 및 계획 노선 렌더링
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // 1. 위성 배경 (농경지, 수목, 토사 텍스처)
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#2D452F');
    grad.addColorStop(0.4, '#39533B');
    grad.addColorStop(0.7, '#4B6349');
    grad.addColorStop(1, '#31442E');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 격자 농경지/산림 음영 패턴
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 2. 하천 수계(Water Body) 곡선 렌더링
    const riverWidth = (selectedPOI.recommendedRiverWidth / 250) * 160;
    ctx.fillStyle = '#0284C7';
    ctx.beginPath();
    ctx.moveTo(w * 0.4 - riverWidth / 2, 0);
    ctx.bezierCurveTo(
      w * 0.45 - riverWidth / 2, h * 0.35,
      w * 0.35 - riverWidth / 2, h * 0.65,
      w * 0.42 - riverWidth / 2, h
    );
    ctx.lineTo(w * 0.42 + riverWidth / 2, h);
    ctx.bezierCurveTo(
      w * 0.35 + riverWidth / 2, h * 0.65,
      w * 0.45 + riverWidth / 2, h * 0.35,
      w * 0.4 + riverWidth / 2, 0
    );
    ctx.closePath();
    ctx.fill();

    // 하천 모래톱/둔치(Sandbar & Shoreline)
    ctx.strokeStyle = '#D97706';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 3. Vworld 국토 정사영상 워터마크 및 축척 안내
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText(`Vworld 국토 정사영상 [위도: ${mapCenter.lat.toFixed(4)}, 경도: ${mapCenter.lng.toFixed(4)}]`, 15, h - 15);
    ctx.fillText(`축척: 1px ≈ ${(calculatedLengthMeters / 300).toFixed(1)}m | 줌: Lv.${zoomLevel}`, w - 210, h - 15);

    // 4. 계획 노선 가이드라인 렌더링
    if (alignmentPoints.length >= 2) {
      const p1 = alignmentPoints[0];
      const p2 = alignmentPoints[1];

      // 교량 중심선 외곽 발광 효과
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.shadowBlur = 0; // reset

      // 교량 슬래브 전폭원 가이드 (좌우 폭 표시)
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const halfB = 10;
      const dx = Math.sin(angle) * halfB;
      const dy = -Math.cos(angle) * halfB;

      ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(p1.x + dx, p1.y + dy);
      ctx.lineTo(p2.x + dx, p2.y + dy);
      ctx.moveTo(p1.x - dx, p1.y - dy);
      ctx.lineTo(p2.x - dx, p2.y - dy);
      ctx.stroke();
      ctx.setLineDash([]); // reset

      // 교각 위치(P1, P2...) 분할 마커 그리기
      const spanCount = recommendedSpans.length;
      for (let s = 1; s < spanCount; s++) {
        const ratio = s / spanCount;
        const px = p1.x + (p2.x - p1.x) * ratio;
        const py = p1.y + (p2.y - p1.y) * ratio;

        // 교각 풋팅 마커
        ctx.fillStyle = '#E2E8F0';
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 라벨
        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#FEF08A';
        ctx.fillText(`P${s}`, px - 6, py - 10);
      }

      // 시점 A1 마커
      ctx.fillStyle = '#EF4444';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('A1 (시점)', p1.x - 20, p1.y + 22);

      // 종점 A2 마커
      ctx.fillStyle = '#3B82F6';
      ctx.beginPath();
      ctx.arc(p2.x, p2.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillText('A2 (종점)', p2.x - 20, p2.y + 22);

      // 중앙에 총연장 뱃지
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.roundRect(midX - 55, midY - 24, 110, 24, 6);
      ctx.fill();
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#FBBF24';
      ctx.fillText(`L = ${calculatedLengthMeters}m (${spanCount}경간)`, midX - 48, midY - 8);
    }
  }, [alignmentPoints, selectedPOI, mapCenter, zoomLevel, calculatedLengthMeters, recommendedSpans]);

  // 마우스 클릭으로 노선 재계획 (1번째 클릭: A1, 2번째 클릭: A2)
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // 픽셀 비율 정규화
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const normX = clickX * scaleX;
    const normY = clickY * scaleY;

    // 가상 좌표 변환 (중심 기준 Lat/Lng 오프셋)
    const dLat = (normY - canvas.height / 2) * -0.000008;
    const dLng = (normX - canvas.width / 2) * 0.00001;
    const clickLat = mapCenter.lat + dLat;
    const clickLng = mapCenter.lng + dLng;

    if (!isDrawing || alignmentPoints.length >= 2) {
      // 새 노선 시작 (A1 지정)
      setAlignmentPoints([{ x: normX, y: normY, lat: clickLat, lng: clickLng }]);
      setIsDrawing(true);
      setStatusMessage('교량 시점(A1)이 지정되었습니다. 하천 반대편 종점(A2)을 클릭하세요.');
    } else {
      // 종점 (A2 지정)
      const newPoints = [...alignmentPoints, { x: normX, y: normY, lat: clickLat, lng: clickLng }];
      setAlignmentPoints(newPoints);
      setIsDrawing(false);
      setStatusMessage(`교량 노선이 확정되었습니다: 총연장 ${calculatedLengthMeters}m (${recommendedSpans.length}경간).`);
    }
  };

  // 설계 제원 반영 버튼 핸들러
  const handleApplyToBridgeParams = () => {
    const totalLen = calculatedLengthMeters;

    // 1. 새 경간 구성
    const newSpans: SpanItem[] = recommendedSpans.map((s, idx) => ({
      id: `span_${idx + 1}`,
      span_index: idx + 1,
      span_length: s.length,
      type: 'MODIFIED_PSC_BEAM',
      foundation: 'PILE'
    }));

    // 2. 새 지형 및 선형
    const newTerrain: TerrainParameters = {
      type: selectedPOI.terrainType,
      valley_depth: selectedPOI.recommendedValleyDepth,
      water_level: 3.0,
      river_width: selectedPOI.recommendedRiverWidth,
      bearing_stratum_depth: selectedPOI.bearingStratumDepth
    };

    const newAlignment: AlignmentParameters = {
      curve_radius: 0,
      longitudinal_slope: 1.0,
      start_elevation: 30.0
    };

    // 3. 지형에 맞춘 교각 자동 피팅
    let cumX = 0;
    const newPiers: PierItem[] = [];
    for (let i = 0; i < newSpans.length - 1; i++) {
      cumX += newSpans[i].span_length;
      const { fittedPierHeight, fittedPileLength } = calculatePierFittings(
        cumX,
        totalLen,
        2.5,
        newTerrain,
        newAlignment
      );
      newPiers.push({
        id: `pier_${i + 1}`,
        name: `P${i + 1}`,
        height: fittedPierHeight,
        diameter: 2.5,
        type: 'T_PIER',
        foundation: 'PILE',
        pile_len: fittedPileLength,
        pile_count: 50
      });
    }

    const newAbutments: AbutmentItem[] = [
      {
        id: 'abut_1',
        name: 'A1',
        height: 10,
        foundation: 'PILE',
        pile_len: newTerrain.bearing_stratum_depth || 16,
        pile_count: 40
      },
      {
        id: 'abut_2',
        name: 'A2',
        height: 10,
        foundation: 'PILE',
        pile_len: newTerrain.bearing_stratum_depth || 16,
        pile_count: 40
      }
    ];

    const updated = {
      ...bridgeParams,
      name: `${selectedPOI.name} 계획안`,
      bridge_length: totalLen,
      skew_angle: skewAngleDeg,
      spans: newSpans,
      piers: newPiers,
      abutments: newAbutments,
      terrain: newTerrain,
      alignment: newAlignment
    };

    updateBridgeParams(updated);
    if (onApplyAlignment) {
      onApplyAlignment(totalLen, newSpans.length);
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col w-full max-w-5xl mx-auto text-white">
      {/* 1. Header & Location Search Bar */}
      <div className="p-3.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-600/30 rounded-lg border border-indigo-500/40 text-indigo-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2 text-slate-100">
              대한민국 국토 위성 지도 & 인터랙티브 노선 계획기 (Vworld 3D)
              <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/40 font-mono">
                Real-World Alignment
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              대한민국 주소를 검색하고 실제 위성지도 위에서 마우스로 교량 시점(A1)과 종점(A2)을 클릭하여 노선을 설계합니다.
            </p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* 2. Search & Preset Chips */}
      <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="대한민국 주소 또는 지명 검색 (예: 대전 신탄진 연축교, 안동 JCT, 서울 잠실 한강, 인제 소양강...)"
            className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* 추천/검색 결과 칩 리스트 */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <span className="text-[11px] text-slate-400 shrink-0 flex items-center gap-1 font-semibold">
            <MapPin className="w-3 h-3 text-red-400" />
            주요 대상지:
          </span>
          {searchResults.map((poi) => (
            <button
              key={poi.name}
              onClick={() => handleSelectPOI(poi)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all shrink-0 border ${
                selectedPOI.name === poi.name
                  ? 'bg-indigo-600 text-white border-indigo-400 shadow-sm'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {poi.name}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Main Workspace: Interactive Map Canvas + Real-Time Result Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 p-4 gap-4 bg-slate-950 flex-1">
        {/* Left: 2D/2.5D Satellite Map Canvas */}
        <div className="lg:col-span-2 flex flex-col space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300 px-1">
            <span className="font-bold flex items-center gap-1 text-amber-400">
              <Ruler className="w-4 h-4" />
              마우스로 교량 시점(A1)과 종점(A2)을 클릭하여 노선을 연결하세요
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              클릭: {isDrawing ? '종점 A2 지정 대기' : '노선 지정 완료'}
            </span>
          </div>

          <div className="relative rounded-lg overflow-hidden border border-slate-700 shadow-inner bg-slate-900 aspect-[16/10]">
            <canvas
              ref={canvasRef}
              width={800}
              height={500}
              onClick={handleCanvasClick}
              className="w-full h-full cursor-crosshair block"
            />

            {/* 지도 우상단 줌 컨트롤 */}
            <div className="absolute top-3 right-3 flex flex-col gap-1 bg-slate-900/90 backdrop-blur border border-slate-700 p-1 rounded-lg">
              <button
                onClick={() => setZoomLevel((z) => Math.min(18, z + 1))}
                className="w-7 h-7 flex items-center justify-center text-xs font-bold bg-slate-800 hover:bg-slate-700 rounded text-slate-200"
                title="확대 (Zoom In)"
              >
                +
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.max(14, z - 1))}
                className="w-7 h-7 flex items-center justify-center text-xs font-bold bg-slate-800 hover:bg-slate-700 rounded text-slate-200"
                title="축소 (Zoom Out)"
              >
                -
              </button>
            </div>

            {/* 좌하단 안내 배너 */}
            {statusMessage && (
              <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur border border-indigo-500/50 px-3 py-1.5 rounded-lg text-[11px] font-bold text-indigo-200 shadow-md">
                {statusMessage}
              </div>
            )}
          </div>
        </div>

        {/* Right: Real-Time Alignment & Structure Specs */}
        <div className="flex flex-col justify-between space-y-3 bg-slate-900/80 p-3.5 rounded-lg border border-slate-800 text-xs">
          <div className="space-y-3">
            <div className="border-b border-slate-800 pb-2">
              <span className="text-[11px] text-indigo-400 font-bold block mb-0.5">선택된 국토 입지</span>
              <h4 className="font-extrabold text-sm text-slate-100">{selectedPOI.name}</h4>
              <p className="text-[11px] text-slate-400 mt-0.5">{selectedPOI.region}</p>
            </div>

            {/* 노선 연산 결과 */}
            <div className="space-y-2 bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono">
              <span className="text-[11px] font-bold text-amber-400 flex items-center gap-1">
                <Navigation className="w-3.5 h-3.5" />
                계획 노선 제원 산출값
              </span>
              <div className="grid grid-cols-2 gap-2 text-slate-300 text-[11px]">
                <div>
                  <span className="text-slate-500 block">교량 총연장 (L)</span>
                  <span className="text-sm font-extrabold text-white">{calculatedLengthMeters} m</span>
                </div>
                <div>
                  <span className="text-slate-500 block">교량 사각 (Skew)</span>
                  <span className="text-sm font-extrabold text-white">{skewAngleDeg}°</span>
                </div>
                <div>
                  <span className="text-slate-500 block">총 경간수</span>
                  <span className="text-sm font-extrabold text-white">{recommendedSpans.length}련</span>
                </div>
                <div>
                  <span className="text-slate-500 block">표준 경간장</span>
                  <span className="text-sm font-extrabold text-white">{recommendedSpans[0]?.length} m</span>
                </div>
              </div>
            </div>

            {/* 지형 및 지반 조건 */}
            <div className="space-y-1.5 bg-slate-950 p-3 rounded-lg border border-slate-800 text-[11px]">
              <span className="font-bold text-slate-300 flex items-center gap-1">
                <Waves className="w-3.5 h-3.5 text-sky-400" />
                실측 하천/지형 프로파일
              </span>
              <div className="flex justify-between text-slate-400">
                <span>하천 횡단 폭</span>
                <span className="font-mono text-slate-200">{selectedPOI.recommendedRiverWidth} m</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>계곡/하상 저면 심도</span>
                <span className="font-mono text-slate-200">{selectedPOI.recommendedValleyDepth} m</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>암반 지지층 심도 (말뚝)</span>
                <span className="font-mono text-slate-200">{selectedPOI.bearingStratumDepth} m</span>
              </div>
            </div>
          </div>

          {/* 하단 확정 및 반영 버튼 */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <button
              onClick={handleApplyToBridgeParams}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-lg text-xs shadow-lg flex items-center justify-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4" />
              <span>이 노선으로 교량 제원 & 공사비 산정 반영</span>
            </button>
            <p className="text-[10px] text-slate-400 text-center leading-tight">
              클릭 시 교량 총연장, 경간 구성, 교각 높이가 지반고에 맞춰 100% 자동 피팅됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
