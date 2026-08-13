import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Region } from 'react-native-maps';

import { getStableDisplayCellSizeMeters } from '@/features/location/grid/gridAggregation';
import { getGridBoundsForRegion, GridBounds, GridCellPolygonSource, isGridBoundsContained } from '@/features/location/grid/gridCell';
import { getVisitedCellsInBounds } from '@/features/location/visitedCellRepository';
import { VisitedGridOverlayCell, getFogOpacity, toVisitedGridOverlayCells } from '@/features/map/gridOverlay';
import { GRID_OVERLAY_CONFIG } from '@/features/map/config/gridOverlayConfig';
import { CoalescedVisitedGrid, coalesceVisitedGridCells } from '@/features/map/visitedGridCoalescing';
import { MAX_FADING_VISITED_CELL_COUNT, detectFreshVisitedCells, evictOffscreenFreshCellIds } from '@/features/map/visitedGridFreshCells';
import { logVisitedGridMetrics } from '@/features/map/visitedGridMetrics';

/** visited cellフェードの持続時間。 */
const VISITED_GRID_FADE_DURATION_MS = 500;
/** visited cellフェード中の再描画間隔。 */
const VISITED_GRID_FADE_FRAME_MS = 50;
/**
 * 100m表示以外でPolygon結合に渡す、常に空のfresh集合。
 *
 * 200m以上の集約表示では「表示セル内に visited な100mセルが1つでもあれば表示セル全体を塗る」
 * 仕様のため、表示セルは訪問の有無だけを表す。完全に揃った `2x2` / `4x4` を結合しても
 * 塗り範囲は変わらないため、fresh(今開いた100mセルを個別に見せる概念)を考慮する意味がない。
 * 「200m以上ではfreshを一切考慮しない」という設計判断をコード上に明示するために、
 * ローカル変数のリテラル `new Set()` ではなくこの専用定数を用意している。
 */
const EMPTY_FRESH_CELL_IDS: ReadonlySet<string> = new Set();

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

/** DBから取得して集約したvisited cellと、そのうちfresh扱いのセルID・表示セルサイズ。 */
type VisitedGridSource = {
  /** 表示セルサイズへ集約済みのvisited cell。 */
  cells: GridCellPolygonSource[];
  /**
   * GPS記録で新しく開いた100m基本セルID。表示セルサイズが変わっても意味が変わらないよう、
   * 常に100m基本セルIDで保持する(表示セルサイズに関わらずPolygon結合の対象から外す)。
   */
  freshCellIds: Set<string>;
  /** この取得時点での表示セルサイズ。100mのときだけPolygon結合を行う判定に使う。 */
  displayCellSizeMeters: number;
};

/** 直近のvisited cell取得状態。次回取得時のfresh判定・再取得要否の判定に使う。 */
type LastVisitedGridFetch = {
  /** DB取得に使った基本セル番号範囲(先読み余白あり)。 */
  bounds: GridBounds;
  /** 取得時の表示セルサイズ。 */
  cellSizeMeters: number;
  /** 取得時の visitedGridRefreshVersion。 */
  version: number;
  /** 取得できた表示セルID。次回取得のfresh判定に使う。 */
  cellIds: Set<string>;
};

/**
 * 訪問グリッドオーバーレイの状態・取得・フェードアニメーション・Polygon結合を束ねるカスタムフック。
 *
 * DB取得結果を「fresh cell(GPS記録で新しく開いたセル。フェード対象かつ結合除外)」と
 * 「stable cell(それ以外の既存セル。即時表示かつ結合対象)」へ分け、描画用メモを
 * stable側/fresh側で分割することでフェード中の再計算コストを新規セル分だけに抑える。
 * 詳細は `docs/superpowers/specs/2026-08-12-map-grid-render-optimization-design.md` §3.2・§3.4。
 */
