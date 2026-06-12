import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Animated, Easing, LayoutChangeEvent, Modal, PanResponder, Pressable, Text, View } from 'react-native';

import { AppStyles } from '../appStyles';
import { shouldDismissAchievementModalSwipe, shouldDismissAchievementModalTerminate } from './achievementUnlockModalLogic';
import { ConfettiOverlay } from './ConfettiOverlay';

/** 自動で閉じるまでの待機時間。 */
const AUTO_CLOSE_DELAY_MS = 10_000;
/** 中身が変わってカードの高さが変わるときのアニメーション時間。 */
const CARD_RESIZE_DURATION_MS = 500;

/** render-prop の子へ渡す補助関数。 */
export type DialogChildHelpers = {
  /** 自動クローズを止める（共有シートを開く前などに使う）。 */
  pauseAutoClose: () => void;
};

/** 汎用ダイアログのprops。 */
export type DialogProps = {
  /** 表示状態。 */
  visible: boolean;
  /**
   * 本文。関数を渡すと pauseAutoClose を受け取れる。
   *
   * 注意: カードは「中身の自然な高さ」に合わせて高さをアニメーションする（{@link Dialog} 参照）。
   * そのため本文は内容なりの高さになるものを渡すこと。`flex: 1` や `height: '100%'` のように
   * 親の高さを埋めようとするスタイルは効かない（高さが確定しないため潰れる）。
   * 画面より高い中身（内部スクロールが必要なもの）も想定していない。
   * 配置は Dialog 側が行うため、呼び出し側で position:'absolute' などを付ける必要はない。
   */
  children: ReactNode | ((helpers: DialogChildHelpers) => ReactNode);
  /** 紙吹雪を背景に表示するか。 */
  showConfetti?: boolean;
  /** 一定時間で自動的に閉じるか。 */
  autoClose?: boolean;
  /** スワイプで閉じられるようにするか。trueのときヒント文言も表示する。 */
  swipeToClose?: boolean;
  /** false のとき閉じる手段（×ボタン・スワイプ・背景/戻る）を無効化する。既定 true。 */
  dismissible?: boolean;
  /** 紙吹雪の再生キー。 */
  animationKey?: string | null;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 閉じる処理。 */
  onClose: () => void;
};

/**
 * スワイプ/紙吹雪/自動クローズを備えた汎用ダイアログ。
 *
 * カードの高さは中身の自然な高さに追従し、中身が変わって高さが変わるときは
 * 0.5秒の減速移動でアニメーションする（初回表示時は即時）。これは Dialog 共通の
 * 既定挙動で、チュートリアルや実績モーダルなどすべての利用箇所に適用される。
 *
 * 実装上、中身は内部で absolute 配置のラッパーに入れて自然な高さを測定する。
 * このため呼び出し側の本文では `flex: 1` / `height: '100%'` など親の高さを埋める指定は使えない
 * （{@link DialogProps.children} 参照）。配置は Dialog が行うので absolute 等を付ける必要はない。
 */
