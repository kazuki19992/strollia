import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Region } from 'react-native-maps';

import { aggregateVisitedCells, getStableDisplayCellSizeMeters } from '@/features/location/grid/gridAggregation';
import { getGridBoundsForRegion, GridBounds, GridCellPolygonSource, isGridBoundsContained } from '@/features/location/grid/gridCell';
import { getVisitedCellsInBounds } from '@/features/location/visitedCellRepository';
import { VisitedGridOverlayCell, getFogOpacity, toVisitedGridOverlayCells } from '@/features/map/gridOverlay';
import { GRID_OVERLAY_CONFIG } from '@/features/map/config/gridOverlayConfig';

/** visited cellフェードの持続時間。 */
const VISITED_GRID_FADE_DURATION_MS = 500;
/** visited cellフェード中の再描画間隔。 */
const VISITED_GRID_FADE_FRAME_MS = 50;

/** `useVisitedGridOverlay` フックの引数。 */
export type UseVisitedGridOverlayParams = {
  /**
   * 初期化完了フラグ。
   * false の間はグリッド取得を行わない。
   */
  isReady: boolean;
  /**
   * グリッド描画に使う地図表示範囲。
   * App.tsx の `visibleRegion ?? initialRegion` に相当する。
   */
  gridOverlayRegion: Region;
  /**
   * visited cellの塗り色に使うテーマのprimary色。
   * フェード込みの描画用セルを計算するために必要。
   */
  themePrimaryColor: string;
};

/** `useVisitedGridOverlay` が返す状態と操作の型。 */
export type UseVisitedGridOverlayResult = {
  /**
   * MapView Polygon 用に変換済みの visited cell 配列。
   * gridOverlayOpacity とフェード進捗を適用した最終描画データ。
   */
  visitedGridCells: VisitedGridOverlayCell[];
  /**
   * 現在の表示範囲に応じた fog opacity。
   * App.tsx 側でも参照するため公開する。
   */
  gridOverlayOpacity: number;
  /**
   * visitedGridRefreshVersion をインクリメントして DB 再取得をトリガーする。
   * refreshData / centerOnCoordinate / openMap から呼ぶ。
   */
  incrementVisitedGridRefreshVersion: () => void;
};

/**
 * 訪問グリッドオーバーレイの状態・取得・フェードアニメーションを束ねるカスタムフック。
 *
 * 3 state (visitedGridSourceCells / visitedGridRefreshVersion / visitedGridFadeFrame) と
 * 3 ref (visitedGridDisplayCellSizeRef / lastVisitedGridFetchRef / visitedGridFadeStartedAtRef)、
 * グリッド取得 effect・フェードフレーム effect、および syncVisitedGridFadeState /
 * getVisitedGridFadeProgress の2内部関数を App.tsx から切り出した。
 * ユーザー向け挙動は App.tsx のそれと完全に同一に保つ。
 */
