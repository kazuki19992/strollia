import { Feather } from '@expo/vector-icons';
import { Image, Pressable, SafeAreaView, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Grayscale } from 'react-native-color-matrix-image-filters';

import { AchievementCategory, formatAchievementDistance } from '@/features/achievements/achievementDefinitions';
import { AchievementListItem } from '@/features/achievements/achievementRepository';
import { resolveLandmarkTrophyDisplayState } from '@/features/landmarks/landmarkTrophyDisplayState';
import { AppTheme } from '@/theme/theme';
import { AppStyles } from '@/ui/appStyles';
import { LANDMARK_PACK_PLUS_PROMOTION_NOTE, LANDMARK_PACK_SECTION_TITLE } from '@/ui/appText';
import type { LandmarkPackListItem } from '@/ui/hooks/useLandmarkPackState';
import { resolveAchievementDisplayStates } from './achievementDisplayState';
import { AppListItem } from './AppListItem';
import { AppProgressBar } from './AppProgressBar';
import { AppScreenHeader } from './AppScreenHeader';
import { DescriptionText } from './DescriptionText';
import { ScreenSection } from './ScreenSection';

/** 実績一覧画面のprops。 */
export type AchievementListScreenProps = {
  /** 実績定義と解除状態を合わせた一覧。 */
  items: AchievementListItem[];
  /** スポットパックの到達状況。表示順に並んでいることを前提とする。 */
  landmarkPackItems: LandmarkPackListItem[];
  /** Strollia Plusが有効かどうか。無効時はスポットセクションを施錠表示にする。 */
  isPlusActive: boolean;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 地図画面へ戻る処理。 */
  onBackToMap: () => void;
  /** 解除済み実績をタップしたときの処理。 */
  onSelectAchievement: (item: AchievementListItem) => void;
  /** スポットパック行をタップしたときの処理。 */
  onSelectLandmarkPack: (packId: string) => void;
  /** 施錠中のスポットパック行をタップしたときの処理(ペイウォール表示)。 */
  onRequestPremium: () => void;
};

/** 実績カテゴリの表示順と見出し。 */
const categorySections: { category: AchievementCategory; title: string }[] = [
  { category: 'distance', title: '総移動距離' },
  { category: 'logDays', title: 'ログ記録日数' },
  { category: 'prefecture', title: '都道府県' },
  { category: 'municipality', title: '市区町村' },
];

/** 実績画面を2列グリッドで描画する。 */
export function AchievementListScreen({
  items,
  landmarkPackItems,
  isPlusActive,
  styles,
  theme,
  onBackToMap,
  onSelectAchievement,
  onSelectLandmarkPack,
  onRequestPremium,
}: AchievementListScreenProps) {
  const displayStates = resolveAchievementDisplayStates(items);
  const { width: windowWidth } = useWindowDimensions();
  // Grayscale ネイティブフィルタは数値サイズが必要なため、画面幅からタイル画像サイズを算出する。
  // 余白は screenList.paddingHorizontal=24・achievementGrid.gap=10・3列に対応する。
  const tileWidth = (windowWidth - 24 * 2 - 10 * 2) / 3;
  const grayscaleImageSize = Math.max(0, Math.floor(tileWidth * 0.86));
  // スポットパックのトロフィーも Grayscale を通すため数値サイズが必要。
  // 一覧行のアイコンは設計書 §9.3.1 の 60〜80pt を目安にし、狭い端末では縮めて上限で止める。
  const packTrophySize = Math.min(72, Math.max(48, Math.floor((windowWidth - 24 * 2) * 0.2)));
  // 施錠中は先頭1件だけを見せる(設計書 §9.8)。表示するパックを固定して起動ごとのブレを避ける
  const visibleLandmarkPackItems = isPlusActive ? landmarkPackItems : landmarkPackItems.slice(0, 1);

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

        {visibleLandmarkPackItems.length > 0 ? (
          <ScreenSection styles={styles} title={LANDMARK_PACK_SECTION_TITLE}>
            {visibleLandmarkPackItems.map((item) => {
              // 施錠中は検知していないため、到達率を0として未到達と同じ見た目にする
              const ratio = item.isLocked || item.totalCount <= 0 ? 0 : item.visitedCount / item.totalCount;
              const trophyState = resolveLandmarkTrophyDisplayState(ratio);
              const trophyImage = <Image source={item.pack.trophyImage} style={{ width: packTrophySize, height: packTrophySize }} />;

              return (
                <AppListItem
                  key={item.pack.id}
                  accessibilityLabel={item.isLocked ? `${item.pack.name}はStrollia Plus限定です` : `${item.pack.name}の詳細を開く`}
                  footer={
                    item.isLocked ? undefined : (
                      <View style={styles.landmarkPackProgressRow}>
                        <Text style={styles.landmarkPackProgressText}>{`${item.visitedCount}/${item.totalCount}`}</Text>
                        <View style={styles.landmarkPackProgressBarArea}>
                          <AppProgressBar accessibilityLabel={`${item.pack.name}の進捗`} ratio={ratio} styles={styles} theme={theme} />
                        </View>
                      </View>
                    )
                  }
                  leading={
                    <View style={[styles.landmarkPackTrophy, { width: packTrophySize, height: packTrophySize }]}>
                      {trophyState === 'color' ? (
                        trophyImage
                      ) : (
                        <Grayscale style={trophyState === 'dim' ? styles.landmarkPackTrophyDim : undefined}>{trophyImage}</Grayscale>
                      )}
                      {item.isLocked ? (
                        <View style={styles.landmarkPackLockBadge}>
                          <Feather name="lock" size={14} color={theme.colors.mutedText} />
                        </View>
                      ) : null}
                    </View>
                  }
                  styles={styles}
                  subtitle={item.pack.description}
                  theme={theme}
                  title={item.pack.name}
                  onPress={item.isLocked ? onRequestPremium : () => onSelectLandmarkPack(item.pack.id)}
                />
              );
            })}

            {!isPlusActive ? <DescriptionText styles={styles}>{LANDMARK_PACK_PLUS_PROMOTION_NOTE}</DescriptionText> : null}
          </ScreenSection>
        ) : null}
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
    case 'landmarkPackCompletion':
      return `${item.progressValue} / ${threshold} スポット`;
  }
}
