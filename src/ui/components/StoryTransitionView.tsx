import { BlurView } from 'expo-blur';
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

/** StoryTransitionView の props。 */
export type StoryTransitionViewProps = {
  /** 表示中ページの識別子。変わるとトランジションが走る。 */
  pageKey: string;
  /** 表示するページ内容。 */
  children: ReactNode;
  /**
   * true のとき遷移を打ち切り、退場中のページを捨てて現在ページだけを完成状態(拡大なし・不透明・ぼかしなし)で描く。
   * 共有画像のキャプチャに前のページや遷移途中の見た目が写らないようにするために使う。
   */
  settled?: boolean;
};

type Layer = { key: string; children: ReactNode };

/** 入場アニメーションの長さ（ミリ秒）。 */
const ENTER_MS = 700;
/** 退場アニメーションの長さ（ミリ秒）。 */
const EXIT_MS = 500;
/** ぼかしの最大強度。 */
const BLUR_MAX = 40;

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

/** 進行度に応じてぼかし強度を変える BlurView。入る側は強→0、出る側は0→強。 */
function AnimatedBlur({ progress, direction }: { progress: Animated.Value; direction: 'in' | 'out' }) {
  const intensity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: direction === 'in' ? [BLUR_MAX, 0] : [0, BLUR_MAX],
  });
  // BlurView の intensity は number 型だが、Animated 経由でアニメーション値（補間ノード）を渡せるため型だけ合わせる。
  return (
    <AnimatedBlurView tint="dark" intensity={intensity as unknown as number} style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]} />
  );
}

/**
 * ページ切り替え時に「ズーム＋ぼかし」でつなぐコンテナ。
 *
 * 入る側は scale 1.15→1・opacity 0→1（700ms）、出る側は scale 1→0.9・opacity 1→0（500ms）。
 * ぼかしは BlurView を重ねて intensity を下げて表現する。実機で重い場合は AnimatedBlur を外せば拡大縮小＋フェードのみになる。
 * 現在ページは props から直接描画するため、children の更新が1レンダー遅れない。
 * 遷移中にさらにページが変わった場合は、途中のアニメーションを止めて、直前に表示していたページを新たな退場側にして再開する。
 */
export function StoryTransitionView({ pageKey, children, settled = false }: StoryTransitionViewProps) {
  /** 直近にレンダーしたページ。次の遷移で退場側になる。 */
  const lastShownRef = useRef<Layer>({ key: pageKey, children });
  const [trackedKey, setTrackedKey] = useState(pageKey);
  const [leaving, setLeaving] = useState<Layer | null>(null);
  const enter = useRef(new Animated.Value(1)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  // render 中の state 更新（React 公式の「props 変化に応じた state 調整」）。描画前に退場側を確定させるため。
  if (trackedKey !== pageKey) {
    setTrackedKey(pageKey);
    setLeaving(lastShownRef.current);
  }

  // 打ち切り中は退場側を捨てる(render 中の state 調整。解除後に前のページが戻らないようにするため)。
  if (settled && leaving) {
    setLeaving(null);
  }

  useEffect(() => {
    lastShownRef.current = { key: pageKey, children };
  });

  // 打ち切り: 描画は下の showLeaving / settled 分岐で即座に完成状態になる。ここでは状態とアニメーションを片付ける。
  useLayoutEffect(() => {
    if (!settled) return;
    animationRef.current?.stop();
    enter.setValue(1);
    exit.setValue(1);
  }, [settled, enter, exit]);

  useLayoutEffect(() => {
    if (!leaving || settled) return;
    animationRef.current?.stop();
    // 描画前に初期値へ戻し、新ページが一瞬フル表示されるちらつきを防ぐ。
    enter.setValue(0);
    exit.setValue(0);
    const animation = Animated.parallel([
      Animated.timing(enter, { toValue: 1, duration: ENTER_MS, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(exit, { toValue: 1, duration: EXIT_MS, easing: Easing.in(Easing.cubic), useNativeDriver: false }),
    ]);
    animationRef.current = animation;
    animation.start(({ finished }) => {
      if (finished) setLeaving(null);
    });
    // leaving が差し替わる（遷移開始）ごとにだけ走らせる。
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settled の変化では遷移を始め直さない
  }, [leaving, enter, exit]);

  useEffect(() => () => animationRef.current?.stop(), []);

  const enterStyle = {
    opacity: enter,
    transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [1.15, 1] }) }],
  };
  const exitStyle = {
    opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
    transform: [{ scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0.9] }) }],
    pointerEvents: 'none' as const,
  };

  // settled の間は state の片付け(layout effect)を待たず、この描画から退場側を出さない。
  const showLeaving = leaving != null && !settled;

  return (
    <>
      {showLeaving && leaving ? (
        <Animated.View key={leaving.key} style={[StyleSheet.absoluteFill, exitStyle]}>
          {leaving.children}
          <AnimatedBlur progress={exit} direction="out" />
        </Animated.View>
      ) : null}
      <Animated.View key={pageKey} style={[StyleSheet.absoluteFill, settled ? null : enterStyle]}>
        {children}
        {showLeaving ? <AnimatedBlur progress={enter} direction="in" /> : null}
      </Animated.View>
    </>
  );
}
