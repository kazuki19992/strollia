import type { GridBounds, GridCell } from '@/features/location/grid/gridCell';

/**
 * 1回の検出でフェードを開始する上限。
 *
 * これを超える場合はGPS記録による新規セルではなく大量再表示とみなし、
 * 50ms間隔のフェード再計算が大量セルへ波及しないようフェードを行わない。
 * 結合除外(fresh扱い)自体は維持するため、開いた直後のセルが即座に結合されることはない。
 */
export const MAX_FADING_VISITED_CELL_COUNT = 64;

/** `detectFreshVisitedCells` の引数。 */
export type DetectFreshVisitedCellsParams = {
  /** 前回取得で得られた表示セルID。 */
  previousCellIds: ReadonlySet<string>;
  /** 前回取得に使った基本セル番号範囲。初回取得ならnull。 */
  previousBounds: GridBounds | null;
  /** 前回取得時の表示セルサイズ。単位はm。初回取得ならnull。 */
  previousDisplayCellSizeMeters: number | null;
  /** 今回取得した表示セル。 */
  nextCells: readonly GridCell[];
  /** 現在の表示セルサイズ。単位はm。 */
  displayCellSizeMeters: number;
  /** 保存に使う基本セルサイズ。単位はm。 */
  baseCellSizeMeters: number;
  /** フェードを開始する上限数。 */
  maxFadingCellCount: number;
};

/** `detectFreshVisitedCells` の結果。 */
export type DetectedFreshVisitedCells = {
  /** GPS記録で新しく開いたセルID。Polygon結合の対象から外す。 */
  freshCellIds: Set<string>;
  /** そのうちフェードを開始してよいセルID。大量検出時は空になる。 */
  fadingCellIds: Set<string>;
};

/**
 * GPS記録で新しく開いたセルを検出する。
 *
 * DBの行だけではスクロールで表示範囲に入った既存セルと区別できないため、
 * 「前回取得済み範囲に完全に含まれるのに前回は返らなかったセル」だけをfreshとする。
 * 判定が曖昧なセルはfreshにしない(=フェードせず即時表示する)側へ倒す。
 *
 * 集約表示(200m以上)では取得結果からどの100mセルが開いたのか特定できないため検出しない。
 * fresh は100m基本セルIDで持つため、ズーム操作だけで既存のfreshが失われることはない。
 *
 * 前回取得も100m表示だった場合に限って検出する。前回が集約表示だと前回IDが `200:x:y`、
 * 今回が `100:x:y` になり、範囲内の既存セルがすべて「前回なかったセル」に見えてしまう。
 * その状態で検出すると、ズームインしただけで大量のセルが結合除外され負荷が戻る。
 *
 * @param params - 前回状態と今回取得結果。
 * @returns fresh扱いにするセルIDと、フェード対象のセルID。
 */
export function detectFreshVisitedCells({
  previousCellIds,
  previousBounds,
  previousDisplayCellSizeMeters,
  nextCells,
  displayCellSizeMeters,
  baseCellSizeMeters,
  maxFadingCellCount,
}: DetectFreshVisitedCellsParams): DetectedFreshVisitedCells {
  const freshCellIds = new Set<string>();
  const isBaseSizeComparison = displayCellSizeMeters === baseCellSizeMeters && previousDisplayCellSizeMeters === baseCellSizeMeters;

  if (!previousBounds || !isBaseSizeComparison) {
    return { freshCellIds, fadingCellIds: new Set<string>() };
  }

  for (const cell of nextCells) {
    if (previousCellIds.has(cell.cellId)) {
      continue;
    }

    if (isInsideBounds(cell.x, cell.y, previousBounds)) {
      freshCellIds.add(cell.cellId);
    }
  }

  const fadingCellIds = freshCellIds.size > maxFadingCellCount ? new Set<string>() : new Set(freshCellIds);

  return { freshCellIds, fadingCellIds };
}

/**
 * 実表示範囲から外れたfreshセルを落とす。
 *
 * DB取得範囲には `boundsPaddingRatio` の先読み余白が乗るため、取得結果を根拠に
 * 画面外判定をすると余白の中に残ったセルがfreshのままになる。判定には余白なしの
 * 実表示範囲を使い、DB取得を省略したregion変更でも呼べるよう取得処理から独立させている。
 *
 * @param freshCellIds - 現在fresh扱いのセルID。
 * @param visibleBounds - 余白なしの実表示範囲(基本セル番号)。
 * @returns 画面内に残っているセルIDのみの集合。
 */
export function evictOffscreenFreshCellIds(freshCellIds: ReadonlySet<string>, visibleBounds: GridBounds): Set<string> {
  const retained = new Set<string>();

  for (const cellId of freshCellIds) {
    const coordinate = parseBaseCellId(cellId);

    if (coordinate && isInsideBounds(coordinate.x, coordinate.y, visibleBounds)) {
      retained.add(cellId);
    }
  }

  return retained;
}

/** セル番号が範囲内(境界含む)か返す。 */
function isInsideBounds(x: number, y: number, bounds: GridBounds): boolean {
  return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
}

/**
 * `${cellSizeMeters}:${x}:${y}` 形式のセルIDから座標を取り出す。
 *
 * @param cellId - 解析対象のセルID。
 * @returns セル番号。形式が不正な場合はnull(呼び出し側でfreshから落とす)。
 */
function parseBaseCellId(cellId: string): { x: number; y: number } | null {
  const parts = cellId.split(':');

  if (parts.length !== 3) {
    return null;
  }

  const x = Number(parts[1]);
  const y = Number(parts[2]);

  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return null;
  }

  return { x, y };
}
