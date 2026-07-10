import { act, renderHook } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { useScreenTransitionOpacity } from '@/ui/hooks/useScreenTransitionOpacity';

describe('画面遷移フェードhook useScreenTransitionOpacity', () => {
  let timingMocks: Array<{ start: jest.Mock }>;

  beforeEach(() => {
    timingMocks = [];
    jest.spyOn(Animated, 'timing').mockImplementation((() => {
      const animation = { start: jest.fn(), stop: jest.fn() };
      timingMocks.push(animation);
      return animation;
    }) as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('Animated.Value のインスタンスを返す', () => {
    const { result } = renderHook(() => useScreenTransitionOpacity('map', 300));

    expect(result.current).toBeInstanceOf(Animated.Value);
  });

  it('マウント時に Animated.timing が呼ばれる', () => {
    renderHook(() => useScreenTransitionOpacity('map', 300));

    expect(Animated.timing).toHaveBeenCalledTimes(1);
    expect(Animated.timing).toHaveBeenCalledWith(expect.any(Animated.Value), expect.objectContaining({ toValue: 1, duration: 300 }));
  });

  it('screenKey が変わると Animated.timing が再度呼ばれる', () => {
    const { rerender } = renderHook(
      ({ screenKey, durationMs }: { screenKey: string; durationMs: number }) => useScreenTransitionOpacity(screenKey, durationMs),
      {
        initialProps: { screenKey: 'map', durationMs: 300 },
      },
    );

    act(() => {
      rerender({ screenKey: 'settings', durationMs: 300 });
    });

    expect(Animated.timing).toHaveBeenCalledTimes(2);
  });

  it('screenKey と durationMs が同じ再レンダーでは追加のアニメーションが呼ばれない', () => {
    const { rerender } = renderHook(
      ({ screenKey, durationMs }: { screenKey: string; durationMs: number }) => useScreenTransitionOpacity(screenKey, durationMs),
      {
        initialProps: { screenKey: 'map', durationMs: 300 },
      },
    );

    // effect の依存配列 [durationMs, opacity, screenKey] がすべて同じなら再実行されない
    act(() => {
      rerender({ screenKey: 'map', durationMs: 300 });
    });

    expect(Animated.timing).toHaveBeenCalledTimes(1);
  });

  it('durationMs が変わると Animated.timing が再度呼ばれる（依存配列に含まれるため）', () => {
    const { rerender } = renderHook(
      ({ screenKey, durationMs }: { screenKey: string; durationMs: number }) => useScreenTransitionOpacity(screenKey, durationMs),
      {
        initialProps: { screenKey: 'map', durationMs: 300 },
      },
    );

    act(() => {
      rerender({ screenKey: 'map', durationMs: 500 });
    });

    expect(Animated.timing).toHaveBeenCalledTimes(2);
    expect(Animated.timing).toHaveBeenLastCalledWith(expect.any(Animated.Value), expect.objectContaining({ duration: 500 }));
  });

  it('toValue=1 へのアニメーションが指定される（フェードイン）', () => {
    renderHook(() => useScreenTransitionOpacity('map', 400));

    expect(Animated.timing).toHaveBeenCalledWith(expect.any(Animated.Value), expect.objectContaining({ toValue: 1 }));
  });

  it('start() が呼ばれる（アニメーション開始）', () => {
    renderHook(() => useScreenTransitionOpacity('map', 300));

    expect(timingMocks[0]!.start).toHaveBeenCalledTimes(1);
  });
});
