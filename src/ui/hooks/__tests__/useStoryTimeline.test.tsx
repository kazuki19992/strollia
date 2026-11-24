import { act, renderHook } from '@testing-library/react-native';
import type { Animated } from 'react-native';

import { useStoryTimeline, useStoryTimelineValue } from '@/ui/hooks/useStoryTimeline';

/** Animated.Value の現在値を読む(テスト専用の内部API)。 */
function valueOf(clock: Animated.Value): number {
  return (clock as unknown as { __getValue: () => number }).__getValue();
}

describe('ストーリー内アニメーションの時計 useStoryTimeline', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('マウントすると0から経過時間(ミリ秒)を刻む', async () => {
    const { result } = await renderHook(() => useStoryTimeline({ durationMs: 1000, paused: false, completed: false }));

    expect(valueOf(result.current)).toBe(0);
    await act(async () => {
      jest.advanceTimersByTime(500);
    });
    expect(valueOf(result.current)).toBeGreaterThan(300);
    expect(valueOf(result.current)).toBeLessThan(700);
  });

  it('一時停止中は進まず、解除すると続きから進む', async () => {
    const { result, rerender } = await renderHook(
      ({ paused }: { paused: boolean }) => useStoryTimeline({ durationMs: 1000, paused, completed: false }),
      { initialProps: { paused: false } },
    );
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await rerender({ paused: true });
    const pausedAt = valueOf(result.current);

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(valueOf(result.current)).toBe(pausedAt);

    await rerender({ paused: false });
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(valueOf(result.current)).toBe(1000);
  });

  it('completed=true にすると最後の状態へ飛ぶ', async () => {
    const { result, rerender } = await renderHook(
      ({ completed }: { completed: boolean }) => useStoryTimeline({ durationMs: 1000, paused: true, completed }),
      { initialProps: { completed: false } },
    );
    expect(valueOf(result.current)).toBe(0);

    await rerender({ completed: true });

    expect(valueOf(result.current)).toBe(1000);
  });

  it('useStoryTimelineValue は時計から導いた値を返し、時計の進みに追従する', async () => {
    const { result } = await renderHook(() => {
      const clock = useStoryTimeline({ durationMs: 1000, paused: false, completed: false });
      return useStoryTimelineValue(clock, (elapsedMs) => Math.floor(elapsedMs / 100));
    });

    expect(result.current).toBe(0);
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(result.current).toBe(10);
  });

  it('useStoryTimelineValue は最初から完成状態なら完成時の値を返す', async () => {
    const { result } = await renderHook(() => {
      const clock = useStoryTimeline({ durationMs: 1000, paused: true, completed: true });
      return useStoryTimelineValue(clock, (elapsedMs) => elapsedMs);
    });

    expect(result.current).toBe(1000);
  });
});
