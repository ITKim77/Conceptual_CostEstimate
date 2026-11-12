// src/components/viewer3d/Bridge3DViewer.tsx
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useBridgeStore } from '../../store/useBridgeStore';
import {
  Layers,
  Eye,
  Maximize2,
  Compass,
  Sparkles,
  Mountain,
  Waves,
  Ruler
} from 'lucide-react';
import {
  populateBridgeScene,
  resolveBridgeLocationLatLng
} from './bridge_scene_builder';
import { SUPERSTRUCTURE_CATALOG } from '../../domain/constants/rev04_database';
import { SuperstructureType } from '../../domain/models/bridge';
import { KoreaGISAlignmentPlanner } from '../gis/KoreaGISAlignmentPlanner';
import { loadRealWorldTerrain, RealWorldTerrainData } from '../../domain/gis/terrain_dem_loader';

export interface Bridge3DViewerProps {
  isExpanded?: boolean;
}

export const Bridge3DViewer: React.FC<Bridge3DViewerProps> = ({ isExpanded = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const bridgeGroupRef = useRef<THREE.Group | null>(null);
  const terrainGroupRef = useRef<THREE.Group | null>(null);
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const lookAtTargetRef = useRef(new THREE.Vector3(100, 15, 0));

  const { bridgeParams, cameraPreset, setCameraPreset, applySuperstructureToAllSpans } = useBridgeStore();
  const [wireframe, setWireframe] = useState(false);
  const [showPiles, setShowPiles] = useState(true);
  const [showTerrain, setShowTerrain] = useState(true);
  const [showAlignment, setShowAlignment] = useState(true);
  const [showEarthwork, setShowEarthwork] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [isGISPlannerOpen, setIsGISPlannerOpen] = useState(false);
  const [realTerrain, setRealTerrain] = useState<RealWorldTerrainData | null>(null);
  const [isLoadingTerrain, setIsLoadingTerrain] = useState(false);
  const [terrainVerticalScale, setTerrainVerticalScale] = useState<number>(1.0);

  // 실제 위성 정사영상 타일 및 DEM 래스터 실시간 로드 (대한민국 전역 실측 데이터)
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingTerrain(true);

    const { lat: targetLat, lng: targetLng, azimuthDeg } = resolveBridgeLocationLatLng(bridgeParams);
    const bridgeLen = bridgeParams.bridge_length || 240;

    loadRealWorldTerrain(targetLat, targetLng, bridgeLen, azimuthDeg, 100, 60)
      .then((data) => {
        if (!isCancelled) {
          setRealTerrain(data);
          setIsLoadingTerrain(false);
        }
      })
      .catch((err) => {
        console.warn('실측 위성/DEM 로드 실패:', err);
        if (!isCancelled) setIsLoadingTerrain(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [
    bridgeParams.coordinates?.lat,
    bridgeParams.coordinates?.lng,
    bridgeParams.alignmentEndpoints?.azimuthDeg,
    bridgeParams.alignmentEndpoints?.startLat,
    bridgeParams.alignmentEndpoints?.endLat,
    bridgeParams.locationName,
    bridgeParams.name,
    bridgeParams.bridge_length
  ]);

  // 노선 계획 반영 토스트 메시지 상태
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Scene & Renderer Initialization
  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight || 520;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0B132B); // 맑고 깊은 딥 네이비 배경 (안개 없음)
    // 🌟 안개(Fog) 완전 제거: 줌아웃 시 화면이 어두워지는 현상 근본 차단
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 6000);
    camera.position.set(160, 65, 150);
    camera.lookAt(new THREE.Vector3(120, 15, 0));
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lights - 지형 기복(Hillshade) 입체감을 살리면서도 어둡지 않은 균형 잡힌 주광 환경
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.72);
    scene.add(ambientLight);

    // 주 태양광 (지형 경사면 음영이 또렷하게 드러나는 사선 입사각)
    const dirLight = new THREE.DirectionalLight(0xFFFBEB, 1.35);
    dirLight.position.set(420, 280, 220);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 2500;
    dirLight.shadow.camera.left = -600;
    dirLight.shadow.camera.right = 600;
    dirLight.shadow.camera.top = 600;
    dirLight.shadow.camera.bottom = -600;
    scene.add(dirLight);

    // 반대편 보조광
    const dirLight2 = new THREE.DirectionalLight(0x93C5FD, 0.4);
    dirLight2.position.set(-300, 350, -220);
    scene.add(dirLight2);

    const hemiLight = new THREE.HemisphereLight(0xE0F2FE, 0x334155, 0.55);
    scene.add(hemiLight);

    // Groups
    const terrainGroup = new THREE.Group();
    scene.add(terrainGroup);
    terrainGroupRef.current = terrainGroup;

    const bridgeGroup = new THREE.Group();
    scene.add(bridgeGroup);
    bridgeGroupRef.current = bridgeGroup;

    // Mouse Orbit & Pan Handlers
    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !cameraRef.current) return;
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;

      if (e.buttons === 1) {
        // Orbit
        const target = lookAtTargetRef.current;
        const offset = cameraRef.current.position.clone().sub(target);
        const radius = offset.length();
        let theta = Math.atan2(offset.x, offset.z) - deltaX * 0.006;
        let phi = Math.acos(Math.max(-1, Math.min(1, offset.y / radius))) + deltaY * 0.006;
        phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, phi));

        cameraRef.current.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
        cameraRef.current.position.y = target.y + radius * Math.cos(phi);
        cameraRef.current.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
        cameraRef.current.lookAt(target);
      } else if (e.buttons === 2) {
        // Pan
        cameraRef.current.position.x -= deltaX * 0.3;
        cameraRef.current.position.y += deltaY * 0.3;
      }

      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!cameraRef.current) return;
      const zoomFactor = e.deltaY * 0.15;
      const target = lookAtTargetRef.current;
      const dir = cameraRef.current.position.clone().sub(target).normalize();
      cameraRef.current.position.addScaledVector(dir, zoomFactor);
    };

    const dom = containerRef.current;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('contextmenu', (e) => e.preventDefault());

    // 🌟 Resize Observer: 브라우저 윈도우뿐만 아니라 사이드 패널 토글 시 캔버스 컨테이너의 실시간 크기 변화를 100% 포착
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight || 520;
      if (w === 0 || h === 0) return;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h, false);
      rendererRef.current.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Render Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (rendererRef.current && rendererRef.current.domElement) {
        dom.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, []);

  // 2. Camera Preset Controls (교량 총연장 및 패널 확장 모드에 맞춘 동적 시점 포커싱)
  useEffect(() => {
    if (!cameraRef.current) return;
    const totalL = bridgeParams.bridge_length || 200;
    const centerX = totalL / 2;
    lookAtTargetRef.current.set(centerX, 15, 0);
    const target = lookAtTargetRef.current;

    const distScale = Math.max(1.0, totalL / 200);
    // 🌟 패널이 확장(12열)되었을 때 더 넓은 지형과 교량 전경이 시원하게 보이도록 카메라 시야 확장
    const expandFactor = isExpanded ? 1.25 : 1.0;

    switch (cameraPreset) {
      case 'iso':
        cameraRef.current.position.set(centerX + 60 * distScale * expandFactor, 65 * distScale * expandFactor, 150 * distScale * expandFactor);
        break;
      case 'elevation':
        cameraRef.current.position.set(centerX, 25 * distScale * expandFactor, 200 * distScale * expandFactor);
        break;
      case 'cross':
        cameraRef.current.position.set(-60 * distScale * expandFactor, 30 * distScale * expandFactor, 0);
        break;
      case 'plan':
        cameraRef.current.position.set(centerX, 240 * distScale * expandFactor, 0.1);
        break;
    }
    cameraRef.current.lookAt(target);
  }, [cameraPreset, bridgeParams.bridge_length, isExpanded]);

  // 사이드 패널 토글(확장/축소) 및 CSS 트랜지션 완료 시점마다 WebGL 캔버스 해상도·비율 동기화
  useEffect(() => {
    const triggerResize = () => window.dispatchEvent(new Event('resize'));
    triggerResize();
    const t1 = window.setTimeout(triggerResize, 120);
    const t2 = window.setTimeout(triggerResize, 330);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [isExpanded]);

  // 3. 🌟 지형(Terrain Mesh) 및 교량 구조물 동적 3D 파라메트릭 빌드 (공통 빌더 사용)
  useEffect(() => {
    if (!bridgeGroupRef.current || !terrainGroupRef.current) return;
    return populateBridgeScene({
      bridgeGroup: bridgeGroupRef.current,
      terrainGroup: terrainGroupRef.current,
      bridgeParams,
      realTerrain,
      terrainVerticalScale,
      showTerrain,
      showAlignment,
      showEarthwork,
      showPiles,
      wireframe
    });
  }, [bridgeParams, showPiles, showTerrain, showAlignment, showEarthwork, wireframe, realTerrain, terrainVerticalScale]);

  return (
    <div
      className={`relative w-full ${
        isExpanded ? 'h-[76vh] min-h-[700px]' : 'h-[640px]'
      } rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shadow-inner flex flex-col transition-all duration-300`}
    >
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="w-full h-full flex-1 min-w-0 min-h-0 overflow-hidden relative cursor-grab active:cursor-grabbing" />

      {/* Control Bar Overlay (Left Top) */}
      <div className="absolute top-3 left-3 flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-white shadow-lg">
        <span className="font-bold flex items-center gap-1.5 text-sky-400">
          <Layers className="w-3.5 h-3.5" />
          BIM 3D View
        </span>
        <span className="text-slate-600">|</span>
        <span className="font-mono text-slate-200">L={bridgeParams.bridge_length}m</span>
        <span className="font-mono text-slate-200">B={bridgeParams.bridge_width}m</span>
        <span className="text-slate-400">({bridgeParams.spans.length}경간)</span>
        {isLoadingTerrain ? (
          <span className="text-[10px] bg-sky-950 text-sky-300 px-1.5 py-0.5 rounded border border-sky-600/50 animate-pulse font-mono flex items-center gap-1">
            <Mountain className="w-3 h-3 text-sky-400" />
            실측 위성 타일·DEM 로드 중...
          </span>
        ) : realTerrain ? (
          realTerrain.hasRealDem ? (
            <span className="text-[10px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-600/50 font-mono flex items-center gap-1">
              <Mountain className="w-3 h-3 text-emerald-400" />
              실측 SRTM DEM ({Math.round(realTerrain.minElevation)}~{Math.round(realTerrain.maxElevation)}m · 고도차 {Math.round(realTerrain.maxElevation - realTerrain.minElevation)}m) · {terrainVerticalScale.toFixed(1)}x
            </span>
          ) : (
            <span className="text-[10px] bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded border border-amber-600/50 font-mono flex items-center gap-1">
              <Mountain className="w-3 h-3 text-amber-400" />
              DEM 타일 미수신 (추정 지형 폴백)
            </span>
          )
        ) : bridgeParams.terrain && (
          <span className="text-[10px] bg-indigo-900/70 text-indigo-200 px-1.5 py-0.5 rounded border border-indigo-700/50 flex items-center gap-1">
            <Mountain className="w-3 h-3 text-indigo-400" />
            {bridgeParams.terrain.type === 'RIVER_CROSSING' ? '하천횡단' : '산악협곡'}
          </span>
        )}
        {bridgeParams.alignment && (
          <span className="text-[10px] bg-amber-950/70 text-amber-300 px-1.5 py-0.5 rounded border border-amber-700/50 flex items-center gap-1 font-mono">
            <Compass className="w-3 h-3 text-amber-400" />
            {bridgeParams.alignment.curve_radius && bridgeParams.alignment.curve_radius > 0 ? `R=${bridgeParams.alignment.curve_radius}m` : '직선'} / {bridgeParams.alignment.longitudinal_slope}%
          </span>
        )}

        {/* 🌟 위성 지도 노선 계획기 원클릭 호출 버튼 */}
        <button
          onClick={() => setIsGISPlannerOpen(true)}
          className="ml-1 px-2.5 py-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded text-[11px] flex items-center gap-1 shadow-sm transition-all hover:scale-102 active:scale-98"
          title="실제 대한민국 위성 지도 위에서 마우스로 노선을 계획합니다"
        >
          <Compass className="w-3.5 h-3.5" />
          <span>🗺️ 위성 노선 계획기</span>
        </button>
      </div>

      {/* 상부구조 형식 즉시 전환 바 (3D BIM 실시간 형상 변경) */}
      <div className="absolute top-14 left-3 flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs text-white shadow-lg">
        <span className="text-[11px] font-bold text-amber-300 shrink-0">상부형식</span>
        <select
          aria-label="3D 뷰어 상부구조 형식 변경"
          value={
            bridgeParams.spans.length > 0 &&
            bridgeParams.spans.every((s) => s.type === bridgeParams.spans[0].type)
              ? bridgeParams.spans[0].type
              : ''
          }
          onChange={(e) => {
            const val = e.target.value as SuperstructureType;
            if (!val) return;
            applySuperstructureToAllSpans(val);
            showToast(
              `상부구조 형식이 '${SUPERSTRUCTURE_CATALOG[val]?.name || val}'(으)로 즉시 변경되었습니다.`
            );
          }}
          className="bg-slate-800 hover:bg-slate-700 text-slate-100 text-[11px] font-semibold px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-sky-400 cursor-pointer max-w-[235px]"
        >
          <option value="" disabled>
            혼합 구성 (경간별 상이)
          </option>
          <optgroup label="── 특수교 (아치 · 사장 · E/D) ──">
            <option value="STEEL_ARCH">강아치교 (Steel Arch)</option>
            <option value="CABLE_STAYED">사장교 (Cable-Stayed)</option>
            <option value="EXTRADOSED">엑스트라도우즈드교 (E/D)</option>
          </optgroup>
          <optgroup label="── PSC / 강 박스거더 ──">
            <option value="PSC_BOX_FCM">PSC BOX (F.C.M 변단면)</option>
            <option value="PSC_BOX_ILM">PSC BOX (I.L.M 압출)</option>
            <option value="PSC_BOX_MSS">PSC BOX (M.S.S 이동식)</option>
            <option value="STEEL_BOX_CONTINUOUS">ST. BOX GIRDER (연속 강박스)</option>
            <option value="STEEL_BOX_SIMPLE">ST. BOX GIRDER (단경간)</option>
          </optgroup>
          <optgroup label="── 강판형 / 소수주형 ──">
            <option value="RATIONALIZED_PLATE">합리화 소수주형 판형교 (2주형)</option>
            <option value="STEEL_PLATE">S.T PLATE (강판형교)</option>
          </optgroup>
          <optgroup label="── PSC I / 변단면 / 저형고 거더 ──">
            <option value="PSC_BEAM">1. PSC BEAM (표준 I형)</option>
            <option value="MODIFIED_PSC_BEAM">9. 개량형 변단면 PSC BEAM</option>
            <option value="PF_BEAM">10. PF BEAM (저형고 강합성)</option>
            <option value="BICON_GIRDER">3. BICON GIRDER (U형 거더)</option>
            <option value="IPC_GIRDER">7. IPC GIRDER</option>
            <option value="EX_GIRDER">2. EX GIRDER</option>
          </optgroup>
          <optgroup label="── 라멘 · 박스 암거 ──">
            <option value="RC_RAHMEN">노출 R.C 라멘</option>
            <option value="RC_BOX">노출 RC BOX</option>
          </optgroup>
        </select>
      </div>

      {/* Bottom Overlay Row: View Options (Left) + DEM Height Scale (Right) */}
      <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* View Options Toggle Controls */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/85 backdrop-blur-md p-1 rounded-lg border border-slate-700 text-xs text-white shadow-lg pointer-events-auto">
          <button
            onClick={() => setShowTerrain(!showTerrain)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
              showTerrain ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
            title="3D 대한민국 지형 메쉬 및 정사영상 텍스처 렌더링 전환"
          >
            <Mountain className="w-3.5 h-3.5" />
            <span>지형·정사영상 {showTerrain ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => setShowAlignment(!showAlignment)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
              showAlignment ? 'bg-amber-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
            title="3D 도로 선형 중심선 가이드라인 투영 전환"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>선형 중심선</span>
          </button>

          <button
            onClick={() => setShowEarthwork(!showEarthwork)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
              showEarthwork ? 'bg-lime-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
            title="교대 후방 고속도로 성토·절토·노반 토공 모델 표시 전환"
          >
            <Waves className="w-3.5 h-3.5" />
            <span>고속도로 토공</span>
          </button>

          <button
            onClick={() => setShowPiles(!showPiles)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
              showPiles ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
            title="지중 강관말뚝 기초 투시 렌더링 전환"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>말뚝기초</span>
          </button>

          <button
            onClick={() => setWireframe(!wireframe)}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
              wireframe ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
            title="와이어프레임 구조 투영"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>와이어</span>
          </button>
        </div>

        {/* DEM Terrain Vertical Height Scale Control */}
        <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs text-white shadow-lg pointer-events-auto">
          <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-300 shrink-0" title="실측 DEM 지형 표고차(높이) 과장 배율 조절">
            <Ruler className="w-3.5 h-3.5 text-emerald-400" />
            <span>지형 높이 배율</span>
            <span className="font-mono text-amber-300 w-9 text-right">{terrainVerticalScale.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min={0.5}
            max={5.0}
            step={0.25}
            value={terrainVerticalScale}
            onChange={(e) => setTerrainVerticalScale(parseFloat(e.target.value))}
            className="w-20 accent-emerald-400 cursor-pointer h-1.5 bg-slate-700 rounded-lg"
            aria-label="지형 높이 배율"
          />
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 5].map((presetScale) => (
              <button
                key={presetScale}
                onClick={() => setTerrainVerticalScale(presetScale)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                  Math.abs(terrainVerticalScale - presetScale) < 0.01
                    ? 'bg-emerald-600 text-white shadow'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
                title={presetScale === 1 ? '실측 1:1 높이 (과장 없음)' : `지형 기복 ${presetScale}배 강조`}
              >
                {presetScale}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Camera View Switcher Buttons (Top Right) */}
      <div className="absolute top-3 right-3 flex items-center gap-1 bg-slate-900/85 backdrop-blur-md p-1 rounded-lg border border-slate-700 shadow-lg">
        <button
          onClick={() => setCameraPreset('iso')}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
            cameraPreset === 'iso' ? 'bg-sky-500 text-white shadow' : 'text-slate-300 hover:text-white'
          }`}
          title="3D 투시도 뷰"
        >
          3D 투시
        </button>
        <button
          onClick={() => setCameraPreset('elevation')}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
            cameraPreset === 'elevation' ? 'bg-sky-500 text-white shadow' : 'text-slate-300 hover:text-white'
          }`}
          title="정면 측면도 (교각/지반 프로파일 확인)"
        >
          정면도
        </button>
        <button
          onClick={() => setCameraPreset('cross')}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
            cameraPreset === 'cross' ? 'bg-sky-500 text-white shadow' : 'text-slate-300 hover:text-white'
          }`}
          title="교축 횡단면도"
        >
          횡단도
        </button>
        <button
          onClick={() => setCameraPreset('plan')}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
            cameraPreset === 'plan' ? 'bg-sky-500 text-white shadow' : 'text-slate-300 hover:text-white'
          }`}
          title="상공 평면도 (항공 조감)"
        >
          평면도
        </button>
      </div>

      {/* 🌟 노선 계획 실시간 반영 완료 알림 토스트 */}
      {toastMessage && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 bg-emerald-600/95 text-white px-4 py-2 rounded-xl shadow-2xl border border-emerald-400 text-xs font-bold flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 국토 위성 지도 노선 계획기 모달 오버레이 */}
      {isGISPlannerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <KoreaGISAlignmentPlanner
              onClose={() => setIsGISPlannerOpen(false)}
              onApplyAlignment={(appliedLength, spanCount) => {
                showToast(`✅ [${bridgeParams.locationName || '선택 위치'}] 노선 계획이 3D BIM에 성공적으로 반영되었습니다! (총연장 ${appliedLength}m, ${spanCount}경간)`);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
