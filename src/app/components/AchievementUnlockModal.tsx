import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Animated, Image, Modal, PanResponder, Pressable, Text, View } from 'react-native';

import { AchievementDefinition } from '../../features/achievements/achievementDefinitions';
import { AppStyles } from '../appStyles';
import { shouldDismissAchievementModalSwipe, shouldDismissAchievementModalTerminate } from './achievementUnlockModalLogic';
import { ConfettiOverlay } from './ConfettiOverlay';

/** 自動で閉じるまでの待機時間。 */
const AUTO_CLOSE_DELAY_MS = 10_000;

/** 実績解除モーダルのprops。 */
export type AchievementUnlockModalProps = {
  /** 表示する実績。nullの場合は非表示。 */
  achievement: AchievementDefinition | null;
  /** 紙吹雪を表示ごとに再生するためのキー。 */
  animationKey: string | null;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** X投稿画面を開く処理。 */
  onShareToX: (achievement: AchievementDefinition) => void;
  /** 閉じる処理。 */
  onClose: () => void;
};

/** 実績解除時の紙吹雪付きモーダル。 */
export function AchievementUnlockModal({ achievement, animationKey, styles, onShareToX, onClose }: AchievementUnlockModalProps) {
  const modalProgress = useRef(new Animated.Value(0)).current;
  const autoCloseProgress = useRef(new Animated.Value(0)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);
  const autoCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCloseRef = useRef(onClose);
  const onShareToXRef = useRef(onShareToX);
  const [isAutoClosePaused, setIsAutoClosePaused] = useState(false);
  const [renderedAchievement, setRenderedAchievement] = useState<AchievementDefinition | null>(achievement);
  const visible = renderedAchievement != null;

  useEffect(() => {
    onCloseRef.current = onClose;
    onShareToXRef.current = onShareToX;
  }, [onClose, onShareToX]);

  useEffect(() => {
    if (!achievement) {
      return;
    }

    isClosingRef.current = false;
    setIsAutoClosePaused(false);
    setRenderedAchievement(achievement);
    dragX.setValue(0);
    dragY.setValue(0);
    modalProgress.setValue(0);
    autoCloseProgress.setValue(0);
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    Animated.spring(modalProgress, {
      toValue: 1,
      damping: 9,
      mass: 0.72,
      stiffness: 190,
      useNativeDriver: true,
    }).start();
    Animated.timing(autoCloseProgress, {
      toValue: 1,
      duration: AUTO_CLOSE_DELAY_MS,
      useNativeDriver: false,
    }).start();
  }, [achievement, autoCloseProgress, dragX, dragY, modalProgress]);

  /** 共有シートを開く前に自動クローズを止める。 */
  function shareAndPauseAutoClose(): void {
    setIsAutoClosePaused(true);
    autoCloseProgress.stopAnimation();
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }

    if (renderedAchievement) {
      onShareToXRef.current(renderedAchievement);
    }
  }

  /** スワイプが閉じる条件に満たない場合に中央へ戻す。 */
  const resetDragPosition = useCallback(function resetDragPosition(): void {
    Animated.spring(dragX, {
      toValue: 0,
      damping: 12,
      stiffness: 210,
      useNativeDriver: true,
    }).start();
    Animated.spring(dragY, {
      toValue: 0,
      damping: 12,
      stiffness: 210,
      useNativeDriver: true,
    }).start();
  }, [dragX, dragY]);

  /** 退場アニメーション後に親へ閉じたことを通知する。 */
  const closeWithAnimation = useCallback(function closeWithAnimation(): void {
    if (isClosingRef.current) {
      return;
    }

    isClosingRef.current = true;
    autoCloseProgress.stopAnimation();
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    onCloseRef.current();
    Animated.parallel([
      Animated.timing(modalProgress, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(dragX, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(dragY, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished) {
        return;
      }

      setRenderedAchievement(null);
    });
  }, [autoCloseProgress, dragX, dragY, modalProgress]);

  useEffect(() => {
    if (!visible || isAutoClosePaused) {
      return;
    }

    autoCloseTimerRef.current = setTimeout(closeWithAnimation, AUTO_CLOSE_DELAY_MS);

    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    };
  }, [visible, animationKey, isAutoClosePaused, closeWithAnimation]);

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
            closeWithAnimation();
            return;
          }

          resetDragPosition();
        },
        onPanResponderTerminate: (_, gestureState) => {
          if (shouldDismissAchievementModalTerminate(gestureState)) {
            closeWithAnimation();
            return;
          }

          resetDragPosition();
        },
      }),
    [closeWithAnimation, dragX, dragY, resetDragPosition],
  );

  const distanceOpacity = Animated.add(dragX, dragY).interpolate({
    inputRange: [-260, -90, 0, 90, 260],
    outputRange: [0.35, 0.68, 1, 0.68, 0.35],
    extrapolate: 'clamp',
  });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closeWithAnimation}>
      <View style={styles.achievementModalBackdrop}>
        <ConfettiOverlay styles={styles} active={visible} animationKey={animationKey} />
        {renderedAchievement && (
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.achievementModalCard,
              {
                opacity: Animated.multiply(modalProgress, distanceOpacity),
                transform: [
                  {
                    scale: modalProgress.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0.62, 1.08, 1] }),
                  },
                  { translateX: dragX },
                  {
                    translateY: Animated.add(
                      dragY,
                      modalProgress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }),
                    ),
                  },
                ],
              },
            ]}
          >
            <Pressable onPress={closeWithAnimation} hitSlop={10} style={styles.achievementCloseButton} accessibilityLabel="閉じる" accessibilityRole="button">
              <MaterialCommunityIcons name="close" size={18} color={styles.achievementCloseButtonIcon.color} />
            </Pressable>
            {!isAutoClosePaused && (
              <View style={styles.achievementAutoCloseTrack}>
                <Animated.View
                  style={[
                    styles.achievementAutoCloseProgress,
                    {
                      transform: [
                        {
                          scaleX: autoCloseProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                        },
                      ],
                    },
                  ]}
                />
              </View>
            )}
            <Text style={styles.achievementModalEyebrow}>実績解除</Text>
            <Image source={renderedAchievement.trophyImage} style={styles.achievementModalImage} />
            <Text style={styles.achievementModalTitle}>{renderedAchievement.title}を達成しました！</Text>
            <Text style={styles.achievementModalDescription}>{renderedAchievement.description}</Text>
            <View style={styles.achievementModalActions}>
              <Pressable onPress={shareAndPauseAutoClose} style={styles.achievementPrimaryButton}>
                <Feather name="share-2" size={18} color={styles.primaryButtonText.color} />
                <Text style={styles.primaryButtonText}>ともだちに自慢する</Text>
              </Pressable>
              <Text style={styles.achievementSwipeHint}>スワイプで閉じる</Text>
            </View>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}
