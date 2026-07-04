import { Text, View } from 'react-native';

import type { DailyDetailReport } from '../../features/reports/dailyReport';
import type { AppStyles } from '../appStyles';
import { AchievementScroller } from './AchievementScroller';
import { DataSummaryRow } from './DataSummaryRow';
import { DescriptionText } from './DescriptionText';
import { SectionTitle } from './SectionTitle';

export type DailyLogShareSectionsProps = {
  /** Plus課金状態。 */
  isPlusActive: boolean;
  /** 移動距離の表示ラベル。 */
  distanceLabel: string;
  /** 開始・終了地点の表示ラベル。 */
  routeEndpointsLabel: string;
  /** 日別詳細レポート（エリア数・実績）。 */
  dailyDetailReport: DailyDetailReport | null;
  /** 詳細データ読み込み中か。 */
  isLoadingDetail: boolean;
  /** 画面共通スタイル。 */
  styles: AppStyles;
};

/** 日別詳細・共有画像で共通の「移動のデータ」「おもいで」セクション。 */
export function DailyLogShareSections({
  isPlusActive,
  distanceLabel,
  routeEndpointsLabel,
  dailyDetailReport,
  isLoadingDetail,
  styles,
}: DailyLogShareSectionsProps) {
  return (
    <>
      <View style={styles.dailyLogDetailSection}>
        <SectionTitle styles={styles}>移動のデータ</SectionTitle>
        {!isPlusActive && (
          <DescriptionText styles={styles}>移動距離はGPSのブレにより本来の距離より多く記録される場合があります。</DescriptionText>
        )}
        <View style={styles.dataSummaryList}>
          <DataSummaryRow label="移動距離" value={distanceLabel} styles={styles} />
          <DataSummaryRow label="開始地点と終了地点" value={routeEndpointsLabel} styles={styles} />
          {isPlusActive && (
            <>
              {/* レポート未取得（読み込み中・失敗）の間は 0エリア と誤表示せずプレースホルダにする。 */}
              <DataSummaryRow
                label="訪問したエリア数"
                value={dailyDetailReport ? `${dailyDetailReport.visitedAreaCount}エリア` : '—'}
                styles={styles}
              />
              <DataSummaryRow
                label="新しく訪問したエリア数"
                value={dailyDetailReport ? `${dailyDetailReport.newAreaCount}エリア` : '—'}
                styles={styles}
              />
            </>
          )}
        </View>
        {isPlusActive && (
          <DescriptionText styles={styles}>移動距離はGPSのブレにより本来の距離より多く記録される場合があります。</DescriptionText>
        )}
      </View>

      {isPlusActive && (
        <View style={styles.dailyLogDetailSection}>
          <SectionTitle styles={styles}>おもいで</SectionTitle>
          {/* 読み込み中・取得失敗（report=null）を「実績なし」と誤表示しないよう状態を分ける。 */}
          {isLoadingDetail ? (
            <Text style={styles.dailyLogDetailSubTitle}>この日に獲得した実績を読み込み中</Text>
          ) : dailyDetailReport ? (
            <>
              <Text style={styles.dailyLogDetailSubTitle}>この日に獲得した実績</Text>
              <AchievementScroller achievements={dailyDetailReport.unlockedAchievements} styles={styles} />
            </>
          ) : (
            <Text style={styles.dailyLogDetailSubTitle}>実績を読み込めませんでした</Text>
          )}
        </View>
      )}
    </>
  );
}
