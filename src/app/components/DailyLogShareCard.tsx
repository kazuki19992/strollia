import { forwardRef } from 'react';
import { View } from 'react-native';

import type { DailyDetailReport } from '../../features/reports/dailyReport';
import type { AppTheme } from '../../theme/theme';
import type { LocationPoint } from '../../types/gps';
import type { AppStyles } from '../appStyles';
import { DailyLogShareSections } from './DailyLogShareSections';
import { RouteMapPanel } from './RouteMapPanel';
import { ShareBranding } from './ShareBranding';

export type DailyLogShareCardProps = {
  /** カードの幅（px）。 */
  width: number;
  /** 地図に描くポイント。 */
  points: LocationPoint[];
  /** 地図の表示範囲の基準にするポイント。 */
  regionPoints: LocationPoint[];
  /** Plus課金状態。 */
  isPlusActive: boolean;
  /** 移動距離の表示ラベル。 */
  distanceLabel: string;
  /** 開始・終了地点の表示ラベル。 */
  routeEndpointsLabel: string;
  /** 日別詳細レポート。 */
  dailyDetailReport: DailyDetailReport | null;
  /** 詳細データ読み込み中か。 */
  isLoadingDetail: boolean;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 地図のタイル描画完了通知（キャプチャ前に待つ）。 */
  onMapLoaded: () => void;
};

/**
 * 共有画像をキャプチャするための、画面外にマウントする日別記録カード。
 * 画面上のスライダーや共有ボタンを含まないため、共有時にUIが消えることなくキャプチャできる。
 */
export const DailyLogShareCard = forwardRef<View, DailyLogShareCardProps>(function DailyLogShareCard(
  { width, points, regionPoints, isPlusActive, distanceLabel, routeEndpointsLabel, dailyDetailReport, isLoadingDetail, styles, theme, onMapLoaded },
  ref,
) {
  return (
    <View
      ref={ref}
      collapsable={false}
      style={[styles.dailyLogShareCardOffscreen, { width, backgroundColor: theme.colors.background }]}
    >
      <View style={[styles.dailyLogDetailCapture, { backgroundColor: theme.colors.background }]}>
        <View style={styles.routeTimeline}>
          <RouteMapPanel
            emptyLabel="移動地図を表示できません"
            points={points}
            regionPoints={regionPoints}
            styles={styles}
            theme={theme}
            onMapLoaded={onMapLoaded}
          />
        </View>
        <DailyLogShareSections
          isPlusActive={isPlusActive}
          distanceLabel={distanceLabel}
          routeEndpointsLabel={routeEndpointsLabel}
          dailyDetailReport={dailyDetailReport}
          isLoadingDetail={isLoadingDetail}
          styles={styles}
        />
      </View>
      <ShareBranding />
    </View>
  );
});
