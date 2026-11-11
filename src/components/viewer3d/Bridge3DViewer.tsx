// src/components/viewer3d/Bridge3DViewer.tsx
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useBridgeStore } from '../../store/useBridgeStore';
import { Camera, Eye, RefreshCw, ZoomIn, ZoomOut, Layers } from 'lucide-react';

export const Bridge3DViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { bridgeParams, cameraPreset, setCameraPreset } = useBridgeStore();
  const [showPiles, setShowPiles] = useState(true);
  const [wireframe, setWireframe] = useState(false);

  // Three.js 인스턴스 보존용 ref
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const bridgeGroupRef = useRef<THREE.Group | null>(null);
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });

  // 1. Scene, Camera, Renderer 초기화
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight || 500;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xF1F5F9); // Light slate sky
    scene.fog = new THREE.FogExp2(0xF1F5F9, 0.0018);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 3000);
    camera.position.set(150, 80, 180);
    camera.lookAt(100, 15, 0);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xFFFBEB, 1.2);
    dirLight.position.set(200, 250, 150);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 800;
    dirLight.shadow.camera.left = -250;
    dirLight.shadow.camera.right = 250;
    dirLight.shadow.camera.top = 250;
    dirLight.shadow.camera.bottom = -250;
    scene.add(dirLight);

    const hemiLight = new THREE.HemisphereLight(0x93C5FD, 0x334155, 0.5);
    scene.add(hemiLight);

    // Ground Grid & River
    const grid = new THREE.GridHelper(800, 80, 0x94A3B8, 0xCBD5E1);
    grid.position.y = -0.1;
    scene.add(grid);

    // Water Surface Plane
    const waterGeo = new THREE.PlaneGeometry(800, 80);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x38BDF8,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.75
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(120, -0.5, 0);
    scene.add(water);

    // Bridge Model Group
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
        // Orbit rotation around center (100, 15, 0)
        const target = new THREE.Vector3(120, 15, 0);
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
      const target = new THREE.Vector3(120, 15, 0);
      const dir = cameraRef.current.position.clone().sub(target).normalize();
      cameraRef.current.position.addScaledVector(dir, zoomFactor);
    };

    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('contextmenu', onContextMenu);

    // Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, []);

  // 2. Camera Preset 변경 시 시점 전환
  useEffect(() => {
    if (!cameraRef.current) return;
    const camera = cameraRef.current;
    const target = new THREE.Vector3(bridgeParams.bridge_length / 2, 15, 0);

    if (cameraPreset === 'iso') {
      camera.position.set(target.x + 120, 80, 160);
    } else if (cameraPreset === 'elevation') {
      camera.position.set(target.x, 25, 220); // Side view
    } else if (cameraPreset === 'cross') {
      camera.position.set(-60, 25, 0); // Front view
    } else if (cameraPreset === 'plan') {
      camera.position.set(target.x, 260, 0); // Top view
    }
    camera.lookAt(target);
  }, [cameraPreset, bridgeParams.bridge_length]);

  // 3. 교량 파라메트릭 3D 지오메트리 빌드
  useEffect(() => {
    if (!bridgeGroupRef.current) return;
    const group = bridgeGroupRef.current;

    // Clean previous meshes
    while (group.children.length > 0) {
      const obj = group.children[0];
      group.remove(obj);
      if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
      if ((obj as THREE.Mesh).material) {
        const mat = (obj as THREE.Mesh).material;
        if (Array.isArray(mat)) mat.forEach(m => m.dispose());
        else mat.dispose();
      }
    }

    const { bridge_width, spans, piers, abutments } = bridgeParams;
    const deckHeight = 22; // 상부 슬래브 표고

    // Materials
    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0xD1D5DB,
      roughness: 0.6,
      wireframe
    });
    const asphaltMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.8,
      wireframe
    });
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0xE2E8F0,
      roughness: 0.5,
      wireframe
    });
    const pierMat = new THREE.MeshStandardMaterial({
      color: 0xCBD5E1,
      roughness: 0.5,
      wireframe
    });
    const archMat = new THREE.MeshStandardMaterial({
      color: 0xEF4444, // 붉은 아치교
      roughness: 0.3,
      metalness: 0.6,
      wireframe
    });
    const steelBoxMat = new THREE.MeshStandardMaterial({
      color: 0x3B82F6, // 청색 강박스
      roughness: 0.4,
      metalness: 0.5,
      wireframe
    });
    const pileMat = new THREE.MeshStandardMaterial({
      color: 0x64748B,
      roughness: 0.4,
      metalness: 0.7,
      wireframe
    });

    let currentX = 0;

    // A. 상부 경간 슬래브 빌드
    spans.forEach((span, i) => {
      const spanLen = span.span_length;
      const isSteel = span.type.includes('STEEL_BOX');
      const isArch = span.type.includes('ARCH');

      // 1. Deck Slab
      const slabGeo = new THREE.BoxGeometry(spanLen - 0.2, 1.8, bridge_width);
      const slabMesh = new THREE.Mesh(slabGeo, isSteel ? steelBoxMat : concreteMat);
      slabMesh.position.set(currentX + spanLen / 2, deckHeight - 0.9, 0);
      slabMesh.castShadow = true;
      slabMesh.receiveShadow = true;
      group.add(slabMesh);

      // 2. Asphalt Overlay
      const roadGeo = new THREE.BoxGeometry(spanLen - 0.3, 0.1, bridge_width - 1.2);
      const roadMesh = new THREE.Mesh(roadGeo, asphaltMat);
      roadMesh.position.set(currentX + spanLen / 2, deckHeight + 0.05, 0);
      roadMesh.receiveShadow = true;
      group.add(roadMesh);

      // 3. Concrete Parapets / Guardrails
      const barrierGeo = new THREE.BoxGeometry(spanLen - 0.3, 1.0, 0.5);
      const leftBarrier = new THREE.Mesh(barrierGeo, barrierMat);
      leftBarrier.position.set(currentX + spanLen / 2, deckHeight + 0.5, bridge_width / 2 - 0.25);
      const rightBarrier = new THREE.Mesh(barrierGeo, barrierMat);
      rightBarrier.position.set(currentX + spanLen / 2, deckHeight + 0.5, -bridge_width / 2 + 0.25);
      group.add(leftBarrier);
      group.add(rightBarrier);

      // 4. Special Architecture: 강아치교 (Steel Arch) 리브 렌더링
      if (isArch) {
        const archCurve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(currentX, deckHeight, bridge_width / 2 - 1),
          new THREE.Vector3(currentX + spanLen / 2, deckHeight + 35, bridge_width / 2 - 1),
          new THREE.Vector3(currentX + spanLen, deckHeight, bridge_width / 2 - 1)
        );
        const tubeGeo = new THREE.TubeGeometry(archCurve, 32, 1.0, 8, false);
        const archMeshLeft = new THREE.Mesh(tubeGeo, archMat);
        group.add(archMeshLeft);

        const archCurveRight = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(currentX, deckHeight, -bridge_width / 2 + 1),
          new THREE.Vector3(currentX + spanLen / 2, deckHeight + 35, -bridge_width / 2 + 1),
          new THREE.Vector3(currentX + spanLen, deckHeight, -bridge_width / 2 + 1)
        );
        const tubeGeoRight = new THREE.TubeGeometry(archCurveRight, 32, 1.0, 8, false);
        const archMeshRight = new THREE.Mesh(tubeGeoRight, archMat);
        group.add(archMeshRight);
      }

      currentX += spanLen;
    });

    const totalBridgeLen = currentX;

    // B. 교대 (A1 & A2) 빌드
    const createAbutment = (xPos: number, isStart: boolean) => {
      const abutGroup = new THREE.Group();
      // Backwall & Stem
      const stemGeo = new THREE.BoxGeometry(4.0, 12, bridge_width + 2);
      const stemMesh = new THREE.Mesh(stemGeo, concreteMat);
      stemMesh.position.set(xPos, 6, 0);
      stemMesh.castShadow = true;
      abutGroup.add(stemMesh);

      // Footing
      const footingGeo = new THREE.BoxGeometry(8.0, 2.5, bridge_width + 4);
      const footingMesh = new THREE.Mesh(footingGeo, concreteMat);
      footingMesh.position.set(xPos + (isStart ? -2 : 2), 1.25, 0);
      footingMesh.castShadow = true;
      abutGroup.add(footingMesh);

      // Embankment Cone
      const coneGeo = new THREE.ConeGeometry(bridge_width * 0.9, 14, 16);
      const coneMat = new THREE.MeshStandardMaterial({ color: 0x86EFAC, roughness: 0.9 });
      const cone = new THREE.Mesh(coneGeo, coneMat);
      cone.position.set(xPos + (isStart ? -10 : 10), 0, 0);
      cone.rotation.z = isStart ? 0.3 : -0.3;
      abutGroup.add(cone);

      group.add(abutGroup);
    };

    createAbutment(0, true);
    createAbutment(totalBridgeLen, false);

    // C. 교각 (P1, P2, ...) 빌드
    let spanCumX = 0;
    piers.forEach((pier, idx) => {
      if (idx < spans.length - 1) {
        spanCumX += spans[idx].span_length;
      } else {
        spanCumX = (totalBridgeLen / (piers.length + 1)) * (idx + 1);
      }

      const pierGroup = new THREE.Group();
      const pierHeight = pier.height || 18;
      const diam = pier.diameter || 2.8;

      // 1. Pier Coping (T-Head)
      const copingGeo = new THREE.BoxGeometry(4.5, 2.5, bridge_width - 1.0);
      const copingMesh = new THREE.Mesh(copingGeo, pierMat);
      copingMesh.position.set(spanCumX, deckHeight - 2.5, 0);
      copingMesh.castShadow = true;
      pierGroup.add(copingMesh);

      // 2. Pier Column (Cylinder or Double Columns)
      if (bridge_width >= 24) {
        // 왕복 광폭 교량: 2본 원형 기둥
        const colGeo = new THREE.CylinderGeometry(diam / 2, diam / 2, pierHeight, 24);
        const col1 = new THREE.Mesh(colGeo, pierMat);
        col1.position.set(spanCumX, pierHeight / 2, bridge_width / 4);
        col1.castShadow = true;
        const col2 = new THREE.Mesh(colGeo, pierMat);
        col2.position.set(spanCumX, pierHeight / 2, -bridge_width / 4);
        col2.castShadow = true;
        pierGroup.add(col1);
        pierGroup.add(col2);
      } else {
        // 단일 T형 교각
        const colGeo = new THREE.CylinderGeometry(diam / 2, diam / 2, pierHeight, 24);
        const colMesh = new THREE.Mesh(colGeo, pierMat);
        colMesh.position.set(spanCumX, pierHeight / 2, 0);
        colMesh.castShadow = true;
        pierGroup.add(colMesh);
      }

      // 3. Footing
      const footingGeo = new THREE.BoxGeometry(diam * 2.5, 2.0, bridge_width * 0.8);
      const footingMesh = new THREE.Mesh(footingGeo, concreteMat);
      footingMesh.position.set(spanCumX, 1.0, 0);
      footingMesh.castShadow = true;
      pierGroup.add(footingMesh);

      group.add(pierGroup);
    });

    // D. 강관말뚝 기초 (InstancedMesh 빌드 - 사용자 입력 말뚝 길이 및 본수 실시간 연동)
    if (showPiles) {
      const pileRadius = 0.254; // D508 / 2 = 0.254m
      const pileGroups: { x: number; len: number; count: number }[] = [];

      // A1 교대
      if (abutments[0]?.foundation === 'PILE') {
        pileGroups.push({
          x: 0,
          len: abutments[0].pile_len || 15,
          count: Math.min(48, abutments[0].pile_count || 40)
        });
      }

      // 교각들
      let pCumX = 0;
      piers.forEach((p, pIdx) => {
        if (pIdx < spans.length - 1) {
          pCumX += spans[pIdx].span_length;
        } else {
          pCumX = (totalBridgeLen / (piers.length + 1)) * (pIdx + 1);
        }
        if (p.foundation === 'PILE') {
          pileGroups.push({
            x: pCumX,
            len: p.pile_len || 15,
            count: Math.min(48, p.pile_count || 50)
          });
        }
      });

      // A2 교대
      if (abutments[1]?.foundation === 'PILE') {
        pileGroups.push({
          x: totalBridgeLen,
          len: abutments[1].pile_len || 15,
          count: Math.min(48, abutments[1].pile_count || 40)
        });
      }

      const totalInstances = pileGroups.reduce((sum, g) => sum + g.count, 0);

      if (totalInstances > 0) {
        const unitPileGeo = new THREE.CylinderGeometry(pileRadius, pileRadius, 1, 12);
        const instancedPiles = new THREE.InstancedMesh(unitPileGeo, pileMat, totalInstances);

        const dummy = new THREE.Object3D();
        let pileIdx = 0;

        pileGroups.forEach((g) => {
          const cols = Math.min(4, Math.max(2, Math.round(Math.sqrt(g.count / 3))));
          const rows = Math.ceil(g.count / cols);
          const colSpacing = 2.0;
          const rowSpacing = Math.min(3.5, (bridge_width * 0.75) / Math.max(1, rows - 1));

          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              if (pileIdx >= totalInstances) break;
              const zPos = (r - (rows - 1) / 2) * rowSpacing;
              const xPos = g.x + (c - (cols - 1) / 2) * colSpacing;
              dummy.position.set(xPos, -g.len / 2, zPos);
              dummy.scale.set(1, g.len, 1);
              dummy.updateMatrix();
              instancedPiles.setMatrixAt(pileIdx++, dummy.matrix);
            }
          }
        });

        instancedPiles.instanceMatrix.needsUpdate = true;
        group.add(instancedPiles);
      }
    }
  }, [bridgeParams, showPiles, wireframe]);

  return (
    <div className="relative w-full h-[520px] rounded-xl overflow-hidden border border-slate-200 bg-slate-900 shadow-inner flex flex-col">
      {/* 3D Canvas Container */}
      <div ref={containerRef} className="w-full flex-1 cursor-grab active:cursor-grabbing" />

      {/* Control Bar Overlay */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-slate-700 text-xs text-white shadow-lg">
        <span className="font-bold flex items-center gap-1 text-sky-400">
          <Layers className="w-3.5 h-3.5" />
          BIM 3D View
        </span>
        <span className="text-slate-500">|</span>
        <span>L={bridgeParams.bridge_length}m</span>
        <span>B={bridgeParams.bridge_width}m</span>
        <span className="text-slate-400">({bridgeParams.spans.length}경간)</span>
      </div>

      {/* Camera View Switcher Buttons */}
      <div className="absolute top-3 right-3 flex items-center gap-1 bg-slate-900/80 backdrop-blur-md p-1 rounded-lg border border-slate-700 shadow-lg">
        <button
          onClick={() => setCameraPreset('iso')}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${cameraPreset === 'iso' ? 'bg-sky-500 text-white shadow' : 'text-slate-300 hover:text-white'}`}
          title="투시도 뷰"
        >
          3D 투시
        </button>
        <button
          onClick={() => setCameraPreset('elevation')}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${cameraPreset === 'elevation' ? 'bg-sky-500 text-white shadow' : 'text-slate-300 hover:text-white'}`}
          title="종단면 뷰"
        >
          종단면
        </button>
        <button
          onClick={() => setCameraPreset('cross')}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${cameraPreset === 'cross' ? 'bg-sky-500 text-white shadow' : 'text-slate-300 hover:text-white'}`}
          title="횡단면 뷰"
        >
          횡단면
        </button>
        <button
          onClick={() => setCameraPreset('plan')}
          className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${cameraPreset === 'plan' ? 'bg-sky-500 text-white shadow' : 'text-slate-300 hover:text-white'}`}
          title="평면도 뷰"
        >
          평면
        </button>
      </div>

      {/* Visual Toggles Bottom Bar */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-slate-300 bg-slate-900/75 backdrop-blur-md px-3 py-2 rounded-lg border border-slate-700">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-white select-none">
            <input
              type="checkbox"
              checked={showPiles}
              onChange={(e) => setShowPiles(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-0"
            />
            <span>하부 강관말뚝 기초 표시 (D508)</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer hover:text-white select-none">
            <input
              type="checkbox"
              checked={wireframe}
              onChange={(e) => setWireframe(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-sky-500 focus:ring-0"
            />
            <span>와이어프레임</span>
          </label>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span>좌클릭: 회전</span>
          <span>•</span>
          <span>우클릭: 이동</span>
          <span>•</span>
          <span>휠: 줌</span>
        </div>
      </div>
    </div>
  );
};