export function useVisitedGridOverlay({
  isReady,
  gridOverlayRegion,
  themePrimaryColor,
}: UseVisitedGridOverlayParams): UseVisitedGridOverlayResult {
  /** DBから取得して表示セルサイズへ集約したvisited cell。表示用フェードとは分けて保持する。 */
  const [visitedGridSourceCells, setVisitedGridSourceCells] = useState<GridCellPolygonSource[]>([]);
  const [visitedGridRefreshVersion, setVisitedGridRefreshVersion] = useState(0);
  /** 新規visited cellの0.5秒フェードを進めるため、50ms間隔で表示セルを再計算する。 */
  const [visitedGridFadeFrame, setVisitedGridFadeFrame] = useState(0);
  const visitedGridDisplayCellSizeRef = useRef<number | null>(null);
  /** 直近にvisited cellを取得したときの範囲・表示セルサイズ・データ版。取得済み範囲内の小移動では再取得を省く。 */
  const lastVisitedGridFetchRef = useRef<{ bounds: GridBounds; cellSizeMeters: number; version: number } | null>(null);
  const visitedGridFadeStartedAtRef = useRef(new Map<string, number>());

  /**
   * visited cellの初回描画時刻を同期し、表示から外れたセルのフェード状態を掃除する。
   *
   * @param cells - 次に描画するvisited cell。
   */
  function syncVisitedGridFadeState(cells: GridCellPolygonSource[]): void {
    const now = Date.now();
    const nextCellIds = new Set(cells.map((cell) => cell.cellId));

    for (const cell of cells) {
      if (!visitedGridFadeStartedAtRef.current.has(cell.cellId)) {
        visitedGridFadeStartedAtRef.current.set(cell.cellId, now);
      }
    }

    for (const cellId of visitedGridFadeStartedAtRef.current.keys()) {
      if (!nextCellIds.has(cellId)) {
        visitedGridFadeStartedAtRef.current.delete(cellId);
      }
    }

    setVisitedGridFadeFrame((frame) => frame + 1);
  }

  /**
   * 新規visited cellのフェード進捗を返す。
   *
   * @param cellId - 表示セルID。
   * @param now - 現在時刻。単位はms。
   * @returns 0から1のフェード進捗。
   */
  function getVisitedGridFadeProgress(cellId: string, now: number): number {
    const startedAt = visitedGridFadeStartedAtRef.current.get(cellId);

    if (!startedAt) {
      return 1;
    }

    return Math.min(1, Math.max(0, (now - startedAt) / VISITED_GRID_FADE_DURATION_MS));
  }

  /** visitedGridRefreshVersion をインクリメントして DB 再取得をトリガーする。 */
  const incrementVisitedGridRefreshVersion = useCallback((): void => {
    setVisitedGridRefreshVersion((version) => version + 1);
  }, []);

  /**
   * 表示範囲に含まれるvisited cellを読み込み、現在のズームに合う表示セルへ集約する。
   */
  useEffect(() => {
    if (!isReady) {
      return;
    }

    const bounds = getGridBoundsForRegion(gridOverlayRegion, { paddingRatio: GRID_OVERLAY_CONFIG.boundsPaddingRatio });
    const displayCellSizeMeters = getStableDisplayCellSizeMeters(
      gridOverlayRegion,
      visitedGridDisplayCellSizeRef.current,
      GRID_OVERLAY_CONFIG,
    );
    visitedGridDisplayCellSizeRef.current = displayCellSizeMeters;

    // ジェスチャー中（特にAndroidの onRegionChange）に同じ範囲・表示セルサイズで
    // SQLite取得を連発しないよう、取得済み範囲内かつデータ未更新なら再取得を省く。
    const lastFetch = lastVisitedGridFetchRef.current;
    const coveredByLastFetch =
      lastFetch != null &&
      lastFetch.version === visitedGridRefreshVersion &&
      lastFetch.cellSizeMeters === displayCellSizeMeters &&
      isGridBoundsContained(lastFetch.bounds, bounds);

    if (coveredByLastFetch) {
      return;
    }

    let isCancelled = false;

    getVisitedCellsInBounds(bounds)
      .then((cells) => {
        if (isCancelled) {
          return;
        }

        lastVisitedGridFetchRef.current = { bounds, cellSizeMeters: displayCellSizeMeters, version: visitedGridRefreshVersion };
        const aggregatedCells = aggregateVisitedCells(cells, displayCellSizeMeters);
        syncVisitedGridFadeState(aggregatedCells);
        setVisitedGridSourceCells(aggregatedCells);
      })
      .catch((error: unknown) => {
        console.warn('Failed to refresh visited grid cells:', error);
      });

    return () => {
      isCancelled = true;
    };
  }, [gridOverlayRegion, isReady, visitedGridRefreshVersion]);

  /**
   * 新規visited cellのフェード中だけ短い間隔で再描画する。
   */
  useEffect(() => {
    const now = Date.now();
    const hasActiveFade = visitedGridSourceCells.some((cell) => getVisitedGridFadeProgress(cell.cellId, now) < 1);

    if (!hasActiveFade) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setVisitedGridFadeFrame((frame) => frame + 1);
    }, VISITED_GRID_FADE_FRAME_MS);

    return () => clearTimeout(timeoutId);
  }, [visitedGridFadeFrame, visitedGridSourceCells]);

  const gridOverlayOpacity = useMemo(() => getFogOpacity(gridOverlayRegion, GRID_OVERLAY_CONFIG), [gridOverlayRegion]);

  /** 集約済みvisited cellに現在のopacityとフェード進捗を適用したMapView Polygon用データ。 */
  const visitedGridCells = useMemo<VisitedGridOverlayCell[]>(() => {
    // eslint-disable-next-line react-hooks/purity -- フェード進捗は visitedGridFadeFrame の更新を契機に現在時刻で再計算する既存仕様
    const now = Date.now();

    return toVisitedGridOverlayCells(visitedGridSourceCells, gridOverlayOpacity, themePrimaryColor, GRID_OVERLAY_CONFIG, (cell) =>
      getVisitedGridFadeProgress(cell.cellId, now),
    );
    // visitedGridFadeFrame はフェード中の再計算を強制するための意図的な依存(値自体は未使用)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 既存挙動維持のため依存配列を変更しない
  }, [gridOverlayOpacity, themePrimaryColor, visitedGridFadeFrame, visitedGridSourceCells]);

  return {
    visitedGridCells,
    gridOverlayOpacity,
    incrementVisitedGridRefreshVersion,
  };
}
