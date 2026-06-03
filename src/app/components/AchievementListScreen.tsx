import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, SafeAreaView, ScrollView, Text, View } from 'react-native';

import { AchievementCategory, formatAchievementDistance } from '../../features/achievements/achievementDefinitions';
import { AchievementListItem } from '../../features/achievements/achievementRepository';
import { AppTheme } from '../../theme/theme';
import { AppStyles } from '../appStyles';
import { AppScreenHeader } from './AppScreenHeader';

/** 実績一覧画面のprops。 */
export type AchievementListScreenProps = {
  /** 実績定義と解除状態を合わせた一覧。 */
  items: AchievementListItem[];
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 地図画面へ戻る処理。 */
  onBackToMap: () => void;
};

/** 実績カテゴリの表示順と見出し。 */
const categorySections: { category: AchievementCategory; title: string }[] = [
  { category: 'distance', title: '総移動距離' },
  { category: 'logDays', title: 'ログ記録日数' },
  { category: 'prefecture', title: '都道府県' },
  { category: 'municipality', title: '市区町村' },
];

/** 実績画面を描画する。 */
export function AchievementListScreen({ items, styles, theme, onBackToMap }: AchievementListScreenProps) {
  return (
    <SafeAreaView style={styles.appScreen}>
      <AppScreenHeader backLabel="地図" styles={styles} theme={theme} title="実績" onBack={onBackToMap} />

      <ScrollView contentContainerStyle={styles.screenList}>
        {categorySections.map((section) => {
          const sectionItems = items.filter((item) => item.definition.category === section.category);

          return (
            <View key={section.category} style={styles.achievementSection}>
              <Text style={styles.screenSectionHeading}>{section.title}</Text>
              <View style={styles.achievementGrid}>
                {sectionItems.map((item) => {
                  const unlocked = item.unlockedAt != null;

                  return (
                    <View key={item.definition.id} style={[styles.achievementCard, !unlocked && styles.achievementCardLocked]}>
                      <View style={styles.achievementImageFrame}>
                        <Image source={item.definition.trophyImage} style={[styles.achievementImage, !unlocked && styles.achievementImageLocked]} />
                        {!unlocked && (
                          <View style={styles.achievementLockBadge}>
                            <MaterialCommunityIcons name="lock-outline" size={16} color={theme.colors.primaryText} />
                          </View>
                        )}
                      </View>
                      <Text style={styles.achievementTitle}>{item.definition.title}</Text>
                      <Text style={styles.achievementDescription}>{item.definition.description}</Text>
                      <Text style={styles.achievementProgress}>{getAchievementProgressLabel(item)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

/** 実績カードに表示する進捗文言を作る。 */
export function getAchievementProgressLabel(item: AchievementListItem): string {
  if (item.unlockedAt) {
    return `達成: ${new Date(item.unlockedAt).toLocaleDateString()}`;
  }

  const threshold = item.definition.condition.threshold;

  switch (item.definition.condition.type) {
    case 'totalDistanceMeters':
      return `${formatAchievementDistance(item.progressValue / 1000)} / ${formatAchievementDistance(threshold / 1000)}`;
    case 'logDays':
      return `${item.progressValue} / ${threshold} 日`;
    case 'prefectureCount':
      return `${item.progressValue} / ${threshold} 都道府県`;
    case 'municipalityCount':
      return `${item.progressValue} / ${threshold} 市区町村`;
  }
}
