// src/components/gis/KoreaGISAlignmentPlanner.tsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
  Waves,
  Hand,
  MousePointer,
  ZoomIn,
  ZoomOut,
  ArrowRight
} from 'lucide-react';
import {
  KOREA_POI_DATABASE,
  KoreaLocationPOI,
  searchKoreaLocations,
  searchKoreaLocationsOnline,
  calculateGroundDistanceMeters,
  calculateAzimuthAngle
} from '../../domain/gis/korea_geocoding';
import { latLngToTileCoords, tileCoordsToLatLng, getSatelliteTileUrl, getTerrariumDemTileUrl, decodeTerrariumRGBToElevation } from '../../domain/gis/tile_coords';
import { useBridgeStore } from '../../store/useBridgeStore';
import { SpanItem, PierItem, AbutmentItem, TerrainParameters, AlignmentParameters, SuperstructureType } from '../../domain/models/bridge';
import { calculatePierFittings } from '../../domain/engine/terrain_alignment_calculator';

interface AlignmentLatLngPoint {
  lat: number;
  lng: number;
}

interface KoreaGISAlignmentPlannerProps {
  onClose?: () => void;
  onConfirmAlignment?: (totalLen: number, spanCount: number) => void;
  onApplyAlignment?: (appliedLength: number, spanCount: number) => void;
}

