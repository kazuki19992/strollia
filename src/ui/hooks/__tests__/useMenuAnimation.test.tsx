import { act, renderHook } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { useMenuAnimation, MenuAnimationState } from '@/ui/hooks/useMenuAnimation';

describe('メニューアニメーション useMenuAnimation', () => {
  let timingCalls: Array<jest.Mock>;

  beforeEach(() => {
    timingCalls = [];
    jest.spyOn(Animated, 'timing').mockImplementation((() => {
      const animation = { start: jest.fn((cb?: (result: { finished: boolean }) => void) => cb?.({ finished: true })), stop: jest.fn() };
      timingCalls.push(animation.start);
      return animation;
    }) as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('初期状態では isMenuVisible=false である', () => {
    const { result } = renderHook(() => useMenuAnimation(false, 200));

    expect(result.current.isMenuVisible).toBe(false);
  });

  it('isMenuOpen=true に変えると isMenuVisible=true になる', () => {
    const { result, rerender } = renderHook(
      ({ isMenuOpen, durationMs }: { isMenuOpen: boolean; durationMs: number }) => useMenuAnimation(isMenuOpen, durationMs),
      {
        initialProps: { isMenuOpen: false, durationMs: 200 },
      },
    );

    act(() => {
      rerender({ isMenuOpen: true, durationMs: 200 });
    });

    expect(result.current.isMenuVisible).toBe(true);
  });

  it('isMenuOpen 変化時に Animated.timing が呼ばれる', () => {
    const { rerender } = renderHook(
      ({ isMenuOpen, durationMs }: { isMenuOpen: boolean; durationMs: number }) => useMenuAnimation(isMenuOpen, durationMs),
      {
        initialProps: { isMenuOpen: false, durationMs: 300 },
      },
    );

    act(() => {
      rerender({ isMenuOpen: true, durationMs: 300 });
    });

    expect(Animated.timing).toHaveBeenCalledWith(expect.any(Animated.Value), expect.objectContaining({ toValue: 1, duration: 300 }));
  });

  it('resetMenuImmediately を呼ぶと isMenuVisible=false になる', () => {
    const { result, rerender } = renderHook(
      ({ isMenuOpen, durationMs }: { isMenuOpen: boolean; durationMs: number }) => useMenuAnimation(isMenuOpen, durationMs),
      {
        initialProps: { isMenuOpen: true, durationMs: 200 },
      },
    );

    act(() => {
      result.current.resetMenuImmediately();
    });

    // 再レンダー後の state を確認するため再度 rerender が必要
    act(() => {
      rerender({ isMenuOpen: true, durationMs: 200 });
    });

    expect(result.current.isMenuVisible).toBe(false);
  });

  it('menuProgress が Animated.Value のインスタンスである', () => {
    const { result } = renderHook(() => useMenuAnimation(false, 200));

    expect(result.current.menuProgress).toBeInstanceOf(Animated.Value);
  });
});
