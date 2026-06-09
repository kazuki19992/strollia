import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Animated, Modal, PanResponder, Pressable, View } from 'react-native';

import { AppTheme } from '../../theme/theme';
import { AppStyles } from '../appStyles';
import { shouldDismissAchievementModalSwipe, shouldDismissAchievementModalTerminate } from './achievementUnlockModalLogic';
import { ConfettiOverlay } from './ConfettiOverlay';

/** 自動で閉じるまでの待機時間。 */
const AUTO_CLOSE_DELAY_MS = 10_000;

/** render-prop の子へ渡す補助関数。 */
export type DialogChildHelpers = {
  /** 自動クローズを止める（共有シートを開く前などに使う）。 */
  pauseAutoClose: () => void;
};

/** 汎用ダイアログのprops。 */
export type DialogProps = {
  /** 表示状態。 */
  visible: boolean;
  /** 本文。関数を渡すと pauseAutoClose を受け取れる。 */
  children: ReactNode | ((helpers: DialogChildHelpers) => ReactNode);
  /** 紙吹雪を背景に表示するか。 */
  showConfetti?: boolean;
  /** 一定時間で自動的に閉じるか。 */
  autoClose?: boolean;
  /** 紙吹雪の再生キー。 */
  animationKey?: string | null;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 閉じる処理。 */
  onClose: () => void;
};

/** スワイプ/紙吹雪/自動クローズを備えた汎用ダイアログ。 */
export function Dialog({ visible, children, showConfetti = false, autoClose = false, animationKey = null, styles, theme, onClose }: DialogProps) {
  void theme;
  const modalProgress = useRef(new Animated.Value(0)).current;
  const autoCloseProgress = useRef(new Animated.Value(0)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);
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
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4,
        onPanResponderGrant: () => {
          dragX.stopAnimation();
          dragY.stopAnimation();
        },
        onPanResponderMove: (_, gestureState) => {
          dragX.setValue(gestureState.dx);
          dragY.setValue(gestureState.dy);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (shouldDismissAchievementModalSwipe(gestureState)) {
            animateOut(true);
            return;
          }
          resetDragPosition();
        },
        onPanResponderTerminate: (_, gestureState) => {
          if (shouldDismissAchievementModalTerminate(gestureState)) {
            animateOut(true);
            return;
          }
          resetDragPosition();
        },
      }),
    [animateOut, dragX, dragY, resetDragPosition],
  );

  const distanceOpacity = Animated.add(dragX, dragY).interpolate({
    inputRange: [-260, -90, 0, 90, 260],
    outputRange: [0.35, 0.68, 1, 0.68, 0.35],
    extrapolate: 'clamp',
  });

  const content = typeof children === 'function' ? children({ pauseAutoClose }) : children;

  return (
    <Modal visible={isRendered} transparent animationType="none" onRequestClose={() => animateOut(true)}>
      <View style={styles.achievementModalBackdrop}>
        <ConfettiOverlay styles={styles} active={showConfetti && isRendered} animationKey={animationKey} />
        {isRendered && (
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.achievementModalCard,
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
            <Pressable onPress={() => animateOut(true)} hitSlop={10} style={styles.achievementCloseButton} accessibilityLabel="閉じる" accessibilityRole="button">
              <MaterialCommunityIcons name="close" size={18} color={styles.achievementCloseButtonIcon.color} />
            </Pressable>
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
            {content}
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}
