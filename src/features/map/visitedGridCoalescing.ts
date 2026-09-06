import type { GridCellPolygonSource } from '@/features/location/grid/gridCell';

/**
 * 結合を試すブロック倍率。大きい順に試す。
 *
 * `8x8` 以上は初回実装では扱わない。市街地でも完全に埋まる確率が下がり、
 * 判定コストに対する削減効果が読みにくいため。
 */
export const VISITED_GRID_COALESCE_BLOCK_SIZES: readonly number[] = [4, 2];

/** Polygon結合の結果。 */
export type CoalescedVisitedGrid = {
  /** 結合済み、または結合できなかった既存セル。 */
  stableCells: GridCellPolygonSource[];
  /** 結合対象外の新規セル。 */
  freshCells: GridCellPolygonSource[];
  /** `4x4` などブロック倍率ごとの採用数。開発用の効果測定に使う。 */
  blockCountBySize: Record<string, number>;
};

/** ブロック原点の座標。単位は入力セルの番号。 */
type BlockOrigin = { x: number; y: number };

/**
 * Polygon結合へ渡すfresh集合を表示セルサイズから決める。
 *
 * 呼ぶたびに新しい `Set` を作らないよう、200m以上表示時はモジュールスコープの共有定数を返す
 * (Reactのメモ化フックの依存値として使う場合に参照安定性が必要なため)。
 */
const EMPTY_FRESH_CELL_IDS: ReadonlySet<string> = new Set();

/**
 * Polygon結合(`coalesceVisitedGridCells`)へ渡すfresh集合を表示セルサイズから決める。
 *
 * 結合自体は全ズーム段階(100m表示・200m以上の集約表示)で常に行うが、fresh除外の扱いだけ
 * 表示セルサイズで分ける。
 * - 100m表示(`displayCellSizeMeters === baseCellSizeMeters`): 渡された `freshCellIds` を
 *   そのまま返し、GPS記録で新しく開いたセルを結合対象から外す(個別セルとしてフェード表示するため)。
 * - 200m以上: 常に空集合を返す。200m以上の集約表示では「表示セル内に visited な100mセルが
 *   1つでもあれば表示セル全体を塗る」仕様のため、完全に揃ったブロックを結合しても塗り範囲は
 *   1ピクセルも変わらない。fresh はもともと100mセル単位でしか意味を持たない概念であり、
 *   集約表示では考慮する理由がない。
 *
 * @param freshCellIds - GPS記録で新しく開いた100m基本セルID。
 * @param displayCellSizeMeters - 現在の表示セルサイズ。
 * @param baseCellSizeMeters - 基本セルサイズ(100m)。
 * @returns 結合対象から除外するfresh集合。
 */
export function resolveCoalescingFreshCellIds(
  freshCellIds: ReadonlySet<string>,
  displayCellSizeMeters: number,
  baseCellSizeMeters: number,
): ReadonlySet<string> {
  if (displayCellSizeMeters === baseCellSizeMeters) {
    return freshCellIds;
  }

  return EMPTY_FRESH_CELL_IDS;
}

/**
 * 完全に埋まった正方形ブロックだけを1つの大きいPolygonへ結合する。
 *
 * 「大セル内に1つでもvisitedがあれば塗る」集約とは異なり、ブロック内の表示セルが
 * すべてvisitedの場合しか結合しないため、未訪問セルを塗らず表示意味を保てる。
 *
 * ブロックはグリッド整列(原点が倍率の倍数)のみを対象にする。整列ブロックは同一倍率
 * どうしで必ず互いに素になるため、貪欲でも結果が一意に決まり、スクロールしても
 * ブロック境界が動かずReact keyが安定する。探索もO(n)で済む。
 *
 * @param cells - 表示セル。表示セルサイズが混在していてもサイズごとに独立して処理する。
 * @param freshCellIds - 結合対象から除外する新規セルID。
 * @param blockSizes - 試すブロック倍率。大きい順に指定する。
 * @returns 結合結果と、倍率ごとの採用数。
 */
