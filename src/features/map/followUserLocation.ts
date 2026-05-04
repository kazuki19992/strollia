import type { LatLng, Region } from 'react-native-maps';

export function isRegionCenteredOnCoordinate(region: Region, coordinate: LatLng, thresholdRatio = 0.18): boolean {
  const latitudeThreshold = Math.max(region.latitudeDelta * thresholdRatio, 0.0003);
  const longitudeThreshold = Math.max(region.longitudeDelta * thresholdRatio, 0.0003);

  return (
    Math.abs(region.latitude - coordinate.latitude) <= latitudeThreshold &&
    Math.abs(region.longitude - coordinate.longitude) <= longitudeThreshold
  );
}
