import type { GridCell } from '../location/grid/gridCell';
import { coordinateToGridCell } from '../location/grid/gridCell';
import type { LocationPoint } from '../../types/gps';
import { toLocalDate } from '../../utils/date';

/** 日別詳細レポートに表示する解除済み実績。 */
export type DailyDetailAchievement = {
  /** 実績ID。 */
  id: string;
  /** 実績タイトル。 */
  title: string;
  /** 解除日時。 */
  unlockedAt: string;
};

/** 日別詳細レポートの集計入力。 */
export type DailyDetailReportInput = {
  /** 対象日。YYYY-MM-DD。 */
  localDate: string;
  /** 対象日のGPSポイント。 */
  points: LocationPoint[];
  /** 対象日のGPSポイントから導いたエリアの保存状態。 */
  visitedCells: Array<GridCell & { firstVisitedAt?: string | null }>;
  /** 対象日に解除された実績。 */
  unlockedAchievements: DailyDetailAchievement[];
};

/** Plus向け日別詳細レポート。 */
export type DailyDetailReport = {
  /** 対象日。YYYY-MM-DD。 */
  localDate: string;
  /** その日に訪問した重複なしエリア数。 */
  visitedAreaCount: number;
  /** その日に初めて訪問したエリア数。 */
  newAreaCount: number;
  /** 対象日のGPS点数。 */
  pointCount: number;
  /** その日に解除された実績。 */
  unlockedAchievements: DailyDetailAchievement[];
};

/** 1日のGPSポイントと保存済みエリア状態からPlus向け日別詳細レポートを作る。 */
export function createDailyDetailReport(input: DailyDetailReportInput): DailyDetailReport {
  const pointCellIds = new Set(input.points.map((point) => coordinateToGridCell(point).cellId));
  const newAreaCount = input.visitedCells.filter((cell) => {
    if (!pointCellIds.has(cell.cellId) || !cell.firstVisitedAt) {
      return false;
    }

    return toLocalDate(new Date(cell.firstVisitedAt)) === input.localDate;
  }).length;

  return {
    localDate: input.localDate,
    visitedAreaCount: pointCellIds.size,
    newAreaCount,
    pointCount: input.points.length,
    unlockedAchievements: input.unlockedAchievements,
  };
}
