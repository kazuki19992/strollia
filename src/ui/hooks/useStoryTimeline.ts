import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';

/** useStoryTimeline の引数。 */
export type UseStoryTimelineArgs = {
  /** 時計が進む長さ(ミリ秒)。ページ内アニメーションがすべて終わる時刻以上にする。 */
  durationMs: number;
  /** 一時停止中か(長押し・共有中・アプリ背面化)。止めた位置から再開する。 */
  paused: boolean;
  /** true のとき最後の状態へ飛ばす。共有画像を完成した見た目で撮るために使う。 */
  completed: boolean;
};

/**
 * ストーリー1ページ内のアニメーション用の時計(経過ミリ秒の Animated.Value)を返す。
 *
 * ページ内の要素はこの1本の時計を `interpolate` して動かす。個別のアニメーションを並べる代わりに
 * 時計を1本にすることで、一時停止(止めて残りから再開)と完成状態への早送りを1か所で扱える。
 * マウントのたびに0から始まるため、ページがアクティブになるたびに最初から再生される。
 */
export function useStoryTimeline({ durationMs, paused, completed }: UseStoryTimelineArgs): Animated.Value {
  // 描画中に作り直さないよう、初回だけ生成する(useState の遅延初期化)
  const [clock] = useState(() => new Animated.Value(0));
  /** 直近に止めた位置。stopAnimation のコールバックで更新する。 */
  const positionRef = useRef(0);

  useEffect(() => {
    if (completed) {
      clock.stopAnimation();
      clock.setValue(durationMs);
      positionRef.current = durationMs;
      return;
    }
    if (paused) {
      return;
    }

    const remaining = Math.max(0, durationMs - positionRef.current);
    const animation = Animated.timing(clock, {
      toValue: durationMs,
      duration: remaining,
      easing: Easing.linear,
      // 幅・色など非ネイティブのプロパティも補間するため JS ドライバで動かす。
      useNativeDriver: false,
    });
    animation.start();

    return () => {
      clock.stopAnimation((value) => {
        positionRef.current = value;
      });
    };
  }, [clock, durationMs, paused, completed]);

  return clock;
}

/**
 * 時計の `startMs` から `durationMs` かけて 0→1 になる補間値を返す(範囲外はクランプ)。
 * ページ内の各要素の遅延付きアニメーションを表すのに使う。
 */
export function timelineProgress(
  clock: Animated.Value,
  startMs: number,
  durationMs: number,
  easing?: (value: number) => number,
): Animated.AnimatedInterpolation<number> {
  return clock.interpolate({
    inputRange: [startMs, startMs + Math.max(1, durationMs)],
    outputRange: [0, 1],
    extrapolate: 'clamp',
    easing,
  });
}

/** Animated.Value の現在値を読む。公開APIに同期の getter がないため内部メソッドを使う。 */
function readClock(clock: Animated.Value): number {
  return (clock as unknown as { __getValue: () => number }).__getValue();
}

/**
 * 時計の値から導いた値を React の state として返す(カウントアップの文字列など、Animated で描けない表示用)。
 *
 * select の結果が前回と同じ(プリミティブで等しい)なら再レンダーしないため、
 * 地図の軌跡のような重い表示は、select で段階(整数)に量子化してから使う。
 */
export function useStoryTimelineValue<T>(clock: Animated.Value, select: (elapsedMs: number) => T): T {
  const selectRef = useRef(select);
  useLayoutEffect(() => {
    selectRef.current = select;
  });
  const [value, setValue] = useState<T>(() => select(readClock(clock)));

  useEffect(() => {
    const id = clock.addListener(({ value: elapsedMs }) => setValue(selectRef.current(elapsedMs)));
    // 購読前に時計が動いた(完成状態への早送りなど)場合に取りこぼさないよう、現在値で合わせる。
    setValue(selectRef.current(readClock(clock)));
    return () => clock.removeListener(id);
  }, [clock]);

  return value;
}
