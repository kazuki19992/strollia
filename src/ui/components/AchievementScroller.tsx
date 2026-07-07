import { Image, ScrollView, Text, View } from 'react-native';

import type { DailyDetailAchievement } from '@/features/reports/dailyReport';
import type { AppStyles } from '@/ui/appStyles';

export type AchievementScrollerProps = {
  /** 横スクロールで表示する実績。 */
  achievements: DailyDetailAchievement[];
  /** 画面共通スタイル。 */
  styles: AppStyles;
};

/** 実績画像を横に並べる汎用スクローラー。 */
export function AchievementScroller({ achievements, styles }: AchievementScrollerProps) {
  if (achievements.length === 0) {
    return <Text style={styles.achievementScrollerEmpty}>この日に獲得した実績はありません。</Text>;
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achievementScroller}>
      {achievements.map((achievement) => (
        <View key={`${achievement.id}-${achievement.unlockedAt}`} style={styles.achievementScrollerItem}>
          {achievement.trophyImage ? (
            <Image
              accessibilityLabel={`${achievement.title}の実績画像`}
              accessibilityRole="image"
              source={achievement.trophyImage}
              style={styles.achievementScrollerImage}
              resizeMode="contain"
            />
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}
