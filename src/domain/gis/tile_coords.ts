// src/domain/gis/tile_coords.ts

/**
 * WGS84 위도, 경도 좌표를 Web Mercator (Slippy Map) 타일 좌표 (tileX, tileY)로 변환
 */
export function latLngToTileCoords(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
}

/**
 * 타일 좌표 (tileX, tileY)를 WGS84 위도, 경도로 역변환 (타일의 북서쪽 코너 기준)
 */
export function tileCoordsToLatLng(x: number, y: number, zoom: number): { lat: number; lng: number } {
  const n = Math.pow(2, zoom);
  const lng = (x / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n)));
  const lat = (latRad * 180) / Math.PI;
  return { lat, lng };
}

/**
 * 실제 대한민국 전역 고해상도 위성 정사영상 타일 URL (ESRI World Imagery / CORS Public Open)
 */
export function getSatelliteTileUrl(x: number, y: number, zoom: number): string {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${zoom}/${y}/${x}`;
}

/**
 * 실제 대한민국 전역 실측 수치표고모델(DEM) 래스터 타일 URL (AWS Open Data Terrarium Elevation / CORS Public Open)
 */
export function getTerrariumDemTileUrl(x: number, y: number, zoom: number): string {
  return `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${zoom}/${x}/${y}.png`;
}

/**
 * Terrarium RGB 픽셀 값을 실제 해발고도(EL. m)로 디코딩
 * Height = (R * 256 + G + B / 256) - 32768
 */
export function decodeTerrariumRGBToElevation(r: number, g: number, b: number): number {
  return r * 256 + g + b / 256 - 32768;
}