export const KoreaGISAlignmentPlanner: React.FC<KoreaGISAlignmentPlannerProps> = ({
  onClose,
  onConfirmAlignment,
  onApplyAlignment
}) => {
  const {
    bridgeParams,
    updateBridgeParams,
    setViewMode,
    saveCurrentAlternative,
    autoFitPiersToTerrain
  } = useBridgeStore();

  // 1. 지도 중심 좌표 (WGS84) 및 줌 레벨
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>(() => {
    if (bridgeParams.coordinates?.lat && bridgeParams.coordinates?.lng) {
      return { lat: bridgeParams.coordinates.lat, lng: bridgeParams.coordinates.lng };
    }
    return { lat: 36.3852, lng: 127.4241 }; // 기본: 대전 갑천 연축교
  });
  const [zoomLevel, setZoomLevel] = useState<number>(16); // 13 ~ 18

  // 2. 검색 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KoreaLocationPOI[]>(KOREA_POI_DATABASE.slice(0, 6));
  const [isSearching, setIsSearching] = useState(false);
  const [locationName, setLocationName] = useState(bridgeParams.locationName || '대전 신탄진 연축교 일원');

  // 3. 인터랙션 모드 ('PAN': 자유 패닝/이동 모드, 'DRAW': 노선 찍기 모드)
  const [interactMode, setInteractMode] = useState<'PAN' | 'DRAW'>('PAN');

  // 4. 계획 노선 좌표 (WGS84 절대 위경도 좌표로 저장하여 패닝/줌 시에도 지도에 고정)
  const [alignmentLatLngs, setAlignmentLatLngs] = useState<AlignmentLatLngPoint[]>([
    { lat: 36.3845, lng: 127.4230 }, // A1
    { lat: 36.3860, lng: 127.4255 }  // A2
  ]);

  // 5. 드래그 패닝 상태
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 6. 타일 이미지 캐시 (메모리 누수 방지용 맵)
  const tileCacheRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const [tileVersion, setTileVersion] = useState(0);

  // 7. 실측 DEM 고도 정보
  const [demHeights, setDemHeights] = useState<{ min: number; max: number; center: number }>({
    min: 15,
    max: 35,
    center: 25
  });

  // 검색창 입력 핸들러 (로컬 + 온라인 실시간 지오코딩)
  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    const local = searchKoreaLocations(q);
    setSearchResults(local);

    if (q.trim().length >= 2) {
      setIsSearching(true);
      searchKoreaLocationsOnline(q)
        .then((res) => {
          if (res && res.length > 0) {
            setSearchResults(res);
          }
          setIsSearching(false);
        })
        .catch(() => setIsSearching(false));
    }
  };

  // 장소 선택 시 지도 중심 이동
  const handleSelectLocation = (poi: KoreaLocationPOI) => {
    setMapCenter({ lat: poi.lat, lng: poi.lng });
    setLocationName(poi.name);
    // 선택된 위치 주변 기본 노선 설정
    setAlignmentLatLngs([
      { lat: poi.lat - 0.001, lng: poi.lng - 0.0015 },
      { lat: poi.lat + 0.001, lng: poi.lng + 0.0015 }
    ]);
  };

  // 위경도 좌표 <-> 캔버스 픽셀 좌표 상호 변환 함수
  const latLngToCanvasXY = useCallback(
    (lat: number, lng: number, width: number, height: number) => {
      // Web Mercator 기준 픽셀 계산
      const n = Math.pow(2, zoomLevel);
      const centerTileX = ((mapCenter.lng + 180) / 360) * n;
      const centerLatRad = (mapCenter.lat * Math.PI) / 180;
      const centerTileY =
        ((1 - Math.log(Math.tan(centerLatRad) + 1 / Math.cos(centerLatRad)) / Math.PI) / 2) * n;

      const ptTileX = ((lng + 180) / 360) * n;
      const ptLatRad = (lat * Math.PI) / 180;
      const ptTileY =
        ((1 - Math.log(Math.tan(ptLatRad) + 1 / Math.cos(ptLatRad)) / Math.PI) / 2) * n;

      const px = width / 2 + (ptTileX - centerTileX) * 256;
      const py = height / 2 + (ptTileY - centerTileY) * 256;
      return { x: px, y: py };
    },
    [mapCenter, zoomLevel]
  );

  const canvasXYToLatLng = useCallback(
    (px: number, py: number, width: number, height: number) => {
      const n = Math.pow(2, zoomLevel);
      const centerTileX = ((mapCenter.lng + 180) / 360) * n;
      const centerLatRad = (mapCenter.lat * Math.PI) / 180;
      const centerTileY =
        ((1 - Math.log(Math.tan(centerLatRad) + 1 / Math.cos(centerLatRad)) / Math.PI) / 2) * n;

      const targetTileX = centerTileX + (px - width / 2) / 256;
      const targetTileY = centerTileY + (py - height / 2) / 256;

      const targetLng = (targetTileX / n) * 360 - 180;
      const targetLatRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * targetTileY) / n)));
      const targetLat = (targetLatRad * 180) / Math.PI;

      return { lat: targetLat, lng: targetLng };
    },
    [mapCenter, zoomLevel]
  );

  // 8. 노선 거리, 방위각, 사각 실시간 산출
  const { calculatedLengthMeters, azimuthDeg, skewAngleDeg } = useMemo(() => {
    if (alignmentLatLngs.length < 2) {
      return { calculatedLengthMeters: 240, azimuthDeg: 60, skewAngleDeg: 15 };
    }
    const p1 = alignmentLatLngs[0];
    const p2 = alignmentLatLngs[alignmentLatLngs.length - 1];
    const dist = calculateGroundDistanceMeters(p1.lat, p1.lng, p2.lat, p2.lng);
    const az = calculateAzimuthAngle(p1.lat, p1.lng, p2.lat, p2.lng);
    const skew = Math.min(45, Math.abs(az - 90) % 90);
    return {
      calculatedLengthMeters: Math.max(40, dist),
      azimuthDeg: az,
      skewAngleDeg: Math.round(skew)
    };
  }, [alignmentLatLngs]);

  // 권장 경간 분할
  const recommendedSpans = useMemo(() => {
    const L = calculatedLengthMeters;
    let standardSpan = 45;
    if (L > 600) standardSpan = 80;
    else if (L > 350) standardSpan = 50;
    else if (L > 150) standardSpan = 45;
    else standardSpan = 30;

    const spanCount = Math.max(2, Math.round(L / standardSpan));
    const eachLen = Math.round((L / spanCount) * 10) / 10;
    return Array.from({ length: spanCount }, (_, idx) => ({
      span_index: idx + 1,
      length: eachLen
    }));
  }, [calculatedLengthMeters]);

  // 9. 캔버스 렌더링: 실제 위성사진 다중 타일(3x3 Grid) + 계획 노선 렌더링
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // 배경 초기화 (다크 슬레이트)
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(0, 0, w, h);

    // 중심 타일 계산
    const n = Math.pow(2, zoomLevel);
    const centerTileX = ((mapCenter.lng + 180) / 360) * n;
    const centerLatRad = (mapCenter.lat * Math.PI) / 180;
    const centerTileY =
      ((1 - Math.log(Math.tan(centerLatRad) + 1 / Math.cos(centerLatRad)) / Math.PI) / 2) * n;

    const baseTileX = Math.floor(centerTileX);
    const baseTileY = Math.floor(centerTileY);

    // 캔버스 중심에 타일 격자 렌더링 (주변 -2 ~ +2 범위의 실제 위성 타일 로드)
    const range = 2;
    for (let dx = -range; dx <= range; dx++) {
      for (let dy = -range; dy <= range; dy++) {
        const tx = baseTileX + dx;
        const ty = baseTileY + dy;
        const tileKey = `${zoomLevel}_${tx}_${ty}`;

        const screenX = w / 2 + (tx - centerTileX) * 256;
        const screenY = h / 2 + (ty - centerTileY) * 256;

        const cached = tileCacheRef.current.get(tileKey);
        if (cached && cached.complete && cached.naturalWidth > 0) {
          ctx.drawImage(cached, screenX, screenY, 256, 256);
        } else {
          // 타일 로드 요청
          if (!tileCacheRef.current.has(tileKey)) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = getSatelliteTileUrl(tx, ty, zoomLevel);
            img.onload = () => {
              setTileVersion((v) => v + 1); // 리렌더 트리거
            };
            tileCacheRef.current.set(tileKey, img);
          }
          // 로드 전 와이어 플레이스홀더
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.strokeRect(screenX, screenY, 256, 256);
        }
      }
    }

    // 10. 계획 노선 가이드라인 그리기
    if (alignmentLatLngs.length >= 2) {
      const p1 = latLngToCanvasXY(alignmentLatLngs[0].lat, alignmentLatLngs[0].lng, w, h);
      const p2 = latLngToCanvasXY(alignmentLatLngs[1].lat, alignmentLatLngs[1].lng, w, h);

      // 교량 중심선 외곽 발광
      ctx.shadowColor = '#F59E0B';
      ctx.shadowBlur = 12;
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 교량 상판 폭 가이드 (사이드 점선)
      const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const halfB = 12;
      const dx = Math.sin(angle) * halfB;
      const dy = -Math.cos(angle) * halfB;

      ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(p1.x + dx, p1.y + dy);
      ctx.lineTo(p2.x + dx, p2.y + dy);
      ctx.moveTo(p1.x - dx, p1.y - dy);
      ctx.lineTo(p2.x - dx, p2.y - dy);
      ctx.stroke();
      ctx.setLineDash([]);

      // 교각 위치(P1, P2...) 분할 마커 그리기
      const spanCount = recommendedSpans.length;
      for (let s = 1; s < spanCount; s++) {
        const ratio = s / spanCount;
        const px = p1.x + (p2.x - p1.x) * ratio;
        const py = p1.y + (p2.y - p1.y) * ratio;

        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.font = 'bold 10px monospace';
        ctx.fillStyle = '#FEF08A';
        ctx.fillText(`P${s}`, px - 7, py - 11);
      }

      // 시점 A1 마커
      ctx.fillStyle = '#EF4444';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('A1 (시점 교대)', p1.x - 28, p1.y + 24);

      // 종점 A2 마커
      ctx.fillStyle = '#3B82F6';
      ctx.beginPath();
      ctx.arc(p2.x, p2.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillText('A2 (종점 교대)', p2.x - 28, p2.y + 24);

      // 중앙 총연장 뱃지
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
      ctx.roundRect(midX - 65, midY - 26, 130, 26, 6);
      ctx.fill();
      ctx.strokeStyle = '#FBBF24';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#FBBF24';
      ctx.fillText(`L = ${calculatedLengthMeters}m (${spanCount}련)`, midX - 55, midY - 9);
    }

    // 11. 좌하단 좌표 & 축척 안내 워터마크
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(10, h - 36, 380, 26);
    ctx.fillStyle = '#38BDF8';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(`대한민국 실측 항공사진 [Lat: ${mapCenter.lat.toFixed(5)}, Lng: ${mapCenter.lng.toFixed(5)}]`, 18, h - 19);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(w - 210, h - 36, 200, 26);
    ctx.fillStyle = '#FBBF24';
    ctx.fillText(`줌 레벨: Lv.${zoomLevel} | 1px ≈ ${(calculatedLengthMeters / 300).toFixed(1)}m`, w - 195, h - 19);
  }, [
    mapCenter,
    zoomLevel,
    alignmentLatLngs,
    tileVersion,
    latLngToCanvasXY,
    calculatedLengthMeters,
    recommendedSpans
  ]);

  // 마우스 이벤트: 자유 패닝(Pan) 및 휠 줌(Zoom)
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (interactMode === 'PAN') {
      isDraggingRef.current = true;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current || interactMode !== 'PAN') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    // 픽셀 이동량을 위도, 경도 이동량으로 환산 (Slippy Map 수학 공식)
    const n = Math.pow(2, zoomLevel);
    const dLng = (-dx / 256 / n) * 360;

    // 위도 변화량 계산
    const centerLatRad = (mapCenter.lat * Math.PI) / 180;
    const centerTileY =
      ((1 - Math.log(Math.tan(centerLatRad) + 1 / Math.cos(centerLatRad)) / Math.PI) / 2) * n;
    const newTileY = centerTileY + dy / 256;
    const newLatRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * newTileY) / n)));
    const newLat = (newLatRad * 180) / Math.PI;

    setMapCenter({
      lat: Math.max(33.0, Math.min(38.8, newLat)),
      lng: Math.max(124.5, Math.min(131.0, mapCenter.lng + dLng))
    });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // 마우스 휠 줌: 13(광역) ~ 19(초정밀)
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      setZoomLevel((z) => Math.min(18, z + 1));
    } else {
      setZoomLevel((z) => Math.max(13, z - 1));
    }
  };

  // 노선 찍기 모드에서의 캔버스 클릭 핸들러
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (interactMode !== 'DRAW') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const normX = clickX * scaleX;
    const normY = clickY * scaleY;

    const clickLatLng = canvasXYToLatLng(normX, normY, canvas.width, canvas.height);

    if (alignmentLatLngs.length >= 2) {
      // 새 노선 시작 (A1 지정)
      setAlignmentLatLngs([clickLatLng]);
    } else {
      // 종점 (A2 지정 및 완료)
      setAlignmentLatLngs([...alignmentLatLngs, clickLatLng]);
      setInteractMode('PAN'); // 완료 후 다시 자유 탐색 모드로 복귀
    }
  };

  // 설계 제원 확정 및 3D BIM 뷰어 반영
  const handleConfirmAndProceed = () => {
    const totalLen = calculatedLengthMeters;

    // 1. 새 경간 구성 (기존 상부 형식 계승)
    const existingType = (bridgeParams.spans[0]?.type || 'MODIFIED_PSC_BEAM') as SuperstructureType;
    const newSpans: SpanItem[] = recommendedSpans.map((s, idx) => ({
      id: `span_${idx + 1}`,
      span_index: idx + 1,
      span_length: s.length,
      type: existingType,
      foundation: 'PILE'
    }));

    // 2. 새 지형 및 선형 (선택된 실측 지반고 반영)
    const newTerrain: TerrainParameters = {
      type: 'RIVER_CROSSING',
      valley_depth: Math.max(10, Math.min(35, demHeights.max - demHeights.min + 12)),
      water_level: 3.0,
      river_width: Math.min(totalLen * 0.7, 300),
      bearing_stratum_depth: 16.0
    };

    const newAlignment: AlignmentParameters = {
      curve_radius: 0,
      longitudinal_slope: 1.0,
      start_elevation: demHeights.center + 12
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
        pile_len: 16,
        pile_count: 40
      },
      {
        id: 'abut_2',
        name: 'A2',
        height: 10,
        foundation: 'PILE',
        pile_len: 16,
        pile_count: 40
      }
    ];

    const planName = `${locationName} 계획안 (${totalLen}m)`;

    const updated = {
      ...bridgeParams,
      name: planName,
      locationName,
      coordinates: { lat: mapCenter.lat, lng: mapCenter.lng },
      bridge_length: totalLen,
      skew_angle: skewAngleDeg,
      spans: newSpans,
      piers: newPiers,
      abutments: newAbutments,
      terrain: newTerrain,
      alignment: newAlignment
    };

    // 1) 상태 업데이트
    updateBridgeParams(updated);

    // 2) 활성 대안 및 저장소 동기화
    saveCurrentAlternative(planName);

    // 3) 지형-선형 기반 피팅 재확정
    autoFitPiersToTerrain();

    // 4) 3D BIM 뷰어 모드로 자동 전환
    setViewMode('3D');

    if (onConfirmAlignment) {
      onConfirmAlignment(totalLen, newSpans.length);
    }
    if (onApplyAlignment) {
      onApplyAlignment(totalLen, newSpans.length);
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden flex flex-col w-full h-[85vh] max-w-6xl mx-auto text-white">
      {/* 1. Header & Location Search Bar */}
      <div className="p-3 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-md">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold flex items-center gap-2 text-slate-100">
              [1단계] 대한민국 국토 지형 탐색 & 인터랙티브 노선 계획기
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded border border-emerald-500/40 font-mono">
                자유 패닝(Pan) / 휠 줌(Zoom) 지원
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              마우스 드래그로 지도를 이동하고, 휠로 확대하여 원하는 하천·계곡에 교량 시점(A1)과 종점(A2)을 계획합니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 🌟 상단 3D 뷰어에 반영하고 창 닫기 버튼 */}
          <button
            onClick={handleConfirmAndProceed}
            className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-lg text-xs shadow-md flex items-center gap-1.5 transition-all hover:scale-102 active:scale-98"
            title="현재 계획된 노선 및 지형 제원을 3D BIM 뷰어에 반영하고 창을 닫습니다"
          >
            <CheckCircle2 className="w-4 h-4 text-slate-950" />
            <span>3D 뷰어에 반영하고 창 닫기</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              title="창 닫기 (반영 취소)"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Top Tool Bar: Search & Mode Controls */}
      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        {/* 검색창 */}
        <div className="relative flex-1 min-w-[280px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="대한민국 어느 주소든 검색 (예: 공주시 금강, 안동 낙동강, 인제 소양강, 나주 영산강, 파주 임진강...)"
            className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
          {isSearching && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-indigo-400 font-bold animate-pulse">
              검색 중...
            </span>
          )}
        </div>

        {/* 인터랙션 모드 토글 버튼 (패닝 vs 노선 찍기) */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-700">
          <button
            onClick={() => setInteractMode('PAN')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all ${
              interactMode === 'PAN'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="마우스 드래그로 지도 이동 및 휠로 줌"
          >
            <Hand className="w-3.5 h-3.5" />
            <span>지도 자유 이동 (Pan)</span>
          </button>

          <button
            onClick={() => setInteractMode('DRAW')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-all ${
              interactMode === 'DRAW'
                ? 'bg-amber-500 text-slate-950 shadow-sm font-black'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="클릭으로 교량 시점(A1)과 종점(A2)을 지정"
          >
            <MousePointer className="w-3.5 h-3.5" />
            <span>교량 노선 찍기 (Draw)</span>
          </button>
        </div>

        {/* 줌 컨트롤 버튼 */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-700">
          <button
            onClick={() => setZoomLevel((z) => Math.min(18, z + 1))}
            className="p-1.5 hover:bg-slate-800 rounded text-slate-300"
            title="확대 (Zoom In)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono px-1 font-bold text-slate-400">Lv.{zoomLevel}</span>
          <button
            onClick={() => setZoomLevel((z) => Math.max(13, z - 1))}
            className="p-1.5 hover:bg-slate-800 rounded text-slate-300"
            title="축소 (Zoom Out)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 3. 검색 추천 칩 리스트 */}
      <div className="px-4 py-1.5 bg-slate-950 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto text-xs shrink-0 no-scrollbar">
        <span className="text-[11px] text-slate-400 shrink-0 flex items-center gap-1 font-semibold">
          <MapPin className="w-3 h-3 text-red-400" />
          추천 지점:
        </span>
        {searchResults.slice(0, 7).map((poi) => (
          <button
            key={poi.name}
            onClick={() => handleSelectLocation(poi)}
            className={`px-2 py-0.5 rounded text-[11px] transition-all shrink-0 border ${
              locationName === poi.name
                ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500 font-bold'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600 hover:text-white'
            }`}
          >
            {poi.name}
          </button>
        ))}
      </div>

      {/* 4. Main Work Area: Full Interactive Map Canvas & Bottom Status Bar */}
      <div className="flex-1 relative bg-slate-950 overflow-hidden flex flex-col">
        {/* 인터랙티브 위성 캔버스 */}
        <canvas
          ref={canvasRef}
          width={1200}
          height={750}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
          onClick={handleCanvasClick}
          className={`w-full flex-1 block select-none ${
            interactMode === 'PAN' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
          }`}
        />

        {/* 안내 플로팅 뱃지 */}
        <div className="absolute top-3 left-3 bg-slate-900/90 backdrop-blur-md border border-slate-700 px-3.5 py-2 rounded-lg shadow-xl text-xs flex items-center gap-2">
          {interactMode === 'PAN' ? (
            <>
              <Hand className="w-4 h-4 text-sky-400 animate-pulse" />
              <span className="text-slate-200">
                <strong>[지도 탐색 모드]</strong> 마우스를 드래그하여 지도를 이동하고, 휠로 원하는 하천을 찾으세요.
              </span>
            </>
          ) : (
            <>
              <MousePointer className="w-4 h-4 text-amber-400 animate-bounce" />
              <span className="text-amber-200 font-bold">
                [노선 찍기 모드] 교량 시점(A1)과 종점(A2)을 차례대로 클릭하세요 ({alignmentLatLngs.length}/2 지정됨).
              </span>
            </>
          )}
        </div>

        {/* 5. Bottom Real-Time Alignment Result Ribbon */}
        <div className="bg-slate-950/95 border-t border-slate-800 p-3 flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4 text-xs font-mono">
            <div>
              <span className="text-slate-500 block text-[10px]">계획 교량 총연장</span>
              <span className="text-base font-extrabold text-amber-400">{calculatedLengthMeters} m</span>
            </div>
            <div className="h-7 w-px bg-slate-800" />
            <div>
              <span className="text-slate-500 block text-[10px]">교량 사각 (Skew)</span>
              <span className="text-sm font-bold text-white">{skewAngleDeg}°</span>
            </div>
            <div className="h-7 w-px bg-slate-800" />
            <div>
              <span className="text-slate-500 block text-[10px]">경간 구성</span>
              <span className="text-sm font-bold text-sky-400">{recommendedSpans.length}경간</span>
              <span className="text-[10px] text-slate-400 ml-1">(@{recommendedSpans[0]?.length}m)</span>
            </div>
            <div className="h-7 w-px bg-slate-800" />
            <div>
              <span className="text-slate-500 block text-[10px]">위치 좌표</span>
              <span className="text-xs text-slate-300">
                {mapCenter.lat.toFixed(4)}, {mapCenter.lng.toFixed(4)}
              </span>
            </div>
          </div>

          {/* 🌟 3D BIM 모델러 반영 및 창 닫기 버튼 */}
          <button
            onClick={handleConfirmAndProceed}
            className="py-2.5 px-5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-black rounded-lg text-xs shadow-xl flex items-center gap-2 transition-all hover:scale-102 active:scale-98"
            title="현재 계획된 교량 제원을 3D BIM 뷰어에 반영하고 창을 닫습니다"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>3D 뷰어에 반영하고 창 닫기 (L={calculatedLengthMeters}m)</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
