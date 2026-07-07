import { Feather } from '@expo/vector-icons';
import { Image, Pressable, Text, View } from 'react-native';

import { AchievementDefinition } from '@/features/achievements/achievementDefinitions';
import { AppStyles } from '@/ui/appStyles';
import { Dialog } from './Dialog';

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

/** 実績解除時の紙吹雪付きモーダル。汎用 Dialog を解除通知向けに使う。 */
export function AchievementUnlockModal({ achievement, animationKey, styles, onShareToX, onClose }: AchievementUnlockModalProps) {
  return (
    <Dialog visible={achievement != null} showConfetti autoClose animationKey={animationKey} styles={styles} onClose={onClose}>
      {({ pauseAutoClose }) =>
        achievement && (
          <>
            <Text style={styles.achievementModalEyebrow}>実績解除</Text>
            <Image source={achievement.trophyImage} style={styles.achievementModalImage} />
            <Text style={styles.achievementModalTitle}>{achievement.title}を達成しました！</Text>
            <Text style={styles.achievementModalDescription}>{achievement.description}</Text>
            <View style={styles.achievementModalActions}>
              <Pressable
                onPress={() => {
                  pauseAutoClose();
                  onShareToX(achievement);
                }}
                style={styles.achievementPrimaryButton}
                accessibilityLabel="ともだちに自慢する"
                accessibilityRole="button"
              >
                <Feather name="share-2" size={18} color={styles.primaryButtonText.color} />
                <Text style={styles.primaryButtonText}>ともだちに自慢する</Text>
              </Pressable>
            </View>
          </>
        )
      }
    </Dialog>
  );
}
