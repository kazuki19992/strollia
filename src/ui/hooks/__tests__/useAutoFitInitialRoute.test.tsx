import { renderHook } from '@testing-library/react-native';
import { useAutoFitInitialRoute } from '@/ui/hooks/useAutoFitInitialRoute';

describe('初期ルートフィットhook useAutoFitInitialRoute', () => {
  test('地図画面で現在地未取得かつルートが複数点ある場合は地図をフィットする', () => {
    const fitToCoordinates = jest.fn();
    const mapRef = {
      current: {
        fitToCoordinates,
      },
    } as unknown as Parameters<typeof useAutoFitInitialRoute>[0];

    renderHook(() =>
      useAutoFitInitialRoute(
        mapRef,
        'map',
        [
          { latitude: 35, longitude: 139 },
          { latitude: 36, longitude: 140 },
        ],
        null,
      ),
    );

    expect(fitToCoordinates).toHaveBeenCalledTimes(1);
  });
});
