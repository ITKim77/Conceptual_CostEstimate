// src/domain/gis/terrain_dem_loader.ts
import {
  latLngToTileCoords,
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
 * 대한민국 전역 임의 좌표(lat, lng)에 대한 실제 항공위성사진과 실측 DEM 고도 데이터를 로드
 */
export async function loadRealWorldTerrain(
  lat: number,
  lng: number,
  zoom: number = 15,
  gridSegmentsX: number = 60,
  gridSegmentsZ: number = 30
): Promise<RealWorldTerrainData> {
  const centerTile = latLngToTileCoords(lat, lng, zoom);

  // 1. 실제 항공위성사진 타일 로드 (중심 타일 1장 또는 2x2 타일)
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  try {
    const satUrl = getSatelliteTileUrl(centerTile.x, centerTile.y, zoom);
    const satImg = await loadTileImage(satUrl);
    if (ctx) {
      ctx.drawImage(satImg, 0, 0, 512, 512);
    }
  } catch (e) {
    console.warn('위성 타일 로드 실패, 자연 위성 텍스처 폴백 적용:', e);
    if (ctx) {
      // 위성 이미지 로드 불가 시 자연 위성 색조 폴백
      ctx.fillStyle = '#39533B';
      ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = '#2D452F';
      ctx.strokeRect(10, 10, 492, 492);
    }
  }

  // 2. 실제 DEM 표고 타일 로드 및 고도 그리드 디코딩
  const demCanvas = document.createElement('canvas');
  demCanvas.width = 256;
  demCanvas.height = 256;
  const demCtx = demCanvas.getContext('2d');

  let rawElevationData: ImageData | null = null;
  try {
    const demUrl = getTerrariumDemTileUrl(centerTile.x, centerTile.y, zoom);
    const demImg = await loadTileImage(demUrl);
    if (demCtx) {
      demCtx.drawImage(demImg, 0, 0, 256, 256);
      rawElevationData = demCtx.getImageData(0, 0, 256, 256);
    }
  } catch (e) {
    console.warn('실측 DEM 타일 로드 실패, 자연 지형 표고 추정치 적용:', e);
  }

  // 3. 그리드 정규화 및 고도 추출
  const elevationGrid: number[][] = [];
  let minElev = Infinity;
  let maxElev = -Infinity;

  for (let z = 0; z <= gridSegmentsZ; z++) {
    const row: number[] = [];
    const v = z / gridSegmentsZ; // 0 (북) ~ 1 (남)
    for (let x = 0; x <= gridSegmentsX; x++) {
      const u = x / gridSegmentsX; // 0 (서) ~ 1 (동)

      let elev = 25.0; // 기본 표고
      if (rawElevationData) {
        const px = Math.min(255, Math.floor(u * 256));
        const py = Math.min(255, Math.floor(v * 256));
        const idx = (py * 256 + px) * 4;
        const r = rawElevationData.data[idx];
        const g = rawElevationData.data[idx + 1];
        const b = rawElevationData.data[idx + 2];
        const realHeight = decodeTerrariumRGBToElevation(r, g, b);
        elev = Math.max(-10, Math.min(2000, realHeight)); // 유효 범위 필터
      } else {
        // 네트워크 차단 시 완만한 자연 구릉 폴백
        elev = 25 + Math.sin(u * Math.PI) * -12 + (v - 0.5) * 5;
      }

      minElev = Math.min(minElev, elev);
      maxElev = Math.max(maxElev, elev);
      row.push(elev);
    }
    elevationGrid.push(row);
  }

  const centerElev = elevationGrid[Math.floor(gridSegmentsZ / 2)][Math.floor(gridSegmentsX / 2)] || 25;

  return {
    satelliteCanvas: canvas,
    elevationGrid,
    minElevation: minElev === Infinity ? 10 : minElev,
    maxElevation: maxElev === -Infinity ? 50 : maxElev,
    centerElevation: centerElev,
    bounds: {
      north: lat + 0.005,
      south: lat - 0.005,
      east: lng + 0.005,
      west: lng - 0.005
    }
  };
}

