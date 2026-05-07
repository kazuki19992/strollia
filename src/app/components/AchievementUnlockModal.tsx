import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal, PanResponder, Pressable, Text, View } from 'react-native';

import { AchievementDefinition } from '../../features/achievements/achievementDefinitions';
import { AppStyles } from '../appStyles';
import { ConfettiOverlay } from './ConfettiOverlay';

/** 自動で閉じるまでの待機時間。 */
const AUTO_CLOSE_DELAY_MS = 10_000;
/** スワイプ閉じとして扱う移動量。 */
const SWIPE_DISMISS_THRESHOLD = 70;

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
  const dragY = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);
  const [renderedAchievement, setRenderedAchievement] = useState<AchievementDefinition | null>(achievement);
  const visible = renderedAchievement != null;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 10 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderMove: (_, gestureState) => {
        dragY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dy) >= SWIPE_DISMISS_THRESHOLD) {
          closeWithAnimation();
          return;
        }

        Animated.spring(dragY, {
          toValue: 0,
          damping: 11,
          stiffness: 180,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, {
          toValue: 0,
          damping: 11,
          stiffness: 180,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  useEffect(() => {
    if (!achievement) {
      return;
    }

    isClosingRef.current = false;
    setRenderedAchievement(achievement);
    dragY.setValue(0);
    modalProgress.setValue(0);
    Animated.spring(modalProgress, {
      toValue: 1,
      damping: 9,
      mass: 0.72,
      stiffness: 190,
      useNativeDriver: true,
    }).start();
  }, [achievement, dragY, modalProgress]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const timerId = setTimeout(closeWithAnimation, AUTO_CLOSE_DELAY_MS);
    return () => clearTimeout(timerId);
  }, [visible, animationKey]);

  /** 退場アニメーション後に親へ閉じたことを通知する。 */
  function closeWithAnimation(): void {
    if (isClosingRef.current) {
      return;
    }

    isClosingRef.current = true;
    Animated.parallel([
      Animated.timing(modalProgress, {
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
      onClose();
    });
  }

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
                opacity: modalProgress,
                transform: [
                  {
                    scale: modalProgress.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0.62, 1.08, 1] }),
                  },
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
            <Text style={styles.achievementModalEyebrow}>実績解除</Text>
            <Image source={renderedAchievement.trophyImage} style={styles.achievementModalImage} />
            <Text style={styles.achievementModalTitle}>{renderedAchievement.title}を達成しました！</Text>
            <Text style={styles.achievementModalDescription}>{renderedAchievement.description}</Text>
            <View style={styles.achievementModalActions}>
              <Pressable onPress={() => onShareToX(renderedAchievement)} style={styles.achievementPrimaryButton}>
                <Text style={styles.primaryButtonText}>Xで自慢する</Text>
              </Pressable>
              <Pressable onPress={closeWithAnimation} style={styles.achievementSecondaryButton}>
                <Text style={styles.secondaryButtonText}>閉じる</Text>
              </Pressable>
            </View>
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}
