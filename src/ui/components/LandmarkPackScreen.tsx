import { Feather } from '@expo/vector-icons';
import { SafeAreaView, ScrollView } from 'react-native';

import type { LandmarkPack, LandmarkSpot } from '@/features/landmarks/landmarkCatalog';
import { getLandmarkPrefectureLabel } from '@/features/landmarks/landmarkPrefectureLabel';
import type { AppTheme } from '@/theme/theme';
import type { AppStyles } from '@/ui/appStyles';
import { LANDMARK_SPOT_RETIRED_NOTE } from '@/ui/appText';
import type { LandmarkSpotListItem } from '@/ui/hooks/useLandmarkPackState';
import { AppListItem } from './AppListItem';
import { AppScreenHeader } from './AppScreenHeader';

/** パック詳細画面のprops。 */
export type LandmarkPackScreenProps = {
  /** 表示するパック定義。 */
  pack: LandmarkPack;
  /** パックに属するスポット行(order昇順)。 */
  spotItems: LandmarkSpotListItem[];
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 実績一覧へ戻る処理。 */
  onBack: () => void;
  /** 到達済みスポットの行を押したときの処理。引数は到達した日のローカル日付。 */
  onSelectVisitedSpot: (localDate: string) => void;
  /** 未到達スポットの行を押したときの処理。地図でスポットの位置を示す。 */
  onSelectUnvisitedSpot: (spot: LandmarkSpot) => void;
};

/**
 * スポットパックの到達状況を一覧するパック詳細画面。
 *
 * 到達済みの行はその日の記録へ、未到達の行は地図へ導く(設計書 §9.7)。
 * 「次はどこへ行こう」を考えられることがこの画面の役割なので、カードを重ねず
 * 帯状のリストで残りが読み取れる形にしている。
 */
export function LandmarkPackScreen({
  pack,
  spotItems,
  styles,
  theme,
  onBack,
  onSelectVisitedSpot,
  onSelectUnvisitedSpot,
}: LandmarkPackScreenProps) {
  // 完走判定と同じ数え方に揃えるため、retired なスポットは分母・分子から外す
  // (`resolveLandmarkPackProgress` が retired を除いた有効スポットだけを数えるのと同じ基準)。
  const activeSpotItems = spotItems.filter((item) => !item.spot.retired);
  const visitedCount = activeSpotItems.filter((item) => item.visitedLocalDate !== null).length;

  return (
    <SafeAreaView style={styles.appScreen}>
      <AppScreenHeader
        backLabel="実績"
        styles={styles}
        theme={theme}
        title={pack.name}
        subtitle={`${visitedCount}/${activeSpotItems.length}`}
        onBack={onBack}
      />

      <ScrollView contentContainerStyle={styles.screenList}>
        {spotItems.map(({ spot, visitedLocalDate }) => {
          const isVisited = visitedLocalDate !== null;

          return (
            <AppListItem
              key={spot.id}
              accessibilityLabel={isVisited ? `${spot.name}の記録を開く` : `${spot.name}を地図で見る`}
              detail={visitedLocalDate ? formatLandmarkVisitedDate(visitedLocalDate) : undefined}
              leading={
                <Feather
                  name={isVisited ? 'check' : 'circle'}
                  size={20}
                  color={isVisited ? theme.colors.primary : theme.colors.mutedText}
                />
              }
              styles={styles}
              subtitle={buildSpotSubtitle(spot)}
              theme={theme}
              title={spot.name}
              onPress={isVisited ? () => onSelectVisitedSpot(visitedLocalDate) : () => onSelectUnvisitedSpot(spot)}
            />
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

/**
 * 行のサブタイトルを組み立てる。
 *
 * 現存しなくなったスポットは都道府県に注記を併記し、到達できない理由が分かるようにする。
 */
function buildSpotSubtitle(spot: LandmarkSpot): string {
  const prefectureLabel = getLandmarkPrefectureLabel(spot.prefecture);

  return spot.retired ? `${prefectureLabel}・${LANDMARK_SPOT_RETIRED_NOTE}` : prefectureLabel;
}

/**
 * 到達日(YYYY-MM-DD)を画面表示用の YYYY/MM/DD へ整える。
 *
 * ローカル日付の文字列をそのまま置き換えるだけにして、Date を経由するタイムゾーンのズレを避ける。
 */
function formatLandmarkVisitedDate(visitedLocalDate: string): string {
  return visitedLocalDate.replaceAll('-', '/');
}
