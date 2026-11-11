// src/domain/gis/terrain_dem_loader.ts
import {
  getSatelliteTileUrl,
  getTerrariumDemTileUrl,
  decodeTerrariumRGBToElevation
} from './tile_coords';

export interface RealWorldTerrainData {
  satelliteCanvas: HTMLCanvasElement;
  elevationGrid: number[][]; // [z][x] 해발고도 (m)
  minElevation: number;
  maxElevation: number;
  centerElevation: number;
  widthMeters: number; // 지형 메쉬의 실제 물리적 X축 폭 (m)
  depthMeters: number; // 지형 메쉬의 실제 물리적 Z축 깊이 (m)
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}

/**
 * 단일 이미지 타일을 비동기 로드하는 헬퍼 (CORS anonymous 설정)
 */
function loadTileImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

/**
 * 위도 기준 Web Mercator 1픽셀당 실제 지상 미터 길이 (m/px)
 */
function getMetersPerPixel(lat: number, zoom: number): number {
  const earthCircumference = 40075016.686;
  const latRad = (lat * Math.PI) / 180;
  return (earthCircumference * Math.cos(latRad)) / (Math.pow(2, zoom) * 256);
}

/**
 * 연속 타일 좌표 (소수점 포함) 계산
 */
function latLngToFractionalTile(lat: number, lng: number, zoom: number): { fx: number; fy: number } {
  const n = Math.pow(2, zoom);
  const fx = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const fy =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { fx, fy };
}

/**
 * 대한민국 전역 임의 좌표(lat, lng)와 교량 길이, 방위각(azimuthDeg)에 맞춰
 * 3x3 멀티타일에서 1:1 실측 미터 축척으로 정밀 크롭 & 회전 정렬된 위성 정사영상 및 DEM 고도 데이터를 로드
 */