export function coalesceVisitedGridCells(
  cells: readonly GridCellPolygonSource[],
  freshCellIds: ReadonlySet<string>,
  blockSizes: readonly number[] = VISITED_GRID_COALESCE_BLOCK_SIZES,
): CoalescedVisitedGrid {
  const freshCells: GridCellPolygonSource[] = [];
  const stableCells: GridCellPolygonSource[] = [];
  const blockCountBySize: Record<string, number> = {};
  /** 表示セルサイズごとの未処理セル。キーは `${x}:${y}`。 */
  const remainingBySize = new Map<number, Map<string, GridCellPolygonSource>>();

  for (const cell of cells) {
    if (freshCellIds.has(cell.cellId)) {
      freshCells.push(cell);
      continue;
    }

    const remaining = remainingBySize.get(cell.cellSizeMeters) ?? new Map<string, GridCellPolygonSource>();
    remaining.set(`${cell.x}:${cell.y}`, cell);
    remainingBySize.set(cell.cellSizeMeters, remaining);
  }

  for (const [cellSizeMeters, remaining] of remainingBySize) {
    for (const blockSize of blockSizes) {
      if (blockSize < 2) {
        continue;
      }

      for (const origin of collectBlockOrigins(remaining, blockSize)) {
        const members = collectBlockMembers(remaining, origin, blockSize);

        if (!members) {
          continue;
        }

        for (const member of members) {
          remaining.delete(`${member.x}:${member.y}`);
        }

        stableCells.push(mergeBlock(members, cellSizeMeters, blockSize, origin));
        incrementBlockCount(blockCountBySize, blockSize);
      }
    }

    for (const cell of remaining.values()) {
      stableCells.push(cell);
      incrementBlockCount(blockCountBySize, 1);
    }
  }

  stableCells.sort((a, b) => a.cellSizeMeters - b.cellSizeMeters || a.y - b.y || a.x - b.x);

  return { stableCells, freshCells, blockCountBySize };
}

/**
 * 未処理セルから、重複を除いたブロック原点を列挙する。
 *
 * @param remaining - 未処理セル。
 * @param blockSize - ブロック倍率。
 * @returns ブロック原点(セル番号単位)。
 */
function collectBlockOrigins(remaining: Map<string, GridCellPolygonSource>, blockSize: number): BlockOrigin[] {
  const origins = new Map<string, BlockOrigin>();

  for (const cell of remaining.values()) {
    const x = Math.floor(cell.x / blockSize) * blockSize;
    const y = Math.floor(cell.y / blockSize) * blockSize;
    origins.set(`${x}:${y}`, { x, y });
  }

  return [...origins.values()];
}

/**
 * ブロックが完全に埋まっている場合だけ、その構成セルを返す。
 *
 * @param remaining - 未処理セル。
 * @param origin - ブロック原点。
 * @param blockSize - ブロック倍率。
 * @returns 構成セル。1つでも欠けていればnull。
 */
function collectBlockMembers(
  remaining: Map<string, GridCellPolygonSource>,
  origin: BlockOrigin,
  blockSize: number,
): GridCellPolygonSource[] | null {
  const members: GridCellPolygonSource[] = [];

  for (let y = origin.y; y < origin.y + blockSize; y += 1) {
    for (let x = origin.x; x < origin.x + blockSize; x += 1) {
      const member = remaining.get(`${x}:${y}`);

      if (!member) {
        return null;
      }

      members.push(member);
    }
  }

  return members;
}

/**
 * ブロック構成セルを1つの大きい表示セルへまとめる。
 *
 * 結合後セルは `cellToPolygonCoordinates` がそのまま矩形へ変換できる形
 * (`cellSizeMeters = 元サイズ × 倍率`、`x = 原点X / 倍率`)にする。
 *
 * @param members - ブロック構成セル。
 * @param cellSizeMeters - 元の表示セルサイズ。
 * @param blockSize - ブロック倍率。
 * @param origin - ブロック原点。
 * @returns 結合後の表示セル。
 */
function mergeBlock(
  members: GridCellPolygonSource[],
  cellSizeMeters: number,
  blockSize: number,
  origin: BlockOrigin,
): GridCellPolygonSource {
  const mergedSizeMeters = cellSizeMeters * blockSize;
  const x = origin.x / blockSize;
  const y = origin.y / blockSize;
  let firstVisitedAt: string | undefined;
  let lastVisitedAt: string | undefined;
  let visitCount = 0;

  for (const member of members) {
    if (member.firstVisitedAt && (!firstVisitedAt || member.firstVisitedAt < firstVisitedAt)) {
      firstVisitedAt = member.firstVisitedAt;
    }

    if (member.lastVisitedAt && (!lastVisitedAt || member.lastVisitedAt > lastVisitedAt)) {
      lastVisitedAt = member.lastVisitedAt;
    }

    visitCount += member.visitCount ?? 0;
  }

  return {
    cellId: `${mergedSizeMeters}:${x}:${y}`,
    cellSizeMeters: mergedSizeMeters,
    x,
    y,
    firstVisitedAt,
    lastVisitedAt,
    visitCount,
  };
}

/**
 * ブロック倍率ごとの採用数を1つ増やす。
 *
 * @param blockCountBySize - 集計先。
 * @param blockSize - ブロック倍率。
 * @returns なし。
 */
function incrementBlockCount(blockCountBySize: Record<string, number>, blockSize: number): void {
  const key = `${blockSize}x${blockSize}`;
  blockCountBySize[key] = (blockCountBySize[key] ?? 0) + 1;
}
