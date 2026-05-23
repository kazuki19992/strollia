import type { GridOverlayConfig } from './config/gridOverlayConfig';
import { GRID_OVERLAY_CONFIG } from './config/gridOverlayConfig';

type RegionOpacityLike = {
  latitudeDelta: number;
};

/**
 * 表示範囲に応じてFog opacityを線形補間する。
 *
 * @param region - MapView表示範囲に相当する値。
 * @param config - Grid Overlay設定。
 * @returns Fog opacity。
 */
export function getFogOpacity(
  region: RegionOpacityLike | null,
  config: GridOverlayConfig = GRID_OVERLAY_CONFIG,
): number {
  if (!region) {
    return config.minimumFogOpacity;
  }

  const latitudeDelta = Math.abs(region.latitudeDelta);

  if (latitudeDelta <= config.opacityStartLatitudeDelta) {
    return config.minimumFogOpacity;
  }

  if (latitudeDelta >= config.opacityEndLatitudeDelta) {
    return config.maximumFogOpacity;
  }

  const progress =
    (latitudeDelta - config.opacityStartLatitudeDelta) /
    (config.opacityEndLatitudeDelta - config.opacityStartLatitudeDelta);

  return config.minimumFogOpacity + (config.maximumFogOpacity - config.minimumFogOpacity) * progress;
}
