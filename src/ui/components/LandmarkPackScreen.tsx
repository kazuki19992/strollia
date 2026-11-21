import { useState } from 'react';
import { Image, SafeAreaView, ScrollView, Text, View } from 'react-native';

import type { LandmarkPack, LandmarkSpot } from '@/features/landmarks/landmarkCatalog';
import { formatLandmarkPrefectures } from '@/features/landmarks/landmarkPrefectureLabel';
import type { AppTheme } from '@/theme/theme';
import type { AppStyles } from '@/ui/appStyles';
import {
  formatLandmarkAreaProgressLabel,
  LANDMARK_AREA_COLLAPSE_LABEL_SUFFIX,
  LANDMARK_AREA_EXPAND_LABEL_SUFFIX,
  LANDMARK_COMPLETED_DATE_PREFIX,
  LANDMARK_FIRST_VISIT_DATE_PREFIX,
  LANDMARK_SPOT_COMPLETED_STAMP_LABEL,
  LANDMARK_SPOT_RETIRED_NOTE,
  MULTI_AREA_SPOT_BADGE_LABEL,
} from '@/ui/appText';
import type { LandmarkSpotListItem } from '@/ui/hooks/useLandmarkPackState';
import { useIsLandscapeLayout } from '@/ui/hooks/useIsLandscapeLayout';
import { AppListItem } from './AppListItem';
import { AppProgressBar } from './AppProgressBar';
import { AppScreenHeader } from './AppScreenHeader';
import { LabelBadge } from './LabelBadge';
import { LandmarkPackMapPreview, type LandmarkSpotFocusRequest } from './LandmarkPackMapPreview';
import { LandmarkSpotNumberBadge } from './LandmarkSpotNumberBadge';
import { animateListExpansion } from './listExpansionAnimation';
import { TwoPaneLayout } from './TwoPaneLayout';

/** 到達済みスポット行に表示するスタンプ画像。全スポット共通の1種類のみ用意している。 */
const LANDMARK_SPOT_VISITED_STAMP_SOURCE = require('../../../assets/achievements/spots/spots-visited-stamp.png');

/**
 * 複数地点スポットを全地点到達したときに、訪問済みスタンプの代わりに出すコンプリート記念スタンプ。
 * 日付やスポット名を持たない固定画像(円1つのスポットでは使わない)。
 */
const LANDMARK_SPOT_COMPLETED_STAMP_SOURCE = require('../../../assets/achievements/spots/spots-completed-stamp.png');

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
};

/**
 * スポットパックの到達状況を一覧するパック詳細画面。
 *
 * 到達済みの行はその日の記録へ導く。未到達の行は画面上部の埋め込み地図が
 * そのスポットへズームするだけで、メイン地図への画面遷移はしない
 * (この画面の中で「次はどこへ行こう」が完結する体験にする)。
 * 複数地点スポットの行は、押すと地点リストを開閉しつつ地図をスポット全体へズームする(日別記録は開いた地点の行から開く)。
 * カードを重ねず、帯状のリストで残りが読み取れる形にしている。
 */
