import * as ReactNative from 'react-native';
import { renderHook } from '@testing-library/react-native';

import { useIsLandscapeLayout } from '@/ui/hooks/useIsLandscapeLayout';

describe('横画面判定フック useIsLandscapeLayout', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('1180x820のウィンドウでは横画面として true を返す', async () => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 1180, height: 820, scale: 2, fontScale: 1 });

    const { result } = await renderHook(() => useIsLandscapeLayout());

    expect(result.current).toBe(true);
  });

  test('820x1180のウィンドウでは縦画面として false を返す', async () => {
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({ width: 820, height: 1180, scale: 2, fontScale: 1 });

    const { result } = await renderHook(() => useIsLandscapeLayout());

    expect(result.current).toBe(false);
  });
});
