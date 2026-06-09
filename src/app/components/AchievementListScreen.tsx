import { Image, Pressable, SafeAreaView, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Grayscale } from 'react-native-color-matrix-image-filters';

import { AchievementCategory, formatAchievementDistance } from '../../features/achievements/achievementDefinitions';
import { AchievementListItem } from '../../features/achievements/achievementRepository';
import { AppTheme } from '../../theme/theme';
import { AppStyles } from '../appStyles';
import { resolveAchievementDisplayStates } from './achievementDisplayState';
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
  /** 解除済み実績をタップしたときの処理。 */
  onSelectAchievement: (item: AchievementListItem) => void;
};

/** 実績カテゴリの表示順と見出し。 */
const categorySections: { category: AchievementCategory; title: string }[] = [
  { category: 'distance', title: '総移動距離' },
  { category: 'logDays', title: 'ログ記録日数' },
  { category: 'prefecture', title: '都道府県' },
  { category: 'municipality', title: '市区町村' },
];

/** 実績画面を2列グリッドで描画する。 */
export function AchievementListScreen({ items, styles, theme, onBackToMap, onSelectAchievement }: AchievementListScreenProps) {
  const displayStates = resolveAchievementDisplayStates(items);
  const { width: windowWidth } = useWindowDimensions();
  // Grayscale ネイティブフィルタは数値サイズが必要なため、画面幅からタイル画像サイズを算出する。
  // 余白は screenList.paddingHorizontal=24・achievementGrid.gap=10・3列に対応する。
  const tileWidth = (windowWidth - 24 * 2 - 10 * 2) / 3;
  const grayscaleImageSize = Math.max(0, Math.floor(tileWidth * 0.86));

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
                  const state = displayStates.get(item.definition.id) ?? 'hidden';
                  const isUnlocked = state === 'unlocked';
                  const isHidden = state === 'hidden';
                  const title = isHidden ? '？？？' : item.definition.title;
                  const progress = isHidden ? '？？？' : getAchievementProgressLabel(item);

                  const image = (
                    <Image
                      source={item.definition.trophyImage}
                      style={[styles.achievementTileImage, state === 'next' && styles.achievementTileImageNext]}
                      {...(isHidden ? { tintColor: theme.colors.border } : {})}
                    />
                  );

                  const tile = (
                    <>
                      <View style={styles.achievementTileImageWrap}>
                        {state === 'next' ? (
                          <Grayscale style={styles.achievementTileImageNext}>
                            <Image source={item.definition.trophyImage} style={{ width: grayscaleImageSize, height: grayscaleImageSize }} />
                          </Grayscale>
                        ) : (
                          image
                        )}
                      </View>
                      <Text style={styles.achievementTileTitle}>{title}</Text>
                      <Text style={styles.achievementTileProgress}>{progress}</Text>
                    </>
                  );

                  if (isUnlocked) {
                    return (
                      <Pressable
                        key={item.definition.id}
                        style={styles.achievementGridTile}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.definition.title} の詳細を見る`}
                        onPress={() => onSelectAchievement(item)}
                      >
                        {tile}
                      </Pressable>
                    );
                  }

                  return (
                    <View key={item.definition.id} style={styles.achievementGridTile}>
                      {tile}
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
