import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, AppState, type AppStateStatus, Easing } from 'react-native';

import { resolveAppStateStatus } from '@/ui/appStateStatus';

/** ストーリー1ページの表示時間（ミリ秒）。 */
export const STORY_PAGE_DURATION_MS = 7000;

/** ページ遷移の向き。トランジションのアニメーション方向の判断に使う。 */
export type StoryDirection = 'next' | 'prev';

/** useStoryPlayer の引数。 */
export type UseStoryPlayerArgs = {
  /** 総ページ数。 */
  pageCount: number;
  /** 1ページの表示時間（ミリ秒）。省略時は STORY_PAGE_DURATION_MS。 */
  durationMs?: number;
};

/** useStoryPlayer の戻り値。 */
export type StoryPlayer = {
  /** 現在のページ番号（0始まり）。 */
  index: number;
  /** 直近の遷移の向き。 */
  direction: StoryDirection;
  /** 現在ページの進行度（0〜1）。進行バーの表示に使う。 */
  progress: Animated.Value;
  /** 次のページへ進む。最後のページでは何もしない。 */
  next: () => void;
  /** 前のページへ戻る。先頭では何もしない。 */
  prev: () => void;
  /** 一時停止する（長押し・共有中など）。 */
  pause: () => void;
  /** 一時停止を解除し、残り時間から再開する。 */
  resume: () => void;
  /** 一時停止中か（ユーザー操作による停止とアプリ背面化の両方を含む）。 */
  isPaused: boolean;
};

/**
 * ストーリー再生の状態を管理する。一定時間ごとに自動でページを送り、最後のページでは止まる。
 *
 * 進行バー用の progress は Animated.Value で持ち、React の再レンダーを伴わずに更新する。
 * 一時停止では経過分を残り時間から差し引き、再開時は残り時間だけ進行を続ける。
 * アプリが背面に回ったときは自動で一時停止し、前面に戻ったら再開する。
 */
export function useStoryPlayer({ pageCount, durationMs = STORY_PAGE_DURATION_MS }: UseStoryPlayerArgs): StoryPlayer {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<StoryDirection>('next');
  const [userPaused, setUserPaused] = useState(false);
  const [backgrounded, setBackgrounded] = useState(() => {
    const state = resolveAppStateStatus(AppState.currentState);
    return state === 'background' || state === 'inactive';
  });
  const progress = useRef(new Animated.Value(0)).current;

  /** 現在ページの残り表示時間。一時停止をまたいで保持するため ref に置く。 */
  const remainingMsRef = useRef(durationMs);
  /** 残り時間の計測を開始した時刻。 */
  const startedAtRef = useRef(0);
  /** remainingMsRef がどのページのものか。ページが変わったら残り時間を初期化する判定に使う。 */
  const startedIndexRef = useRef(-1);

  const lastIndex = Math.max(0, pageCount - 1);
  const paused = userPaused || backgrounded;

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      setBackgrounded(state === 'background' || state === 'inactive');
    });
    return () => subscription.remove();
  }, []);

  // ページ変更直後の描画で前ページの progress が1フレーム見えないよう、描画前（layout）に初期化する。
  useLayoutEffect(() => {
    if (startedIndexRef.current !== index) {
      startedIndexRef.current = index;
      remainingMsRef.current = durationMs;
      // 最後のページは自動送りしないため、進行バーは満タンのままにする。
      progress.setValue(index >= lastIndex ? 1 : 0);
    }
  }, [index, lastIndex, durationMs, progress]);

  useEffect(() => {
    if (index >= lastIndex || paused) {
      return;
    }

    const remaining = remainingMsRef.current;
    startedAtRef.current = Date.now();
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: remaining,
      easing: Easing.linear,
      // 進行バーは transform(scaleX)で伸ばすため、ネイティブドライバで動かす(StoryProgressBar 参照)。
      useNativeDriver: true,
    });
    animation.start();
    const timer = setTimeout(() => {
      setDirection('next');
      setIndex((current) => Math.min(current + 1, lastIndex));
    }, remaining);

    return () => {
      clearTimeout(timer);
      animation.stop();
      // ページが変わった場合は layout effect で残り時間を初期化済みのため、上書きしない。
      if (startedIndexRef.current === index) {
        remainingMsRef.current = Math.max(0, remaining - (Date.now() - startedAtRef.current));
      }
    };
  }, [index, paused, lastIndex, durationMs, progress]);

  const next = useCallback(() => {
    setDirection('next');
    setIndex((current) => Math.min(current + 1, lastIndex));
  }, [lastIndex]);

  const prev = useCallback(() => {
    setDirection('prev');
    setIndex((current) => Math.max(current - 1, 0));
  }, []);

  const pause = useCallback(() => setUserPaused(true), []);
  const resume = useCallback(() => setUserPaused(false), []);

  return { index, direction, progress, next, prev, pause, resume, isPaused: paused };
}
