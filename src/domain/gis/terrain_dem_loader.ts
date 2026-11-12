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
  hasRealDem: boolean; // 실제 AWS Terrarium DEM 타일 수신 성공 여부
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
 * 768x768 Terrarium RGB 버퍼에서 연속 픽셀 좌표 (fpx, fpy)의 고도를 이중선형 보간(Bilinear)으로 디코딩
 */
function sampleBilinearDemElevation(
  data: Uint8ClampedArray,
  fpx: number,
  fpy: number
): number | null {
  const x0 = Math.max(0, Math.min(767, Math.floor(fpx)));
  const y0 = Math.max(0, Math.min(767, Math.floor(fpy)));
  const x1 = Math.min(767, x0 + 1);
  const y1 = Math.min(767, y0 + 1);
  const tx = Math.max(0, Math.min(1, fpx - x0));
  const ty = Math.max(0, Math.min(1, fpy - y0));

  const readAt = (x: number, y: number): number | null => {
    const idx = (y * 768 + x) * 4;
    if (data[idx + 3] === 0) return null;
    const h = decodeTerrariumRGBToElevation(data[idx], data[idx + 1], data[idx + 2]);
    return Math.max(-50, Math.min(3000, h));
  };

  const e00 = readAt(x0, y0);
  if (e00 === null) return null;
  const e10 = readAt(x1, y0) ?? e00;
  const e01 = readAt(x0, y1) ?? e00;
  const e11 = readAt(x1, y1) ?? e00;

  const top = e00 * (1 - tx) + e10 * tx;
  const bottom = e01 * (1 - tx) + e11 * tx;
  return top * (1 - ty) + bottom * ty;
}

const MAX_TERRAIN_CACHE_ENTRIES = 12;
const terrainDataCache = new Map<string, Promise<RealWorldTerrainData>>();

/**
 * 대한민국 전역 임의 좌표(lat, lng)와 교량 길이, 방위각(azimuthDeg)에 맞춰
 * 3x3 멀티타일에서 1:1 실측 미터 축척으로 정밀 크롭 & 회전 정렬된 위성 정사영상 및 실측 DEM 고도 데이터를 로드
 * (동일 좌표/축척 요청은 메모리 캐시로 즉시 재사용)
 */
export async function loadRealWorldTerrain(
  lat: number,
  lng: number,
  bridgeLengthMeters: number = 240,
  azimuthDeg: number = 90,
  gridSegmentsX: number = 100,
  gridSegmentsZ: number = 60
): Promise<RealWorldTerrainData> {
  const cacheKey = `${lat.toFixed(4)}|${lng.toFixed(4)}|${Math.round(bridgeLengthMeters)}|${azimuthDeg.toFixed(1)}|${gridSegmentsX}x${gridSegmentsZ}`;
  const cached = terrainDataCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const loadPromise = loadRealWorldTerrainUncached(
    lat,
    lng,
    bridgeLengthMeters,
    azimuthDeg,
    gridSegmentsX,
    gridSegmentsZ
  ).catch((err) => {
    terrainDataCache.delete(cacheKey);
    throw err;
  });

  if (terrainDataCache.size >= MAX_TERRAIN_CACHE_ENTRIES) {
    const oldestKey = terrainDataCache.keys().next().value;
    if (oldestKey) terrainDataCache.delete(oldestKey);
  }
  terrainDataCache.set(cacheKey, loadPromise);
  return loadPromise;
}

