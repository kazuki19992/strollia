import type { AnnualReportPayloadV1 } from '@/features/annualReport/annualReportTypes';

/** 年次レポートのストーリーを構成するページ識別子。 */
export type AnnualReportPageId =
  'opening' | 'activeDays' | 'distance' | 'yearMap' | 'monthly' | 'farthestDay' | 'firstVisits' | 'newAreas' | 'achievements' | 'summary';

/** 地図を描画するページ。共有時に滞在場所の非表示処理が必要になる。 */
const MAP_PAGE_IDS: ReadonlySet<AnnualReportPageId> = new Set(['yearMap', 'farthestDay', 'summary']);

/**
 * payloadの内容から表示するページを仕様の順序で決める。
 * 値が0(または無し)のページは見せても意味がないため除外する。
 */
export function resolveAnnualReportPages(payload: AnnualReportPayloadV1): AnnualReportPageId[] {
  const hasFirstVisits = payload.newPrefectures.length > 0 || payload.newMunicipalityCount > 0;
  const hasAchievementsOrSpots = payload.achievements.count > 0 || payload.spots.count > 0;

  const pages: [AnnualReportPageId, boolean][] = [
    ['opening', true],
    ['activeDays', true],
    ['distance', true],
    ['yearMap', true],
    ['monthly', true],
    ['farthestDay', payload.farthestDay !== null],
    ['firstVisits', hasFirstVisits],
    ['newAreas', payload.newCellCount > 0],
    ['achievements', hasAchievementsOrSpots],
    ['summary', true],
  ];

  return pages.filter(([, visible]) => visible).map(([id]) => id);
}

/** 地図ページかどうかを返す。 */
export function isMapPage(id: AnnualReportPageId): boolean {
  return MAP_PAGE_IDS.has(id);
}

/**
 * 月別距離の最多月・最少月(1始まり)を返す。
 * 開発用フラグで集計期間が年の途中で終わる場合、期間外の月の0を最少扱いしないよう
 * periodEndの月までを対象にする。同値なら早い月を採る。
 */
export function resolveMonthExtremes(monthlyDistanceMeters: number[], periodEnd: string): { maxMonth: number; minMonth: number } {
  const lastMonth = Math.min(Math.max(Number(periodEnd.slice(5, 7)) || 12, 1), monthlyDistanceMeters.length);
  let maxMonth = 1;
  let minMonth = 1;
  for (let month = 2; month <= lastMonth; month += 1) {
    const value = monthlyDistanceMeters[month - 1];
    if (value > monthlyDistanceMeters[maxMonth - 1]) maxMonth = month;
    if (value < monthlyDistanceMeters[minMonth - 1]) minMonth = month;
  }
  return { maxMonth, minMonth };
}
