import { BlurView } from 'expo-blur';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

/** StoryTransitionView の props。 */
export type StoryTransitionViewProps = {
  /** 表示中ページの識別子。変わるとトランジションが走る。 */
  pageKey: string;
  /** 遷移の向き。 */
  direction: 'next' | 'prev';
  /** 表示するページ内容。 */
  children: ReactNode;
};

type Layer = { key: string; children: ReactNode };

/** 入場アニメーションの長さ（ミリ秒）。 */
const ENTER_MS = 700;
/** 退場アニメーションの長さ（ミリ秒）。 */
const EXIT_MS = 500;
/** ぼかしの最大強度。 */
const BLUR_MAX = 40;

/**
 * ページ切り替え時に「ズーム＋ぼかし」でつなぐコンテナ。
 *
 * 入る側は scale 1.15→1・opacity 0→1（700ms）、出る側は scale 1→0.9・opacity 1→0（500ms）。
 * ぼかしは BlurView を重ねて intensity を下げて表現する。実機で重い場合は BlurView を外せば拡大縮小＋フェードのみになる。
 */
export function StoryTransitionView({ pageKey, direction, children }: StoryTransitionViewProps) {
  const [current, setCurrent] = useState<Layer>({ key: pageKey, children });
  const [leaving, setLeaving] = useState<Layer | null>(null);
  const enter = useRef(new Animated.Value(1)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const currentRef = useRef(current);

  useEffect(() => {
    if (pageKey === currentRef.current.key) {
      // 同一ページ内の再レンダーは内容だけ差し替える。
      const updated = { key: pageKey, children };
      currentRef.current = updated;
      setCurrent(updated);
      return;
    }
    setLeaving(currentRef.current);
    const nextLayer = { key: pageKey, children };
    currentRef.current = nextLayer;
    setCurrent(nextLayer);
    enter.setValue(0);
    exit.setValue(0);
    Animated.parallel([
      Animated.timing(enter, { toValue: 1, duration: ENTER_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(exit, { toValue: 1, duration: EXIT_MS, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
    ]).start(({ finished }) => {
      if (finished) setLeaving(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pageKey の変化時のみ遷移を開始する
  }, [pageKey]);

  // 戻る場合も同じズーム方向を使う（direction は将来の向き別演出のために受け取る）。
  void direction;

  const enterStyle = {
    opacity: enter,
    transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [1.15, 1] }) }],
  };
  const exitStyle = {
    opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [{ scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }) }],
  };

  return (
    <>
      {leaving ? (
        <Animated.View key={leaving.key} style={[StyleSheet.absoluteFill, exitStyle]} pointerEvents="none">
          {leaving.children}
          <AnimatedBlur progress={exit} direction="out" />
        </Animated.View>
      ) : null}
      <Animated.View key={current.key} style={[StyleSheet.absoluteFill, enterStyle]}>
        {current.children}
        {leaving ? <AnimatedBlur progress={enter} direction="in" /> : null}
      </Animated.View>
    </>
  );
}

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

/** 進行度に応じてぼかし強度を変える BlurView。入る側は強→0、出る側は0→強。 */
function AnimatedBlur({ progress, direction }: { progress: Animated.Value; direction: 'in' | 'out' }) {
  const intensity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: direction === 'in' ? [BLUR_MAX, 0] : [0, BLUR_MAX],
  });
  return <AnimatedBlurView pointerEvents="none" tint="dark" intensity={intensity as unknown as number} style={StyleSheet.absoluteFill} />;
}