export function useVisitedGridOverlay({
  isReady,
  gridOverlayRegion,
  themePrimaryColor,
}: UseVisitedGridOverlayParams): UseVisitedGridOverlayResult {
  const [visitedGridSource, setVisitedGridSource] = useState<VisitedGridSource>({
    cells: [],
    freshCellIds: new Set<string>(),
    displayCellSizeMeters: GRID_OVERLAY_CONFIG.baseCellSizeMeters,
  });
  const [visitedGridRefreshVersion, setVisitedGridRefreshVersion] = useState(0);
  /** 新規visited cellの0.5秒フェードを進めるため、50ms間隔でfresh側の表示セルを再計算する。 */
  const [visitedGridFadeFrame, setVisitedGridFadeFrame] = useState(0);
  const visitedGridDisplayCellSizeRef = useRef<number | null>(null);
  /** 直近にvisited cellを取得したときの範囲・表示セルサイズ・データ版・セルID。取得済み範囲内の小移動では再取得を省く。 */
  const lastVisitedGridFetchRef = useRef<LastVisitedGridFetch | null>(null);
  /**
   * `visitedGridSource.freshCellIds` の最新値を同期的に参照するためのref。
   * fetch effectとeviction effectはどちらも非同期完了後にstateを更新するため、
   * 再レンダーを待たずに最新のfresh集合を読み書きできるようにしている。
   */
  const visitedGridFreshCellIdsRef = useRef<Set<string>>(new Set<string>());
  const visitedGridFadeStartedAtRef = useRef(new Map<string, number>());
  /** 直近の取得・fresh判定/結合・描画変換にかかった時間。開発用の効果測定ログでのみ使う。 */
  const visitedGridTimingRef = useRef({
    fetchMs: 0,
    freshDetectionMs: 0,
    coalesceMs: 0,
    stableOverlayBuildMs: 0,
    freshOverlayBuildMs: 0,
  });

  /**
   * fadingCellIdsの初回フェード開始時刻を登録し、freshCellIdsから外れたセルのタイマーを掃除する。
   *
   * 登録対象はfadingCellIdsだけ(freshCellIds全体ではない)。64件超の大量検出時は
   * fadingCellIdsが空になるため、その場合はタイマー登録なしで即時表示になる。
   *
   * @param fadingCellIds - 今回新たにフェードを開始してよいセルID。
   * @param freshCellIds - 現在fresh扱いの全セルID。フェードタイマーの掃除対象を絞るために使う。
   */
  function syncVisitedGridFadeState(fadingCellIds: ReadonlySet<string>, freshCellIds: ReadonlySet<string>): void {
    // eslint-disable-next-line react-hooks/purity -- DB取得完了後の.then内からのみ呼ばれ、render中には実行されない
    const now = Date.now();

    for (const cellId of fadingCellIds) {
      if (!visitedGridFadeStartedAtRef.current.has(cellId)) {
        visitedGridFadeStartedAtRef.current.set(cellId, now);
      }
    }

    pruneVisitedGridFadeState(freshCellIds);
    setVisitedGridFadeFrame((frame) => frame + 1);
  }

  /**
   * freshCellIdsに含まれなくなったセルのフェードタイマーを削除する。
   *
   * 画面外判定でfreshから落ちたセルのタイマーが残り続けてMapが際限なく増えないようにする。
   *
   * @param freshCellIds - 現在fresh扱いの全セルID。
   */
  function pruneVisitedGridFadeState(freshCellIds: ReadonlySet<string>): void {
    for (const cellId of visitedGridFadeStartedAtRef.current.keys()) {
      if (!freshCellIds.has(cellId)) {
        visitedGridFadeStartedAtRef.current.delete(cellId);
      }
    }
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
   * 集約結果のうち、前回取得済み範囲に新しく現れたセルをfreshとして検出し、
   * フェードタイマーを開始する(fadingCellIdsのみ。上限超過時は即時表示)。
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

    // ジェスチャー中(特にAndroidの onRegionChange)に同じ範囲・表示セルサイズで
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
    // eslint-disable-next-line react-hooks/purity -- useEffect内(commit後)でのみ実行される取得開始時刻。render中には実行されない
    const fetchStartedAt = Date.now();

    getVisitedCellsInBounds(bounds, displayCellSizeMeters)
      .then((rows) => {
        if (isCancelled) {
          return;
        }

        const fetchedAt = Date.now();
        visitedGridTimingRef.current.fetchMs = fetchedAt - fetchStartedAt;

        // rows はDB取得時点(getVisitedCellsInBounds)で表示セルサイズへ集約済み(SQL側GROUP BY)のため、
        // ここでのJS側再集約は行わない。表示セル(200m以上)をさらに集約するとratioで座標が壊れる。
        const { freshCellIds: detectedFreshCellIds, fadingCellIds } = detectFreshVisitedCells({
          previousCellIds: lastFetch?.cellIds ?? new Set<string>(),
          previousBounds: lastFetch?.bounds ?? null,
          previousDisplayCellSizeMeters: lastFetch?.cellSizeMeters ?? null,
          nextCells: rows,
          displayCellSizeMeters,
          baseCellSizeMeters: GRID_OVERLAY_CONFIG.baseCellSizeMeters,
          maxFadingCellCount: MAX_FADING_VISITED_CELL_COUNT,
        });
        visitedGridTimingRef.current.freshDetectionMs = Date.now() - fetchedAt;

        lastVisitedGridFetchRef.current = {
          bounds,
          cellSizeMeters: displayCellSizeMeters,
          version: visitedGridRefreshVersion,
          cellIds: new Set(rows.map((cell) => cell.cellId)),
        };

        // 表示され続けているfreshセルを維持するため、前回のfresh集合とマージする。
        // 100m表示以外(isBaseSizeComparisonがfalse)ではdetectedFreshCellIdsが常に空になるため、
        // このマージだけで「広域表示中も既存のfreshを保持する」挙動になる。
        const mergedFreshCellIds = new Set([...visitedGridFreshCellIdsRef.current, ...detectedFreshCellIds]);
        visitedGridFreshCellIdsRef.current = mergedFreshCellIds;

        syncVisitedGridFadeState(fadingCellIds, mergedFreshCellIds);
        setVisitedGridSource({ cells: rows, freshCellIds: mergedFreshCellIds, displayCellSizeMeters });
      })
      .catch((error: unknown) => {
        console.warn('Failed to refresh visited grid cells:', error);
      });

    return () => {
      isCancelled = true;
    };
    // syncVisitedGridFadeState は ref 更新と setState 呼び出しだけの安定した関数のため依存に含めない。
    // 含めると毎レンダーで新しい関数参照になり、このeffectが不要に再実行されてしまう。
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 既存挙動維持のため依存配列を変更しない
  }, [gridOverlayRegion, isReady, visitedGridRefreshVersion]);

  /**
   * 画面外(余白なしの実表示範囲外)に出たfreshセルを落とす。
   *
   * DB取得範囲には先読み余白が乗るため、取得結果を根拠に判定すると余白の中に残ったセルが
   * freshのままになる。判定はDB取得effectから独立させ、取得を省略したregion変更でも実行する。
   */
  useEffect(() => {
    const visibleBounds = getGridBoundsForRegion(gridOverlayRegion);
    const retained = evictOffscreenFreshCellIds(visitedGridFreshCellIdsRef.current, visibleBounds);

    // evictOffscreenFreshCellIdsは既存集合から取り除くだけなので、件数が変わらなければ
    // 内容も変わっていない。無限ループを避けるため、実際に変化があったときだけ更新する。
    if (retained.size === visitedGridFreshCellIdsRef.current.size) {
      return;
    }

    visitedGridFreshCellIdsRef.current = retained;
    pruneVisitedGridFadeState(retained);
    setVisitedGridSource((previous) => ({ ...previous, freshCellIds: retained }));
  }, [gridOverlayRegion]);

  const gridOverlayOpacity = useMemo(() => getFogOpacity(gridOverlayRegion, GRID_OVERLAY_CONFIG), [gridOverlayRegion]);

  /**
   * fresh cellをPolygon結合対象から除いた上で、完全に埋まった正方形ブロックを結合する。
   *
   * 結合自体は全ズーム段階(100m表示・200m以上の集約表示)で常に行う(§3.3)。
   * fresh除外の扱いだけ表示セルサイズで分ける。
   * - 100m表示: `visitedGridSource.freshCellIds` を渡し、GPS記録で新しく開いたセルを
   *   結合対象から外す(従来どおり個別セルとしてフェード表示するため)。
   * - 200m以上: 常に `EMPTY_FRESH_CELL_IDS`(空集合)を渡す。集約表示では
   *   「表示セル内に visited な100mセルが1つでもあれば表示セル全体を塗る」仕様のため、
   *   完全に揃ったブロックを結合しても塗り範囲は1ピクセルも変わらない。fresh はもともと
   *   100mセル単位でしか意味を持たない概念であり、集約表示では考慮する理由がない。
   */
  const coalescedVisitedGrid = useMemo<CoalescedVisitedGrid>(() => {
    // eslint-disable-next-line react-hooks/purity -- 結合処理コストの開発用計測
    const startedAt = Date.now();
    const freshCellIdsForCoalescing =
      visitedGridSource.displayCellSizeMeters === GRID_OVERLAY_CONFIG.baseCellSizeMeters
        ? visitedGridSource.freshCellIds
        : EMPTY_FRESH_CELL_IDS;
    const result = coalesceVisitedGridCells(visitedGridSource.cells, freshCellIdsForCoalescing);
    // eslint-disable-next-line react-hooks/purity, react-hooks/refs -- 開発用の処理時間計測のみ。描画結果もReactの再レンダー判断も参照しない
    visitedGridTimingRef.current.coalesceMs = Date.now() - startedAt;

    return result;
  }, [visitedGridSource]);

  /**
   * stable cellの描画用データ。フェードに依存しないため、フェード中の再計算対象にならない。
   * フェード中も同じ配列・同じオブジェクトを使い回すことで、Polygon propsの値が変化せず
   * ネイティブへの更新が飛ばなくなる(今回の最適化の核心)。
   */
  const stableOverlayCells = useMemo<VisitedGridOverlayCell[]>(() => {
    // eslint-disable-next-line react-hooks/purity -- 開発用の処理時間計測
    const startedAt = Date.now();
    const overlayCells = toVisitedGridOverlayCells(
      coalescedVisitedGrid.stableCells,
      gridOverlayOpacity,
      themePrimaryColor,
      GRID_OVERLAY_CONFIG,
    );
    // eslint-disable-next-line react-hooks/purity, react-hooks/refs -- 開発用の処理時間計測のみ
    visitedGridTimingRef.current.stableOverlayBuildMs = Date.now() - startedAt;

    return overlayCells;
  }, [coalescedVisitedGrid.stableCells, gridOverlayOpacity, themePrimaryColor]);

  /** fresh cellの描画用データ。フェード進捗を反映するため、フェームごとに再計算する(通常数個)。 */
  const freshOverlayCells = useMemo<VisitedGridOverlayCell[]>(() => {
    // eslint-disable-next-line react-hooks/purity -- フェード進捗は visitedGridFadeFrame の更新を契機に現在時刻で再計算する既存仕様
    const now = Date.now();
    const overlayCells = toVisitedGridOverlayCells(
      coalescedVisitedGrid.freshCells,
      gridOverlayOpacity,
      themePrimaryColor,
      GRID_OVERLAY_CONFIG,
      (cell) => getVisitedGridFadeProgress(cell.cellId, now),
    );
    // eslint-disable-next-line react-hooks/purity, react-hooks/refs -- 開発用の処理時間計測のみ
    visitedGridTimingRef.current.freshOverlayBuildMs = Date.now() - now;

    return overlayCells;
    // visitedGridFadeFrame はフェード中の再計算を強制するための意図的な依存(値自体は未使用)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 既存挙動維持のため依存配列を変更しない
  }, [coalescedVisitedGrid.freshCells, gridOverlayOpacity, themePrimaryColor, visitedGridFadeFrame]);

  /** stable cellとfresh cellを結合した最終描画データ。 */
  const visitedGridCells = useMemo<VisitedGridOverlayCell[]>(
    () => [...stableOverlayCells, ...freshOverlayCells],
    [stableOverlayCells, freshOverlayCells],
  );

  /**
   * 新規visited cellのフェード中だけ短い間隔で再描画する。
   * fresh cellだけを見て判定するため、stable cellがどれだけ多くても再描画対象にはならない。
   */
  useEffect(() => {
    const now = Date.now();
    const hasActiveFade = coalescedVisitedGrid.freshCells.some((cell) => getVisitedGridFadeProgress(cell.cellId, now) < 1);

    if (!hasActiveFade) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setVisitedGridFadeFrame((frame) => frame + 1);
    }, VISITED_GRID_FADE_FRAME_MS);

    return () => clearTimeout(timeoutId);
  }, [visitedGridFadeFrame, coalescedVisitedGrid.freshCells]);

  /**
   * 開発フラグ有効時だけ、取得・fresh判定/結合・描画変換のコストを出力する。
   * 結合後の内訳(stableCellCount / freshCellCount / coalescedBlockCountBySize)を含める。
   */
  useEffect(() => {
    logVisitedGridMetrics({
      rawCellCount: visitedGridSource.cells.length,
      stableCellCount: coalescedVisitedGrid.stableCells.length,
      freshCellCount: coalescedVisitedGrid.freshCells.length,
      renderPolygonCount: visitedGridCells.length,
      coalescedBlockCountBySize: coalescedVisitedGrid.blockCountBySize,
      fetchMs: visitedGridTimingRef.current.fetchMs,
      aggregationMs: visitedGridTimingRef.current.freshDetectionMs + visitedGridTimingRef.current.coalesceMs,
      overlayBuildMs: visitedGridTimingRef.current.stableOverlayBuildMs + visitedGridTimingRef.current.freshOverlayBuildMs,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 描画データが確定したときだけ出力する
  }, [visitedGridCells]);

  return {
    visitedGridCells,
    gridOverlayOpacity,
    incrementVisitedGridRefreshVersion,
  };
}
