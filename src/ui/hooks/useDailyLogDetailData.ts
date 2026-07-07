import { useEffect, useState } from 'react';

import { fetchDailyLogDetailData } from '@/features/logs/dailyLogDetailService';
import { DailyDetailReport } from '@/features/reports/dailyReport';
import type { DailyLogSummary, LocationPoint } from '@/types/gps';
import { formatRouteEndpoints } from '@/ui/dailyLogDisplay';
import { computeRouteMaxEndMinutes, getCurrentMinutesOfDay, getTodayLocalDate } from '@/ui/dailyRouteTimeline';

/** useDailyLogDetailData フックの戻り値。 */
export type DailyLogDetailDataState = {
  /** 対象日のGPSポイント一覧。 */
  dailyPoints: LocationPoint[];
  /** Plus向け日別詳細レポート。 */
  dailyDetailReport: DailyDetailReport | null;
  /** 出発・到着地点のエリア名ラベル。例: 「船橋市 ▶ 千代田区」。 */
  routeEndpointsLabel: string;
  /** データ読み込み中フラグ。 */
  isLoadingDetail: boolean;
  /** タイムラインスライダーの選択可能な最大時刻（分）。 */
  routeMaxMinutes: number;
  /** タイムラインスライダーの現在選択時刻（分）。 */
  routeEndMinutes: number;
  /** タイムラインスライダーの選択時刻を更新する関数。 */
  setRouteEndMinutes: (minutes: number) => void;
};

/**
 * 日別詳細画面に必要なデータを読み込んで返すフック。
 *
 * `log` が変わるたびにサービス層を通じてデータを再取得する。
 * キャンセル処理により、前のリクエストの結果が後から適用されるのを防ぐ。
 * 読み込みタイミング・再読み込み条件はリファクタ前の `DailyLogDetailScreen.loadDetail` と同一に保つ。
 *
 * @param log 表示対象の日別サマリー。
 * @returns 日別詳細画面で必要なデータと状態。
 */
export function useDailyLogDetailData(log: DailyLogSummary): DailyLogDetailDataState {
  const [dailyPoints, setDailyPoints] = useState<LocationPoint[]>([]);
  const [dailyDetailReport, setDailyDetailReport] = useState<DailyDetailReport | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(true);
  const [routeEndpointsLabel, setRouteEndpointsLabel] = useState(formatRouteEndpoints());
  const [routeMaxMinutes, setRouteMaxMinutes] = useState(() =>
    computeRouteMaxEndMinutes(log.localDate, getTodayLocalDate(), getCurrentMinutesOfDay()),
  );
  const [routeEndMinutes, setRouteEndMinutes] = useState(() =>
    computeRouteMaxEndMinutes(log.localDate, getTodayLocalDate(), getCurrentMinutesOfDay()),
  );

  useEffect(() => {
    let isCancelled = false;
    const maxMinutes = computeRouteMaxEndMinutes(log.localDate, getTodayLocalDate(), getCurrentMinutesOfDay());
    setRouteMaxMinutes(maxMinutes);
    setIsLoadingDetail(true);
    setRouteEndMinutes(maxMinutes);

    fetchDailyLogDetailData(log.localDate)
      .then(({ points, report, routeEndpointsLabel: endpointsLabel }) => {
        if (!isCancelled) {
          setDailyPoints(points);
          setDailyDetailReport(report);
          setRouteEndpointsLabel(endpointsLabel);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setDailyPoints([]);
          setDailyDetailReport(null);
          setRouteEndpointsLabel(formatRouteEndpoints());
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingDetail(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [log]);

  return {
    dailyPoints,
    dailyDetailReport,
    routeEndpointsLabel,
    isLoadingDetail,
    routeMaxMinutes,
    routeEndMinutes,
    setRouteEndMinutes,
  };
}