export function LandmarkPackScreen({ pack, spotItems, styles, theme, onBack, onSelectVisitedSpot }: LandmarkPackScreenProps) {
  // 完走判定と同じ数え方に揃えるため、retired なスポットは分母・分子から外す
  // (`resolveLandmarkPackProgress` が retired を除いた有効スポットだけを数えるのと同じ基準)。
  const activeSpotItems = spotItems.filter((item) => !item.spot.retired);
  // 複数地点スポットは1地点でも到達していれば訪問済み(コンプリート=visitedLocalDate は求めない)
  const visitedCount = activeSpotItems.filter(
    (item) => item.visitedLocalDate !== null || item.areaItems.some((areaItem) => areaItem.visitedLocalDate !== null),
  ).length;
  /**
   * 埋め込み地図がズームして中心表示するリクエスト。未タップならnull(全スポットが収まる表示範囲)。
   *
   * spotIdだけを保持すると、同じ行を連続で押したときに値が変わらずReactが更新をスキップし、
   * ユーザーが地図を動かした後の再タップでズームし直せない。押すたびに変わるnonceを添えて
   * 「同じスポットへの再フォーカス要求」も新しい状態として確実に伝える。
   */
  const [focusRequest, setFocusRequest] = useState<LandmarkSpotFocusRequest>(null);
  /**
   * 地点リストを開いている複数地点スポットのID。初期は空(すべて閉じる)。
   *
   * 画面内だけのUI状態なので保存せず、AppStateProvider にも載せない。日別記録へ進んで戻っても
   * この画面は残るため開閉状態は保たれ、パック詳細を開き直すとすべて閉じた状態に戻る。
   */
  const [expandedSpotIds, setExpandedSpotIds] = useState<ReadonlySet<string>>(() => new Set());
  const isLandscape = useIsLandscapeLayout();

  /** 複数地点スポットの地点リストを開閉する。アニメーションは state 更新の直前に仕込む。 */
  const toggleSpotExpansion = (spotId: string) => {
    animateListExpansion();
    setExpandedSpotIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(spotId)) {
        next.add(spotId);
      }
      return next;
    });
  };

  const mapSection = (
    <View style={styles.landmarkPackMapSection}>
      <LandmarkPackMapPreview focusRequest={focusRequest} spotItems={spotItems} styles={styles} theme={theme} />
    </View>
  );

  /** 縦横どちらでも共通のスポット行(末尾に特記事項)。ScrollViewの外枠だけ向きごとに変える。 */
  const spotRows = (
    <>
      {spotItems.map(({ spot, visitedLocalDate, areaItems }, index) => {
        const isVisited = visitedLocalDate !== null;
        // 番号は spot.packs[].order の生値ではなく配列index(1始まり)を使う。
        // order に欠番があっても表示が1,2,3...と連番になるようにするため
        // (spotItems は既にorder昇順でソート済みなので、そのままindexを採番に使える)。
        const displayNumber = index + 1;
        // 複数地点スポットは「1地点以上到達=訪問済み、全地点到達=コンプリート」の2段階でスタンプを出す。
        // visitedLocalDate は全地点到達の日(=コンプリート)のときだけ非nullになる。
        const reachedAreaCount = areaItems.filter((areaItem) => areaItem.visitedLocalDate !== null).length;
        const isMultiArea = spot.isMultiArea;
        const showVisitedStamp = isMultiArea ? reachedAreaCount > 0 && !isVisited : isVisited;
        const isExpanded = expandedSpotIds.has(spot.id);
        // 複数地点スポットの行の日付は「全地点そろった日」なので、地点行の初訪問日と見出しを分ける。
        // 到達地点数は detail ではなく footer の進捗バーの横に出す。
        const detail = isVisited
          ? `${isMultiArea ? LANDMARK_COMPLETED_DATE_PREFIX : LANDMARK_FIRST_VISIT_DATE_PREFIX}${formatLandmarkVisitedDate(visitedLocalDate)}`
          : undefined;
        const onPressSpot = isMultiArea
          ? () => {
              // 開閉と同時に、開くときも閉じるときも地図をスポット全体へズームする(行タップで毎回同じことが起きるように)
              toggleSpotExpansion(spot.id);
              setFocusRequest((prev) => ({ targetId: spot.id, nonce: (prev?.nonce ?? 0) + 1 }));
            }
          : isVisited
            ? () => onSelectVisitedSpot(visitedLocalDate)
            : () => setFocusRequest((prev) => ({ targetId: spot.id, nonce: (prev?.nonce ?? 0) + 1 }));

        return (
          <View key={spot.id}>
            <AppListItem
              accessibilityLabel={
                isMultiArea
                  ? `${spot.name}${isExpanded ? LANDMARK_AREA_COLLAPSE_LABEL_SUFFIX : LANDMARK_AREA_EXPAND_LABEL_SUFFIX}${formatLandmarkAreaProgressLabel(reachedAreaCount, areaItems.length)}`
                  : isVisited
                    ? `${spot.name}の記録を開く`
                    : `${spot.name}を地図で見る`
              }
              detail={detail}
              expanded={isMultiArea ? isExpanded : undefined}
              footer={
                isMultiArea ? (
                  <View style={styles.landmarkPackProgressRow}>
                    <Text style={styles.landmarkPackProgressText}>{`${reachedAreaCount}/${areaItems.length}`}</Text>
                    <View style={styles.landmarkPackProgressBarArea}>
                      <AppProgressBar
                        accessibilityLabel={`${spot.name}の進捗`}
                        ratio={areaItems.length > 0 ? reachedAreaCount / areaItems.length : 0}
                        styles={styles}
                        theme={theme}
                      />
                    </View>
                  </View>
                ) : undefined
              }
              // 番号バッジはパック進捗と同じ「訪問」基準で塗る。複数地点スポットは1地点でも到達していれば訪問済み
              // (コンプリートはスタンプと「コンプリート日」で区別する。色はプライマリカラー1色のため段階を分けない)
              leading={
                <LandmarkSpotNumberBadge
                  isVisited={isVisited || reachedAreaCount > 0}
                  number={displayNumber}
                  styles={styles}
                  theme={theme}
                />
              }
              showChevron={isVisited}
              styles={styles}
              subtitle={buildSpotSubtitle(spot)}
              theme={theme}
              title={spot.name}
              titleAccessory={isMultiArea ? <LabelBadge label={MULTI_AREA_SPOT_BADGE_LABEL} styles={styles} /> : undefined}
              trailing={
                isMultiArea && isVisited ? (
                  <Image
                    accessibilityLabel={LANDMARK_SPOT_COMPLETED_STAMP_LABEL}
                    source={LANDMARK_SPOT_COMPLETED_STAMP_SOURCE}
                    style={styles.landmarkSpotVisitedStamp}
                  />
                ) : showVisitedStamp ? (
                  <Image
                    accessibilityLabel="訪問済み"
                    source={LANDMARK_SPOT_VISITED_STAMP_SOURCE}
                    style={styles.landmarkSpotVisitedStamp}
                  />
                ) : undefined
              }
              onPress={onPressSpot}
            />
            {isExpanded &&
              areaItems.map(({ area, visitedLocalDate: areaVisitedDate }) => (
                <View key={area.id} style={styles.landmarkAreaRowIndent}>
                  <AppListItem
                    accessibilityLabel={areaVisitedDate ? `${area.name}の記録を開く` : `${area.name}を地図で見る`}
                    detail={
                      areaVisitedDate ? `${LANDMARK_FIRST_VISIT_DATE_PREFIX}${formatLandmarkVisitedDate(areaVisitedDate)}` : undefined
                    }
                    showChevron={areaVisitedDate !== null}
                    styles={styles}
                    theme={theme}
                    title={area.name}
                    onPress={
                      areaVisitedDate
                        ? () => onSelectVisitedSpot(areaVisitedDate)
                        : () => setFocusRequest((prev) => ({ targetId: area.id, nonce: (prev?.nonce ?? 0) + 1 }))
                    }
                  />
                </View>
              ))}
          </View>
        );
      })}
      {/* 特記事項はスポットを全部見たあとに読む補足なので、一覧の最後尾に小さく置く */}
      {pack.notice ? (
        <Text style={styles.landmarkPackNoticeText} testID="landmark-pack-notice">
          {pack.notice}
        </Text>
      ) : null}
    </>
  );

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

      {isLandscape ? (
        <TwoPaneLayout
          styles={styles}
          primary={<ScrollView contentContainerStyle={styles.screenList}>{spotRows}</ScrollView>}
          secondary={mapSection}
        />
      ) : (
        <View style={styles.landmarkPackScreenBody}>
          {mapSection}
          <ScrollView style={styles.landmarkPackListSection} contentContainerStyle={styles.screenList}>
            {spotRows}
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}

/**
 * 行のサブタイトルを組み立てる。
 *
 * 現存しなくなったスポットは都道府県に注記を併記し、到達できない理由が分かるようにする。
 */
function buildSpotSubtitle(spot: LandmarkSpot): string {
  const prefectureLabel = formatLandmarkPrefectures(spot.prefectures);

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
