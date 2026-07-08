import { act, renderHook } from '@testing-library/react-native';
import * as Location from 'expo-location';

import { useCurrentAreaLabel, useCurrentAreaName } from '@/ui/hooks/useCurrentAreaName';

jest.mock('expo-location', () => ({
  reverseGeocodeAsync: jest.fn(),
}));

const TEST_COORDINATE = { latitude: 35, longitude: 139 };

describe('現在地地域名hook useCurrentAreaName', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('逆ジオコーディング結果から下部ダッシュボード用の地域名を返す', async () => {
    (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([{ city: '千代田区', district: '神田' }]);

    const { result } = renderHook(() => useCurrentAreaLabel({ userCoordinate: TEST_COORDINATE, appState: 'active' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toEqual({ primary: '千代田区', secondary: '神田' });
  });

  test('逆ジオコーディング結果から市区町村名を返す', async () => {
    (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([{ city: '渋谷区' }]);

    const { result } = renderHook(() => useCurrentAreaName({ userCoordinate: TEST_COORDINATE, appState: 'active' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(Location.reverseGeocodeAsync).toHaveBeenCalledWith({ latitude: 35, longitude: 139 });
    expect(result.current).toBe('渋谷区');
  });

  test('起動直後に地域ラベル取得に失敗した場合は取得中…を表示する', async () => {
    (Location.reverseGeocodeAsync as jest.Mock).mockRejectedValue(new Error('reverse geocode failed'));

    const { result } = renderHook(() => useCurrentAreaLabel({ userCoordinate: TEST_COORDINATE, appState: 'active' }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toEqual({ primary: '取得中…', secondary: null });
  });

  test('成功後に地域ラベル取得に失敗した場合は直前の地名を継続表示する', async () => {
    (Location.reverseGeocodeAsync as jest.Mock)
      .mockResolvedValueOnce([{ city: '千代田区', district: '神田' }])
      .mockRejectedValueOnce(new Error('reverse geocode failed'));

    const { result, rerender } = renderHook(
      ({ userCoordinate }: { userCoordinate: typeof TEST_COORDINATE }) => useCurrentAreaLabel({ userCoordinate, appState: 'active' }),
      { initialProps: { userCoordinate: { latitude: 35, longitude: 139 } } },
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toEqual({ primary: '千代田区', secondary: '神田' });

    act(() => {
      rerender({ userCoordinate: { latitude: 36, longitude: 140 } });
    });

    await act(async () => {
      await Promise.resolve();
    });

    // エラー後も直前の地名が継続表示される
    expect(result.current).toEqual({ primary: '千代田区', secondary: '神田' });
  });

  test('アプリが非アクティブなら地域ラベルの逆ジオコーディングを呼ばない', () => {
    const { result } = renderHook(() => useCurrentAreaLabel({ userCoordinate: TEST_COORDINATE, appState: 'background' }));

    expect(Location.reverseGeocodeAsync).not.toHaveBeenCalled();
    expect(result.current).toEqual({ primary: '現在地を確認中', secondary: null });
  });

  test('現在地座標がなければ地域名の逆ジオコーディングを呼ばない', () => {
    const { result } = renderHook(() => useCurrentAreaName({ userCoordinate: null, appState: 'active' }));

    expect(Location.reverseGeocodeAsync).not.toHaveBeenCalled();
    expect(result.current).toBe('現在地を確認中');
  });
});
