import { Image, Modal, Pressable, Text, View } from 'react-native';

import { AchievementDefinition } from '../../features/achievements/achievementDefinitions';
import { AppStyles } from '../appStyles';
import { ConfettiOverlay } from './ConfettiOverlay';

/** 実績解除モーダルのprops。 */
export type AchievementUnlockModalProps = {
  /** 表示する実績。nullの場合は非表示。 */
  achievement: AchievementDefinition | null;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** X投稿画面を開く処理。 */
  onShareToX: (achievement: AchievementDefinition) => void;
  /** 閉じる処理。 */
  onClose: () => void;
};

/** 実績解除時の紙吹雪付きモーダル。 */
export function AchievementUnlockModal({ achievement, styles, onShareToX, onClose }: AchievementUnlockModalProps) {
  return (
    <Modal visible={achievement != null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.achievementModalBackdrop}>
        <ConfettiOverlay styles={styles} active={achievement != null} />
        {achievement && (
          <View style={styles.achievementModalCard}>
            <Text style={styles.achievementModalEyebrow}>実績解除</Text>
            <Image source={achievement.trophyImage} style={styles.achievementModalImage} />
            <Text style={styles.achievementModalTitle}>{achievement.title}を達成しました！</Text>
            <Text style={styles.achievementModalDescription}>{achievement.description}</Text>
            <View style={styles.achievementModalActions}>
              <Pressable onPress={() => onShareToX(achievement)} style={styles.achievementPrimaryButton}>
                <Text style={styles.primaryButtonText}>Xで自慢する</Text>
              </Pressable>
              <Pressable onPress={onClose} style={styles.achievementSecondaryButton}>
                <Text style={styles.secondaryButtonText}>閉じる</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}