export function Dialog({ visible, children, showConfetti = false, autoClose = false, swipeToClose = true, dismissible = true, animationKey = null, styles, onClose }: DialogProps) {
  const modalProgress = useRef(new Animated.Value(0)).current;
  const autoCloseProgress = useRef(new Animated.Value(0)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);
  // 中身の高さ。最初の測定では即反映し、以降の変化は減速移動でアニメーションする。
  const cardHeight = useRef(new Animated.Value(0)).current;
  const measuredHeightRef = useRef(0);
  const hasMeasuredRef = useRef(false);
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);
  const lastContentRef = useRef<ReactNode>(null);
  const [isAutoClosePaused, setIsAutoClosePaused] = useState(false);
  const [isRendered, setIsRendered] = useState(visible);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const clearAutoCloseTimer = useCallback(function clearAutoCloseTimer(): void {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
  }, []);

  /** 退場アニメーションを再生し、必要なら親へ通知する。 */
  const animateOut = useCallback(
    function animateOut(notifyParent: boolean): void {
      if (isClosingRef.current) {
        return;
      }

      isClosingRef.current = true;
      autoCloseProgress.stopAnimation();
      clearAutoCloseTimer();
      if (notifyParent) {
        onCloseRef.current();
      }
      Animated.parallel([
        Animated.timing(modalProgress, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(dragX, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(dragY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) {
          // 次に開くときは新しい中身の高さで測り直すため、測定状態をリセットする。
          hasMeasuredRef.current = false;
          measuredHeightRef.current = 0;
          setIsRendered(false);
        }
      });
    },
    [autoCloseProgress, clearAutoCloseTimer, dragX, dragY, modalProgress],
  );

  // 登場: visible が true になる / animationKey が変わると再生する。
  useEffect(() => {
    if (!visible) {
      return;
    }

    isClosingRef.current = false;
    setIsAutoClosePaused(false);
    setIsRendered(true);
    dragX.setValue(0);
    dragY.setValue(0);
    modalProgress.setValue(0);
    autoCloseProgress.setValue(0);
    clearAutoCloseTimer();
    Animated.spring(modalProgress, { toValue: 1, damping: 9, mass: 0.72, stiffness: 190, useNativeDriver: true }).start();
    if (autoClose) {
      Animated.timing(autoCloseProgress, { toValue: 1, duration: AUTO_CLOSE_DELAY_MS, useNativeDriver: false }).start();
    }
  }, [visible, animationKey, autoClose, autoCloseProgress, clearAutoCloseTimer, dragX, dragY, modalProgress]);

  // 親が visible=false にしたら退場（親へ再通知しない）。
  useEffect(() => {
    if (!visible && isRendered) {
      animateOut(false);
    }
  }, [visible, isRendered, animateOut]);

  // 自動クローズタイマー。
  useEffect(() => {
    if (!autoClose || !visible || !isRendered || isAutoClosePaused) {
      return;
    }

    autoCloseTimerRef.current = setTimeout(() => animateOut(true), AUTO_CLOSE_DELAY_MS);

    return clearAutoCloseTimer;
  }, [autoClose, visible, isRendered, isAutoClosePaused, animationKey, animateOut, clearAutoCloseTimer]);

  /** 自動クローズを止める。 */
  const pauseAutoClose = useCallback(
    function pauseAutoClose(): void {
      setIsAutoClosePaused(true);
      autoCloseProgress.stopAnimation();
      clearAutoCloseTimer();
    },
    [autoCloseProgress, clearAutoCloseTimer],
  );

  const resetDragPosition = useCallback(
    function resetDragPosition(): void {
      Animated.spring(dragX, { toValue: 0, damping: 12, stiffness: 210, useNativeDriver: true }).start();
      Animated.spring(dragY, { toValue: 0, damping: 12, stiffness: 210, useNativeDriver: true }).start();
    },
    [dragX, dragY],
  );

  const panResponder = useMemo(
    () => {
      if (!swipeToClose) {
        return null;
      }

      return PanResponder.create({
        onStartShouldSetPanResponder: () => dismissible,
        onMoveShouldSetPanResponder: (_, gestureState) => dismissible && (Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4),
        onPanResponderGrant: () => {
          dragX.stopAnimation();
          dragY.stopAnimation();
        },
        onPanResponderMove: (_, gestureState) => {
          dragX.setValue(gestureState.dx);
          dragY.setValue(gestureState.dy);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (swipeToClose && shouldDismissAchievementModalSwipe(gestureState)) {
            animateOut(true);
            return;
          }
          resetDragPosition();
        },
        onPanResponderTerminate: (_, gestureState) => {
          if (swipeToClose && shouldDismissAchievementModalTerminate(gestureState)) {
            animateOut(true);
            return;
          }
          resetDragPosition();
        },
      });
    },
    [animateOut, dismissible, dragX, dragY, resetDragPosition, swipeToClose],
  );

  const distanceOpacity = Animated.add(dragX, dragY).interpolate({
    inputRange: [-260, -90, 0, 90, 260],
    outputRange: [0.35, 0.68, 1, 0.68, 0.35],
    extrapolate: 'clamp',
  });

  // 中身の自然な高さを測定し、カード高さへ反映する。初回は即時、以降は減速移動でアニメーション。
  const handleContentLayout = useCallback(
    function handleContentLayout(event: LayoutChangeEvent): void {
      const nextHeight = event.nativeEvent.layout.height;
      if (nextHeight <= 0 || nextHeight === measuredHeightRef.current) {
        return;
      }
      measuredHeightRef.current = nextHeight;
      if (!hasMeasuredRef.current) {
        hasMeasuredRef.current = true;
        cardHeight.setValue(nextHeight);
        return;
      }
      Animated.timing(cardHeight, {
        toValue: nextHeight,
        duration: CARD_RESIZE_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    },
    [cardHeight],
  );

  const content = typeof children === 'function' ? children({ pauseAutoClose }) : children;
  // 閉じる際に親が中身を空にしても、退場アニメーション中はカードが縮まないよう直前の中身を保持する。
  if (content) {
    lastContentRef.current = content;
  }
  const displayedContent = content || lastContentRef.current;

  return (
    <Modal visible={isRendered} transparent animationType="none" onRequestClose={() => { if (dismissible) animateOut(true); }}>
      <View style={styles.achievementModalBackdrop}>
        <ConfettiOverlay styles={styles} active={showConfetti && isRendered} animationKey={animationKey} />
        {isRendered && (
          <Animated.View
            {...panResponder?.panHandlers}
            style={[
              styles.achievementModalCard,
              // 中身の高さに合わせてカードの高さを減速移動でアニメーションさせる。
              // 内側は absolute で自然な高さを測り、外側の高さだけをアニメーションする。
              { padding: 0, gap: 0, alignItems: 'stretch', overflow: 'hidden' },
              hasMeasuredRef.current ? { height: cardHeight } : null,
              {
                opacity: Animated.multiply(modalProgress, distanceOpacity),
                transform: [
                  { scale: modalProgress.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0.62, 1.08, 1] }) },
                  { translateX: dragX },
                  { translateY: Animated.add(dragY, modalProgress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] })) },
                ],
              },
            ]}
          >
            <View onLayout={handleContentLayout} style={styles.dialogMeasuredContent}>
              {dismissible && (
                <Pressable onPress={() => animateOut(true)} hitSlop={10} style={styles.achievementCloseButton} accessibilityLabel="閉じる" accessibilityRole="button">
                  <MaterialCommunityIcons name="close" size={18} color={styles.achievementCloseButtonIcon.color} />
                </Pressable>
              )}
              {autoClose && !isAutoClosePaused && (
                <View style={styles.achievementAutoCloseTrack}>
                  <Animated.View
                    style={[
                      styles.achievementAutoCloseProgress,
                      { transform: [{ scaleX: autoCloseProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }] },
                    ]}
                  />
                </View>
              )}
              {displayedContent}
              {swipeToClose && dismissible && <Text style={styles.dialogSwipeHint}>スワイプで閉じる</Text>}
            </View>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}
