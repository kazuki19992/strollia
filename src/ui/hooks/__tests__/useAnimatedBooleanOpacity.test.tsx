import { act, renderHook } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { useAnimatedBooleanOpacity } from '@/ui/hooks/useAnimatedBooleanOpacity';

type MockAnimation = {
  start: jest.Mock;
  stop: jest.Mock;
};

type InspectableAnimatedValue = Animated.Value & {
  __getValue: () => number;
};

describe('真偽値フェードhook useAnimatedBooleanOpacity', () => {
  let animations: MockAnimation[];

  beforeEach(() => {
    animations = [];
    jest.spyOn(Animated, 'timing').mockImplementation((() => {
      const animation = {
        start: jest.fn(),
        stop: jest.fn(),
      };
      animations.push(animation);

      return animation;
    }) as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('visible=trueの場合は初期値1で開始する', () => {
    const { result } = renderHook(() => useAnimatedBooleanOpacity(true, 500));

    expect((result.current as InspectableAnimatedValue).__getValue()).toBe(1);
  });

  it('visible=falseの場合は初期値0で開始する', () => {
    const { result } = renderHook(() => useAnimatedBooleanOpacity(false, 500));

    expect((result.current as InspectableAnimatedValue).__getValue()).toBe(0);
  });

  it('visibleとdurationMsに応じたフェードアニメーションを開始する', () => {
    const { rerender } = renderHook(
      ({ visible, durationMs }: { visible: boolean; durationMs: number }) => useAnimatedBooleanOpacity(visible, durationMs),
      {
        initialProps: { visible: false, durationMs: 250 },
      },
    );

    expect(Animated.timing).toHaveBeenLastCalledWith(expect.any(Animated.Value), {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    });

    rerender({ visible: true, durationMs: 600 });

    expect(Animated.timing).toHaveBeenLastCalledWith(expect.any(Animated.Value), {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    });
  });

  it('visible変更時は前回アニメーションを停止してから次のアニメーションを開始する', () => {
    const { rerender } = renderHook(
      ({ visible, durationMs }: { visible: boolean; durationMs: number }) => useAnimatedBooleanOpacity(visible, durationMs),
      {
        initialProps: { visible: false, durationMs: 250 },
      },
    );

    const firstAnimation = animations[0];

    act(() => {
      rerender({ visible: true, durationMs: 250 });
    });

    expect(firstAnimation.stop).toHaveBeenCalledTimes(1);
    expect(animations).toHaveLength(2);
    expect(animations[1].start).toHaveBeenCalledTimes(1);
  });
});
