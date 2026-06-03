import { DailyLogSummary } from '../types/gps';

const JAPANESE_WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

export type DailyLogMonthGroup = {
  /** YYYY-MM形式の月キー。 */
  monthKey: string;
  /** 画面に表示する月見出し。 */
  label: string;
  /** 同じ月に属する日別ログ。 */
  logs: DailyLogSummary[];
};

/** YYYY-MM-DDを端末タイムゾーンに依存しないDateへ変換する。 */
function parseLocalDateKey(localDate: string): Date {
  const [year, month, day] = localDate.split('-').map((value) => Number.parseInt(value, 10));
  return new Date(year, month - 1, day);
}

/** 日別ログ一覧の月見出しを作る。 */
export function formatDailyLogMonthLabel(localDate: string): string {
  const date = parseLocalDateKey(localDate);
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

/** 日別ログ一覧の行タイトルを作る。 */
export function formatDailyLogListDateLabel(localDate: string): string {
  const date = parseLocalDateKey(localDate);
  return `${date.getMonth() + 1}月${date.getDate()}日（${JAPANESE_WEEKDAYS[date.getDay()]}）`;
}

/** 日別詳細ヘッダーの日付と年を分けて返す。 */
export function formatDailyLogDetailTitle(localDate: string): { title: string; subtitle: string } {
  const date = parseLocalDateKey(localDate);
  return {
    title: `${date.getMonth() + 1}月${date.getDate()}日`,
    subtitle: `${date.getFullYear()}年`,
  };
}

/** m単位の距離をkm表記へ変換する。 */
export function formatDistanceKm(distanceMeters: number | null | undefined): string {
  return `${((distanceMeters ?? 0) / 1000).toFixed(2)}km`;
}

/** 日別ログを月単位のセクションへまとめる。 */
export function groupDailyLogsByMonth(logs: DailyLogSummary[]): DailyLogMonthGroup[] {
  return logs.reduce<DailyLogMonthGroup[]>((groups, log) => {
    const monthKey = log.localDate.slice(0, 7);
    const currentGroup = groups.at(-1);

    if (currentGroup?.monthKey === monthKey) {
      currentGroup.logs.push(log);
      return groups;
    }

    groups.push({
      monthKey,
      label: formatDailyLogMonthLabel(log.localDate),
      logs: [log],
    });
    return groups;
  }, []);
}

/** 一覧で使う移動距離を、DBサマリー優先で返す。 */
export function resolveDailyLogDistance(log: DailyLogSummary): number {
  return log.distanceMeters ?? 0;
}

/** 一覧で使う開始・終了地点の概要文を作る。 */
export function formatRouteSummary(startAreaName = '--', endAreaName = '--'): string {
  return `開始地点: ${startAreaName}、終了地点: ${endAreaName}`;
}

/** 詳細で使う開始・終了地点の値を作る。 */
export function formatRouteEndpoints(startAreaName = '--', endAreaName = '--'): string {
  return `${startAreaName} ▶ ${endAreaName}`;
}
