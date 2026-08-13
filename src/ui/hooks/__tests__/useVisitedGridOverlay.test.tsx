import { act, renderHook } from '@testing-library/react-native';

import { getVisitedCellsInBounds } from '@/features/location/visitedCellRepository';
import { useVisitedGridOverlay } from '@/ui/hooks/useVisitedGridOverlay';

// getVisitedCellsInBoundsだけモックする。gridCell / gridAggregation / visitedGridFreshCells /
// visitedGridCoalescing は実物を使い、結合結果・fresh判定を実座標で検証する。
jest.mock('@/features/location/visitedCellRepository', () => ({
  getVisitedCellsInBounds: jest.fn().mockResolvedValue([]),
}));

/** テスト用の標準マップ表示範囲。latitudeDelta=0.01は表示セルサイズ100mになる。 */
const TEST_REGION = {
  latitude: 35.68,
  longitude: 139.76,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

const THEME_PRIMARY_COLOR = '#1f7a5c';

/**
 * TEST_REGION中心を含む4x4ブロックの原点(基本100mセル番号)。
 * `coordinateToGridCell` の実際のWeb Mercator変換に基づく値で、
 * DB取得範囲(padding 0.5あり)・画面外判定範囲(padding無し)の両方に完全に収まる。
 */
const BLOCK_ORIGIN = { x: 155580, y: 42564 };

/**
 * 再取得時の新規セル検出(fresh判定)の対象として使う2x2ブロックの原点。
 * BLOCK_ORIGINの4x4ブロックとは重ならず、TEST_REGIONの画面外判定範囲(padding無し、
 * 概算 X:[155574,155585] / Y:[42559,42573])の境界から2セル以上内側に寄せている
 * (境界ちょうどだと丸め次第で不安定になるため)。
 */
const FRESH_BLOCK_ORIGIN = { x: 155576, y: 42568 };

/** VisitedCellRow相当のテスト用行を作る。 */
function makeRow(x: number, y: number) {
  return {
    cellId: `100:${x}:${y}`,
    cellSizeMeters: 100,
    x,
    y,
    firstVisitedAt: '2026-08-01T00:00:00.000Z',
    lastVisitedAt: '2026-08-01T00:00:00.000Z',
    visitCount: 1,
  };
}

/** 指定した原点から完全に埋まった正方形ブロック分のvisited cell行を作る。 */
function makeFullBlockRows(origin: { x: number; y: number }, blockSize = 4) {
  const rows: ReturnType<typeof makeRow>[] = [];

  for (let y = origin.y; y < origin.y + blockSize; y += 1) {
    for (let x = origin.x; x < origin.x + blockSize; x += 1) {
      rows.push(makeRow(x, y));
    }
  }

  return rows;
}

/** BLOCK_ORIGINの4x4ブロックとFRESH_BLOCK_ORIGINの2x2ブロックをまとめて返す。 */
function makeCombinedRows() {
  return [...makeFullBlockRows(BLOCK_ORIGIN), ...makeFullBlockRows(FRESH_BLOCK_ORIGIN, 2)];
}

/** マイクロタスクを1つ流し、フックの非同期取得effectを完了させる。 */
async function flushFetch(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

/** `rgba(r, g, b, a)` 形式の文字列からalpha値を取り出す。フェード進捗の検証に使う。 */
function parseFillOpacity(fillColor: string): number {
  const match = fillColor.match(/,\s*([\d.]+)\)$/);
  return match ? Number(match[1]) : NaN;
}

/** gridOverlayRegionをpropsとして受け取るrenderHookのラッパー。rerenderでregionを差し替えるテストに使う。 */
function renderVisitedGridOverlay() {
  return renderHook(
    ({ gridOverlayRegion }: { gridOverlayRegion: typeof TEST_REGION }) =>
      useVisitedGridOverlay({ isReady: true, gridOverlayRegion, themePrimaryColor: THEME_PRIMARY_COLOR }),
    {
      initialProps: { gridOverlayRegion: TEST_REGION },
    },
  );
}

/**
 * 「4x4ブロック(BLOCK_ORIGIN)が既存stable」「2x2ブロック(FRESH_BLOCK_ORIGIN)がfresh」の状態を作る共通セットアップ。
 * 1回目取得でBLOCK_ORIGINの16セルだけを返し、2回目取得(再取得)でFRESH_BLOCK_ORIGINの4セルを追加する。
 */
async function setupWithFreshBlock() {
  (getVisitedCellsInBounds as jest.Mock).mockResolvedValueOnce(makeFullBlockRows(BLOCK_ORIGIN));

  const rendered = renderVisitedGridOverlay();

  await flushFetch();

  (getVisitedCellsInBounds as jest.Mock).mockResolvedValueOnce(makeCombinedRows());

  await act(async () => {
    rendered.result.current.incrementVisitedGridRefreshVersion();
    await Promise.resolve();
  });

  return rendered;
}

describe('訪問グリッドオーバーレイフック useVisitedGridOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getVisitedCellsInBounds as jest.Mock).mockResolvedValue([]);
  });

  describe('初期状態', () => {
    it('初期 visitedGridCells は空配列になる', () => {
      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: THEME_PRIMARY_COLOR }),
      );

      expect(result.current.visitedGridCells).toEqual([]);
    });

    it('gridOverlayOpacity は数値で返される', () => {
      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: THEME_PRIMARY_COLOR }),
      );

      expect(typeof result.current.gridOverlayOpacity).toBe('number');
    });

    it('incrementVisitedGridRefreshVersion は関数として返される', () => {
      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: THEME_PRIMARY_COLOR }),
      );

      expect(typeof result.current.incrementVisitedGridRefreshVersion).toBe('function');
    });
  });

  describe('isReady が false の場合', () => {
    it('isReady が false のときは getVisitedCellsInBounds を呼ばない', async () => {
      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: false, gridOverlayRegion: TEST_REGION, themePrimaryColor: THEME_PRIMARY_COLOR }),
      );

      await flushFetch();

      expect(getVisitedCellsInBounds).not.toHaveBeenCalled();
      expect(result.current.visitedGridCells).toEqual([]);
    });
  });

  describe('isReady が true の場合', () => {
    it('isReady が true のときは getVisitedCellsInBounds を呼ぶ', async () => {
      renderHook(() => useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: THEME_PRIMARY_COLOR }));

      await flushFetch();

      expect(getVisitedCellsInBounds).toHaveBeenCalledTimes(1);
    });

    it('getVisitedCellsInBounds は表示セルサイズ(100)付きで呼ばれる', async () => {
      renderHook(() => useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: THEME_PRIMARY_COLOR }));

      await flushFetch();

      expect(getVisitedCellsInBounds).toHaveBeenCalledWith(expect.any(Object), 100);
    });
  });

  describe('incrementVisitedGridRefreshVersion', () => {
    it('呼び出すと getVisitedCellsInBounds が再度呼ばれる', async () => {
      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: THEME_PRIMARY_COLOR }),
      );

      await flushFetch();

      const callCountBefore = (getVisitedCellsInBounds as jest.Mock).mock.calls.length;

      await act(async () => {
        result.current.incrementVisitedGridRefreshVersion();
        await Promise.resolve();
      });

      expect((getVisitedCellsInBounds as jest.Mock).mock.calls.length).toBeGreaterThan(callCountBefore);
    });
  });

  describe('Polygon結合とfresh判定', () => {
    it('完全に埋まった4x4は1つのPolygonへ結合される', async () => {
      (getVisitedCellsInBounds as jest.Mock).mockResolvedValue(makeFullBlockRows(BLOCK_ORIGIN));

      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: THEME_PRIMARY_COLOR }),
      );

      await flushFetch();

      expect(result.current.visitedGridCells).toHaveLength(1);
      expect(result.current.visitedGridCells[0].id).toBe(`400:${BLOCK_ORIGIN.x / 4}:${BLOCK_ORIGIN.y / 4}`);
    });

    it('結合できないデータは100mセルのPolygonとして描画される', async () => {
      const scatteredRows = [
        makeRow(BLOCK_ORIGIN.x, BLOCK_ORIGIN.y),
        makeRow(BLOCK_ORIGIN.x + 2, BLOCK_ORIGIN.y),
        makeRow(BLOCK_ORIGIN.x, BLOCK_ORIGIN.y + 2),
      ];
      (getVisitedCellsInBounds as jest.Mock).mockResolvedValue(scatteredRows);

      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: THEME_PRIMARY_COLOR }),
      );

      await flushFetch();

      expect(result.current.visitedGridCells).toHaveLength(3);
      expect(result.current.visitedGridCells.map((cell) => cell.id).sort()).toEqual(scatteredRows.map((row) => row.cellId).sort());
    });

    it('初回取得のセルはフェードせず即時表示する', async () => {
      (getVisitedCellsInBounds as jest.Mock).mockResolvedValue(makeFullBlockRows(BLOCK_ORIGIN));

      const { result } = renderHook(() =>
        useVisitedGridOverlay({ isReady: true, gridOverlayRegion: TEST_REGION, themePrimaryColor: THEME_PRIMARY_COLOR }),
      );

      await flushFetch();

      // not.toMatch(/, 0\)$/) だとalphaがちょうど0の場合しか落ちない(誤ってフェードが始まっていても
      // 1ms経てば0.0004等になり通ってしまう)。gridOverlayOpacity(フェードなしの正しいalpha)と
      // 完全一致することを検証し、対になるfresh側テスト(下記、alpha < 0.05)と揃える。
      expect(parseFillOpacity(result.current.visitedGridCells[0].fillColor)).toBeCloseTo(result.current.gridOverlayOpacity);
    });

    it('再取得で新しく現れた2x2ブロックは結合されず100mセル4個のまま残り、フェード開始直後の低いalphaで表示される', async () => {
      const { result } = await setupWithFreshBlock();

      const ids = result.current.visitedGridCells.map((cell) => cell.id);

      // 4x4ブロックは1個の400へ結合される一方、2x2の新規ブロックはfresh扱いのため結合されない。
      // detectFreshVisitedCellsの呼び出しが壊れてfreshCellIdsが常に空になると、この2x2ブロックも
      // `200:${FRESH_BLOCK_ORIGIN.x / 2}:${FRESH_BLOCK_ORIGIN.y / 2}` へ結合されてこのテストが落ちる。
      expect(result.current.visitedGridCells).toHaveLength(1 + 4);
      expect(ids).toContain(`400:${BLOCK_ORIGIN.x / 4}:${BLOCK_ORIGIN.y / 4}`);
      expect(ids).not.toContain(`200:${FRESH_BLOCK_ORIGIN.x / 2}:${FRESH_BLOCK_ORIGIN.y / 2}`);

      for (let y = FRESH_BLOCK_ORIGIN.y; y < FRESH_BLOCK_ORIGIN.y + 2; y += 1) {
        for (let x = FRESH_BLOCK_ORIGIN.x; x < FRESH_BLOCK_ORIGIN.x + 2; x += 1) {
          const cell = result.current.visitedGridCells.find((candidate) => candidate.id === `100:${x}:${y}`);

          expect(cell).toBeDefined();
          // フェード開始直後なのでalphaはgridOverlayOpacity(0.2)よりかなり低い。
          expect(parseFillOpacity(cell!.fillColor)).toBeLessThan(0.05);
        }
      }
    });

    it('freshセルのフェード中もstableセルのcoordinates参照は再計算されない(同一参照を維持する)', async () => {
      // このテストがこのブランチの最適化の核心(stable/freshのメモ分割によるフェード中の
      // 再計算コスト削減)を固定する。stableOverlayCellsのdepsにvisitedGridFadeFrameが混入する
      // 退行(または stable/fresh のメモを1つに戻す退行)が起きると、フェードフレームが
      // 進むたびにstableセルのcoordinatesオブジェクトが新しく生成され直し、このテストが失敗する。
      //
      // fake timersは使わない。フェード用setTimeoutは非同期取得完了後のeffectで
      // (fake timers導入前に)スケジュールされるため、後からfake timersへ切り替えても
      // 別クロックの空振りになりsetTimeoutが発火しない(この落とし穴を退行注入で確認済み)。
      // 実時間でVISITED_GRID_FADE_FRAME_MS(50ms)より長く待ち、実際にコールバックを発火させる。
      const { result } = await setupWithFreshBlock();

      const stableCellId = `400:${BLOCK_ORIGIN.x / 4}:${BLOCK_ORIGIN.y / 4}`;
      const stableCellBefore = result.current.visitedGridCells.find((cell) => cell.id === stableCellId);
      expect(stableCellBefore).toBeDefined();
      const coordinatesBefore = stableCellBefore!.coordinates;

      // フェードフレームを1つ進める(VISITED_GRID_FADE_FRAME_MS=50ms)。fresh cellの
      // 再描画だけをトリガーする想定で、stable cell側のメモは再計算されないはず。
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 80));
      });

      const stableCellAfter = result.current.visitedGridCells.find((cell) => cell.id === stableCellId);
      expect(stableCellAfter).toBeDefined();
      // toEqualではなくtoBe(参照一致)であることが重要。中身が同じでも新しい配列・オブジェクトが
      // 作られていればPolygon propsの参照が変わり、ネイティブ側の再挿入コストが発生してしまう。
      expect(stableCellAfter!.coordinates).toBe(coordinatesBefore);
    });
  });

  describe('画面外判定とズームでのfresh保持', () => {
    it('画面外(paddingなしの実表示範囲外)へ出たfreshセルはfreshから落ち、次回取得で結合対象になる', async () => {
      const { result, rerender } = await setupWithFreshBlock();

      expect(result.current.visitedGridCells).toHaveLength(5);

      // TEST_REGIONから経度を+0.004ずらす。この量は、paddingなしの画面外判定範囲からは
      // FRESH_BLOCK_ORIGINの2セル(x:155576,155577)を完全に除外する一方、DB取得と同じ
      // paddingRatio(0.5)を誤って画面外判定に使った場合はまだ範囲内に残ってしまう境界値。
      // (paddingRatioを誤って渡す退行を検出するため、遠方へ飛ばすのではなくこの値を選んでいる)
      const MOVED_REGION = { ...TEST_REGION, longitude: TEST_REGION.longitude + 0.004 };
      (getVisitedCellsInBounds as jest.Mock).mockResolvedValueOnce(makeCombinedRows());

      await act(async () => {
        rerender({ gridOverlayRegion: MOVED_REGION });
        await Promise.resolve();
      });

      const ids = result.current.visitedGridCells.map((cell) => cell.id);

      // freshから落ちたことで2x2ブロックも結合され、400ブロックと合わせて2つのPolygonになる。
      expect(result.current.visitedGridCells).toHaveLength(2);
      expect(ids).toContain(`400:${BLOCK_ORIGIN.x / 4}:${BLOCK_ORIGIN.y / 4}`);
      expect(ids).toContain(`200:${FRESH_BLOCK_ORIGIN.x / 2}:${FRESH_BLOCK_ORIGIN.y / 2}`);
    });

    it('表示セルサイズ変更(latitudeDelta 0.01→0.1)ではfreshが落ちない', async () => {
      const { result, rerender } = await setupWithFreshBlock();

      expect(result.current.visitedGridCells).toHaveLength(5);

      // 200m表示になる。同じ座標に同じ20セルがある想定でモックする。位置はTEST_REGIONと
      // 同じ中心のまま広げるだけなので、画面外判定は影響しない(視野が広がるだけで
      // FRESH_BLOCK_ORIGINは引き続き視野内)。
      const ZOOMED_OUT_REGION = { ...TEST_REGION, latitudeDelta: 0.1, longitudeDelta: 0.1 };
      (getVisitedCellsInBounds as jest.Mock).mockResolvedValueOnce(makeCombinedRows());

      await act(async () => {
        rerender({ gridOverlayRegion: ZOOMED_OUT_REGION });
        await Promise.resolve();
      });

      // 100m表示へ戻す。同じ20セルを再度返す。
      (getVisitedCellsInBounds as jest.Mock).mockResolvedValueOnce(makeCombinedRows());

      await act(async () => {
        rerender({ gridOverlayRegion: TEST_REGION });
        await Promise.resolve();
      });

      const ids = result.current.visitedGridCells.map((cell) => cell.id);

      // ズーム往復後もfreshが保持されていれば、2x2ブロックは結合されず100mセル4個のまま残る。
      // detectFreshVisitedCellsは表示セルサイズ変更をまたぐ検出を行わないため、ここで
      // freshが維持されているのはfetch effect内のマージ処理(前回fresh集合とのunion)による。
      expect(result.current.visitedGridCells).toHaveLength(5);
      expect(ids).toContain(`400:${BLOCK_ORIGIN.x / 4}:${BLOCK_ORIGIN.y / 4}`);
      expect(ids).not.toContain(`200:${FRESH_BLOCK_ORIGIN.x / 2}:${FRESH_BLOCK_ORIGIN.y / 2}`);

      for (let y = FRESH_BLOCK_ORIGIN.y; y < FRESH_BLOCK_ORIGIN.y + 2; y += 1) {
        for (let x = FRESH_BLOCK_ORIGIN.x; x < FRESH_BLOCK_ORIGIN.x + 2; x += 1) {
          expect(ids).toContain(`100:${x}:${y}`);
        }
      }
    });
  });
});
