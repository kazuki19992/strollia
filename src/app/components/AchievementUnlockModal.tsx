import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal, Pressable, Text, View } from 'react-native';

import { AchievementDefinition } from '../../features/achievements/achievementDefinitions';
import { AppStyles } from '../appStyles';
import { ConfettiOverlay } from './ConfettiOverlay';

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
  const [renderedAchievement, setRenderedAchievement] = useState<AchievementDefinition | null>(achievement);
  const visible = renderedAchievement != null;

  useEffect(() => {
    if (!achievement) {
      return;
    }

    setRenderedAchievement(achievement);
    modalProgress.setValue(0);
    Animated.spring(modalProgress, {
      toValue: 1,
      damping: 9,
      mass: 0.72,
      stiffness: 190,
      useNativeDriver: true,
    }).start();
  }, [achievement, modalProgress]);

  /** 退場アニメーション後に親へ閉じたことを通知する。 */
  function closeWithAnimation(): void {
    Animated.timing(modalProgress, {
      toValue: 0,
      duration: 500,
      useNativeDriver: true,
    }).start(({ finished }) => {
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
            style={[
              styles.achievementModalCard,
              {
                opacity: modalProgress,
                transform: [
                  {
                    scale: modalProgress.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0.62, 1.08, 1] }),
                  },
                  {
                    translateY: modalProgress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }),
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
