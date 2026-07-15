import { renderHook } from '@testing-library/react-native';
import { useAutoFitInitialRoute } from '@/ui/hooks/useAutoFitInitialRoute';

const region = { latitude: 35, longitude: 139, latitudeDelta: 1, longitudeDelta: 1 };

describe('初期ルートフィットhook useAutoFitInitialRoute', () => {
  test('地図画面で現在地未取得かつ記録がある場合は初期表示範囲へアニメーションする', () => {
    const animateToRegion = jest.fn();
    const mapRef = { current: { animateToRegion } } as unknown as Parameters<typeof useAutoFitInitialRoute>[0];

    renderHook(() => useAutoFitInitialRoute(mapRef, 'map', region, true, null));

    expect(animateToRegion).toHaveBeenCalledTimes(1);
    expect(animateToRegion).toHaveBeenCalledWith(region);
  });

  test('記録が1件もない場合はアニメーションしない', () => {
    const animateToRegion = jest.fn();
    const mapRef = { current: { animateToRegion } } as unknown as Parameters<typeof useAutoFitInitialRoute>[0];

    renderHook(() => useAutoFitInitialRoute(mapRef, 'map', region, false, null));

    expect(animateToRegion).not.toHaveBeenCalled();
  });

  test('現在地取得済みの場合はアニメーションしない', () => {
    const animateToRegion = jest.fn();
    const mapRef = { current: { animateToRegion } } as unknown as Parameters<typeof useAutoFitInitialRoute>[0];

    renderHook(() => useAutoFitInitialRoute(mapRef, 'map', region, true, { latitude: 35, longitude: 139 }));

    expect(animateToRegion).not.toHaveBeenCalled();
  });

  test('地図画面以外ではアニメーションしない', () => {
    const animateToRegion = jest.fn();
    const mapRef = { current: { animateToRegion } } as unknown as Parameters<typeof useAutoFitInitialRoute>[0];

    renderHook(() => useAutoFitInitialRoute(mapRef, 'settings', region, true, null));

    expect(animateToRegion).not.toHaveBeenCalled();
  });
});
