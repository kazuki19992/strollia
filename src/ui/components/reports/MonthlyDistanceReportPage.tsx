import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { MonthlyReport } from '@/features/reports/monthlyReport';
import { reportStyles } from './reportStyles';
import { ReportFrame } from './ReportFrame';

const COUNT_UP_DURATION_MS = 1400;
const COUNT_UP_FRAME_MS = 32;

/** 月間総移動距離ページのprops。 */
export type MonthlyDistanceReportPageProps = {
  /** 月次レポート集計。 */
  report: MonthlyReport;
  /** ページ数。 */
  pageCount: number;
  /** 現在ページ番号。 */
  pageIndex: number;
  /** 共有処理。 */
  onShare: () => void;
};

/** 数値の桁幅が動かないよう空白埋めした距離文字列を作る。 */
export function formatOdometerKilometers(kilometers: number, width = 7): string {
  return kilometers.toFixed(2).padStart(width, ' ');
}

/** 距離に応じた次の節目kmを求める。 */
export function getNextDistanceMilestoneKilometers(kilometers: number): number {
  const milestones = [1, 5, 10, 25, 50, 100, 150, 200, 300, 500, 750, 1000, 2000, 3000, 5000];
  return milestones.find((milestone) => milestone > kilometers) ?? Math.ceil((kilometers + 1) / 1000) * 1000;
}

/** 月間総移動距離をカウントアップ付きで表示するレポートページ。 */
export function MonthlyDistanceReportPage({ report, pageCount, pageIndex, onShare }: MonthlyDistanceReportPageProps) {
  const targetKilometers = report.totalDistanceMeters / 1000;
  const [displayKilometers, setDisplayKilometers] = useState(0);
  const startedAtRef = useRef<number | null>(null);
  const nextMilestone = useMemo(() => getNextDistanceMilestoneKilometers(targetKilometers), [targetKilometers]);
  const previousMilestone = Math.max(0, nextMilestone === 1 ? 0 : nextMilestone - getMilestoneStep(nextMilestone));
  const progress = nextMilestone > previousMilestone ? (targetKilometers - previousMilestone) / (nextMilestone - previousMilestone) : 1;

  useEffect(() => {
    startedAtRef.current = null;
    setDisplayKilometers(0);

    const timer = setInterval(() => {
      const now = Date.now();
      startedAtRef.current ??= now;
      const elapsed = now - startedAtRef.current;
      const ratio = Math.min(elapsed / COUNT_UP_DURATION_MS, 1);
      const eased = 1 - Math.pow(1 - ratio, 3);
      setDisplayKilometers(targetKilometers * eased);

      if (ratio >= 1) {
        clearInterval(timer);
      }
    }, COUNT_UP_FRAME_MS);

    return () => clearInterval(timer);
  }, [targetKilometers]);

  return (
    <ReportFrame title="今月の総移動距離" label={report.label} pageCount={pageCount} pageIndex={pageIndex} onShare={onShare}>
      <View style={reportStyles.centerContent}>
        <Text style={reportStyles.distanceLead}>あなたは今月</Text>
        <View style={reportStyles.distanceRow}>
          <Text style={reportStyles.distanceNumber}>{formatOdometerKilometers(displayKilometers)}</Text>
          <Text style={reportStyles.distanceUnit}>km</Text>
        </View>
        <Text style={reportStyles.distanceVerdict}>移動しました!</Text>
        <Text style={reportStyles.distanceCaption}>次の節目まで、あと少しです。</Text>
        <View style={reportStyles.targetGauge}>
          <View style={reportStyles.targetGaugeLabels}>
            <Text style={reportStyles.targetGaugeText}>{previousMilestone}km</Text>
            <Text style={reportStyles.targetGaugeText}>{nextMilestone}km</Text>
          </View>
          <View style={reportStyles.targetGaugeBar}>
            <View style={[reportStyles.targetGaugeFill, { width: `${Math.max(0, Math.min(progress, 1)) * 100}%` }]} />
          </View>
          <Text style={reportStyles.targetHere}>現在地</Text>
        </View>
      </View>
    </ReportFrame>
  );
}

/** 節目ゲージの直前値を決めるための差分km。 */
function getMilestoneStep(milestone: number): number {
  if (milestone <= 10) return 5;
  if (milestone <= 50) return 25;
  if (milestone <= 200) return 50;
  if (milestone <= 1000) return 250;
  return 1000;
}