export async function loadRealWorldTerrain(
  lat: number,
  lng: number,
  bridgeLengthMeters: number = 240,
  azimuthDeg: number = 90,
  gridSegmentsX: number = 100,
  gridSegmentsZ: number = 60
): Promise<RealWorldTerrainData> {
  // 교량 길이에 맞춘 최적 줌 레벨 및 지형 범위(m) 결정
  const widthMeters = Math.max(700, Math.round(bridgeLengthMeters * 2.4));
  const depthMeters = Math.round(widthMeters * 0.72);

  // 지형 전체 폭이 3x3 타일 내부에 넉넉히 들어가도록 줌 레벨 선택
  // Zoom 16: 3x3 타일 ≈ 1,470m 커버 | Zoom 15: 3x3 타일 ≈ 2,950m 커버 | Zoom 14: 3x3 ≈ 5,900m
  let zoom = 16;
  if (widthMeters > 1100) zoom = 15;
  if (widthMeters > 2300) zoom = 14;

  const mpp = getMetersPerPixel(lat, zoom);
  const { fx, fy } = latLngToFractionalTile(lat, lng, zoom);
  const centerTx = Math.floor(fx);
  const centerTy = Math.floor(fy);

  // 3x3 타일 내 목표 중심점의 정확한 픽셀 좌표 (768x768 버퍼 내)
  const cx = (1 + (fx - centerTx)) * 256;
  const cy = (1 + (fy - centerTy)) * 256;

  // 1. 3x3 항공위성 타일 및 DEM 타일 병렬 로드
  const rawSatCanvas = document.createElement('canvas');
  rawSatCanvas.width = 768;
  rawSatCanvas.height = 768;
  const rawSatCtx = rawSatCanvas.getContext('2d');

  const rawDemCanvas = document.createElement('canvas');
  rawDemCanvas.width = 768;
  rawDemCanvas.height = 768;
  const rawDemCtx = rawDemCanvas.getContext('2d');

  const tilePromises: Promise<void>[] = [];

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = centerTx + dx;
      const ty = centerTy + dy;
      const offsetX = (dx + 1) * 256;
      const offsetY = (dy + 1) * 256;

      // 위성 타일
      tilePromises.push(
        loadTileImage(getSatelliteTileUrl(tx, ty, zoom))
          .then((img) => {
            if (rawSatCtx) rawSatCtx.drawImage(img, offsetX, offsetY, 256, 256);
          })
          .catch(() => {
            if (rawSatCtx) {
              rawSatCtx.fillStyle = '#334155';
              rawSatCtx.fillRect(offsetX, offsetY, 256, 256);
            }
          })
      );

      // DEM 타일
      tilePromises.push(
        loadTileImage(getTerrariumDemTileUrl(tx, ty, zoom))
          .then((img) => {
            if (rawDemCtx) rawDemCtx.drawImage(img, offsetX, offsetY, 256, 256);
          })
          .catch(() => {
            // DEM 로드 실패 시 무시 (폴백 처리)
          })
      );
    }
  }

  await Promise.allSettled(tilePromises);

  // 2. 교량 방위각(azimuthDeg)에 맞춰 X축 방향으로 정사영상 회전 정렬 및 1:1 축척 크롭
  const outWidthPx = 1024;
  const outHeightPx = Math.round(1024 * (depthMeters / widthMeters));

  const outCanvas = document.createElement('canvas');
  outCanvas.width = outWidthPx;
  outCanvas.height = outHeightPx;
  const outCtx = outCanvas.getContext('2d');

  if (outCtx) {
    outCtx.fillStyle = '#1E293B';
    outCtx.fillRect(0, 0, outWidthPx, outHeightPx);

    outCtx.save();
    // 출력 캔버스 정중앙에 교량 중심점 매핑
    outCtx.translate(outWidthPx / 2, outHeightPx / 2);

    // 출력 픽셀 / 실제 미터 비율을 원본 위성 타일의 픽셀 스케일과 1:1 정합
    const pxPerMeterOut = outWidthPx / widthMeters;
    const scaleFactor = pxPerMeterOut * mpp;
    outCtx.scale(scaleFactor, scaleFactor);

    // 방위각(azimuthDeg) 방향을 3D +X축(오른쪽=90°)에 정렬하기 위한 시계방향 회전각
    const rotateRad = ((90 - azimuthDeg) * Math.PI) / 180;
    outCtx.rotate(rotateRad);

    // 교량 중점(cx, cy)이 회전 중심(0, 0)에 일치하도록 그리기
    outCtx.drawImage(rawSatCanvas, -cx, -cy);
    outCtx.restore();
  }

  // 3. DEM 고도 데이터 동일 좌표계(회전 + 1:1 미터 스케일)로 샘플링 추출
  const rawDemData = rawDemCtx ? rawDemCtx.getImageData(0, 0, 768, 768) : null;
  const azRad = (azimuthDeg * Math.PI) / 180;
  const sinAz = Math.sin(azRad);
  const cosAz = Math.cos(azRad);

  const elevationGrid: number[][] = [];
  let minElev = Infinity;
  let maxElev = -Infinity;

  for (let z = 0; z <= gridSegmentsZ; z++) {
    const row: number[] = [];
    const normZ = z / gridSegmentsZ; // 0 (-Z, 좌측) ~ 1 (+Z, 우측)
    const dzMeters = (normZ - 0.5) * depthMeters;

    for (let x = 0; x <= gridSegmentsX; x++) {
      const normX = x / gridSegmentsX; // 0 (-X, 시점 측) ~ 1 (+X, 종점 측)
      const dxMeters = (normX - 0.5) * widthMeters;

      // 3D 미터 좌표를 지리적 동(East)/북(North) 미터 오프셋으로 역변환
      const dEast = dxMeters * sinAz + dzMeters * cosAz;
      const dNorth = dxMeters * cosAz - dzMeters * sinAz;

      // 768x768 DEM 버퍼 픽셀 좌표
      const px = Math.max(0, Math.min(767, Math.round(cx + dEast / mpp)));
      const py = Math.max(0, Math.min(767, Math.round(cy - dNorth / mpp)));

      let elev = 25.0;
      if (rawDemData) {
        const idx = (py * 768 + px) * 4;
        const r = rawDemData.data[idx];
        const g = rawDemData.data[idx + 1];
        const b = rawDemData.data[idx + 2];
        const a = rawDemData.data[idx + 3];
        if (a > 0) {
          const decoded = decodeTerrariumRGBToElevation(r, g, b);
          elev = Math.max(-20, Math.min(2500, decoded));
        }
      } else {
        elev = 25 + Math.sin(normX * Math.PI) * -10;
      }

      minElev = Math.min(minElev, elev);
      maxElev = Math.max(maxElev, elev);
      row.push(elev);
    }
    elevationGrid.push(row);
  }

  const centerElev =
    elevationGrid[Math.floor(gridSegmentsZ / 2)]?.[Math.floor(gridSegmentsX / 2)] ?? 25;

  return {
    satelliteCanvas: outCanvas,
    elevationGrid,
    minElevation: minElev === Infinity ? 10 : minElev,
    maxElevation: maxElev === -Infinity ? 50 : maxElev,
    centerElevation: centerElev,
    widthMeters,
    depthMeters,
    bounds: {
      north: lat + 0.005,
      south: lat - 0.005,
      east: lng + 0.005,
      west: lng - 0.005
    }
  };
}