async function loadRealWorldTerrainUncached(
  lat: number,
  lng: number,
  bridgeLengthMeters: number = 240,
  azimuthDeg: number = 90,
  gridSegmentsX: number = 100,
  gridSegmentsZ: number = 60
): Promise<RealWorldTerrainData> {
  // 교량 길이에 맞춘 최적 지형 범위(m) 결정
  const widthMeters = Math.max(700, Math.round(bridgeLengthMeters * 2.4));
  const depthMeters = Math.round(widthMeters * 0.72);

  // 🌟 1) 위성 정사영상 줌 레벨 결정 (회전 대각선 코너 0.616 * W 가 3x3 타일 내부에 안전하게 포함되도록)
  let satZoom = 16;
  if (widthMeters > 780) satZoom = 15;
  if (widthMeters > 1550) satZoom = 14;

  // 🌟 2) AWS Terrarium DEM 타일은 대한민국 포함 전 세계 최대 지원 줌이 Lv.15(SRTM 30m)이므로 15 이하로 고정
  const demZoom = Math.min(satZoom, 15);

  const satMpp = getMetersPerPixel(lat, satZoom);
  const { fx: satFx, fy: satFy } = latLngToFractionalTile(lat, lng, satZoom);
  const satCenterTx = Math.floor(satFx);
  const satCenterTy = Math.floor(satFy);
  const satCx = (1 + (satFx - satCenterTx)) * 256;
  const satCy = (1 + (satFy - satCenterTy)) * 256;

  const demMpp = getMetersPerPixel(lat, demZoom);
  const { fx: demFx, fy: demFy } = latLngToFractionalTile(lat, lng, demZoom);
  const demCenterTx = Math.floor(demFx);
  const demCenterTy = Math.floor(demFy);
  const demCx = (1 + (demFx - demCenterTx)) * 256;
  const demCy = (1 + (demFy - demCenterTy)) * 256;

  // 1. 3x3 항공위성 타일 및 실측 Terrarium DEM 타일 병렬 로드
  const rawSatCanvas = document.createElement('canvas');
  rawSatCanvas.width = 768;
  rawSatCanvas.height = 768;
  const rawSatCtx = rawSatCanvas.getContext('2d');

  const rawDemCanvas = document.createElement('canvas');
  rawDemCanvas.width = 768;
  rawDemCanvas.height = 768;
  const rawDemCtx = rawDemCanvas.getContext('2d');

  let demTilesLoaded = 0;
  const tilePromises: Promise<void>[] = [];

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const offsetX = (dx + 1) * 256;
      const offsetY = (dy + 1) * 256;

      // 위성 타일 (satZoom)
      tilePromises.push(
        loadTileImage(getSatelliteTileUrl(satCenterTx + dx, satCenterTy + dy, satZoom))
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

      // 실측 DEM 타일 (demZoom <= 15)
      tilePromises.push(
        loadTileImage(getTerrariumDemTileUrl(demCenterTx + dx, demCenterTy + dy, demZoom))
          .then((img) => {
            if (rawDemCtx) {
              rawDemCtx.drawImage(img, offsetX, offsetY, 256, 256);
              demTilesLoaded++;
            }
          })
          .catch(() => {
            // 네트워크 일시 실패 시 무시
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
    const scaleFactor = pxPerMeterOut * satMpp;
    outCtx.scale(scaleFactor, scaleFactor);

    // 방위각(azimuthDeg) 방향을 3D +X축(오른쪽=90°)에 정렬하기 위한 시계방향 회전각
    const rotateRad = ((90 - azimuthDeg) * Math.PI) / 180;
    outCtx.rotate(rotateRad);

    // 교량 중점(satCx, satCy)이 회전 중심(0, 0)에 일치하도록 그리기
    outCtx.drawImage(rawSatCanvas, -satCx, -satCy);
    outCtx.restore();
  }

  // 3. DEM 고도 데이터 동일 좌표계(회전 + 1:1 미터 스케일 + 이중선형 보간)로 추출
  let rawDemData: ImageData | null = null;
  try {
    if (rawDemCtx && demTilesLoaded > 0) {
      rawDemData = rawDemCtx.getImageData(0, 0, 768, 768);
    }
  } catch (e) {
    console.warn('DEM 캔버스 픽셀 접근 실패 (CORS 제한):', e);
    rawDemData = null;
  }

  const azRad = (azimuthDeg * Math.PI) / 180;
  const sinAz = Math.sin(azRad);
  const cosAz = Math.cos(azRad);

  const elevationGrid: number[][] = [];
  let minElev = Infinity;
  let maxElev = -Infinity;
  let validDemSamples = 0;

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

      // 768x768 DEM 버퍼 연속 픽셀 좌표
      const fpx = demCx + dEast / demMpp;
      const fpy = demCy - dNorth / demMpp;

      let elev = 25.0;
      const sampled = rawDemData ? sampleBilinearDemElevation(rawDemData.data, fpx, fpy) : null;
      if (sampled !== null) {
        elev = sampled;
        validDemSamples++;
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
    hasRealDem: demTilesLoaded > 0 && validDemSamples > 0,
    bounds: {
      north: lat + 0.005,
      south: lat - 0.005,
      east: lng + 0.005,
      west: lng - 0.005
    }
  };
}
