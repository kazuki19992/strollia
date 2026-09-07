import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Region } from 'react-native-maps';

import { loadGeotaggedPhotos, loadGeotaggedPhotosInBounds, MapPhoto } from '@/features/photos/photoLibrary';
import { filterFallbackPhotosInBounds, selectLatestFallbackPhotos } from '@/features/photos/photoScanFallback';
import type { PhotoScanMetrics } from '@/features/photos/photoScanMetrics';
import {
  getPhotoViewportBounds,
  isPhotoViewportBoundsContained,
  PHOTO_VIEWPORT_PADDING_RATIO,
  type PhotoViewportBounds,
} from '@/features/photos/photoViewportBounds';

export type PhotoMapOverlayState = {
  /** マップ上に表示するジオタグ付き写真。 */
  photos: MapPhoto[];
  /** `photo_assets`(キャッシュ)の検索中かどうか。 */
  isLoadingPhotos: boolean;
  /**
   * 背後で写真ライブラリの差分走査が動いているかどうか。
   *
   * 走査は表示をブロックしないため、読み込み表示とは別の状態として持つ。
   * 画面側は「邪魔にならない形」で走査中であることを示すために使う(設計書 §4.2)。
   */
  isScanningPhotoLibrary: boolean;
  /** 写真読み込み時に発生したエラーメッセージ。 */
  photoErrorMessage: string | null;
  /**
   * 直近の写真ライブラリ走査の計測値。走査前・無効時はnull。
   *
   * 走査上限の撤廃(Phase 2-c)を実測で設計するための一時的な計測値で、表示するかどうかは
   * `createPhotoScanMetricsLines` が開発フラグで判断する。
   */
  photoScanMetrics: PhotoScanMetrics | null;
  /**
   * 写真ライブラリを走査せずに `photo_assets` を引き直す。
   *
   * 明示的な全件スキャン(`usePhotoLibrarySync`)の完了後に、地図の表示を最新化するために使う。
   *
   * **引数は全件スキャンの結果に応じたフォールバック写真である。** キャッシュ保存に成功していれば
   * 省略(またはnull)し、失敗していればその走査結果を渡す。省略すると以前のフォールバックは
   * 解除される。解除しないと、キャッシュが最新化されたあとも古い走査結果を表示し続けてしまう。
   */
  refreshPhotosFromCache: (scanFallbackPhotos?: MapPhoto[] | null) => void;
};

/**
 * 写真表示設定と表示範囲に応じてジオタグ付き写真を読み込む。
 *
 * **キャッシュ先読みが本フックの中心的な設計である。**
 *
 * ```text
 * ビューポート検索(photo_assets)→ 即表示
 *   ↓ 並行して
 * 差分走査(loadGeotaggedPhotos)→ 完了したら表示を更新
 * ```
 *
 * かつては `await loadGeotaggedPhotos()` のあとにビューポート検索を行っていた。実測(設計書 §2)では
 * 全ライブラリ18,000枚の走査に24秒かかるため、DBに写真があるのに起動後20秒以上なにも表示されない
 * 状態になっていた。走査を待たずに保存済みメタデータから描くことで、走査コストがユーザーから見えなくなる。
 *
 * 自動で走る走査は**差分モード**に限る。全件走査はユーザーが「ライブラリを再読み込み」を選んだときだけ
 * 実行する(設計書 §4.3 / §4.4)。差分走査は基準時刻より新しい範囲しか見ないため、古い範囲の削除・
 * 追加は取りこぼす。その回収手段が明示的な全件走査である。
 *
 * ビューポート検索は、余白込みで取得した範囲に表示範囲が収まっている間はSQLを撃たない
 * (Visited Grid の `isGridBoundsContained` と同じ考え方)。
 *
 * 走査のキャッシュ保存が失敗した場合は `photo_assets` が空のままなので、ビューポート検索を実行すると
 * 走査できているのに1枚も表示されない。この場合だけ走査結果をメモリ上で絞り込んで表示する。
 *
 * @param enabled - マップ上の写真表示が有効かどうか。
 * @param region - 現在の地図表示範囲。ジェスチャー中に更新されない範囲を渡すこと。
 * @param displayLimit - 「地図に表示する写真」設定から解決した表示上限。上限なしの場合はnull。
 * @returns 写真一覧、読み込み・走査状態、エラー、計測値、キャッシュ再読み込み関数。
 */
export function usePhotoMapOverlay(enabled: boolean, region: Region, displayLimit: number | null = null): PhotoMapOverlayState {
  const [photos, setPhotos] = useState<MapPhoto[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [isScanningPhotoLibrary, setIsScanningPhotoLibrary] = useState(false);
  const [photoErrorMessage, setPhotoErrorMessage] = useState<string | null>(null);
  const [photoScanMetrics, setPhotoScanMetrics] = useState<PhotoScanMetrics | null>(null);
  /**
   * キャッシュ保存に失敗したときに、代わりに表示する走査結果。
   *
   * 保存できた場合はnullで、その場合はビューポート検索の結果を使う。
   */
  const [scanFallbackPhotos, setScanFallbackPhotos] = useState<MapPhoto[] | null>(null);
  /** キャッシュを引き直させるためのカウンタ。走査完了・明示的な再読み込みで進める。 */
  const [cacheRefreshVersion, setCacheRefreshVersion] = useState(0);
  const photoLoadSeqRef = useRef(0);
  /** 直近で `photo_assets` を検索した範囲(余白込み)。 */
  const fetchedBoundsRef = useRef<PhotoViewportBounds | null>(null);
  /**
   * 今回の有効化で差分走査を開始済みかどうか。
   *
   * 表示範囲の変化で再レンダーされても走査を二重に走らせないために使う。写真表示をOFFにすると
   * falseへ戻り、次にONにしたときへ再び走査できる。
   */
  const isScanStartedRef = useRef(false);

  const refreshPhotosFromCache = useCallback((nextScanFallbackPhotos: MapPhoto[] | null = null): void => {
    // 引き直す前に古いフォールバックを張り替える。残すとキャッシュを最新化しても表示が古いままになる
    setScanFallbackPhotos(nextScanFallbackPhotos);
    setCacheRefreshVersion((version) => version + 1);
  }, []);

  /**
   * フォールバック表示に使う、表示上限まで絞った走査結果。
   *
   * 表示上限は「全体の最新N件」なので、表示範囲での絞り込みより**前**に掛ける必要がある。
   * 表示範囲が変わるたびに並べ替え直さないよう、上限までの絞り込みはここでメモ化する。
   */
  const limitedScanFallbackPhotos = useMemo(
    () => (scanFallbackPhotos === null ? null : selectLatestFallbackPhotos(scanFallbackPhotos, displayLimit)),
    [displayLimit, scanFallbackPhotos],
  );

  const loadPhotosForRegion = useCallback(async (): Promise<void> => {
    if (!enabled) {
      // OFFは明示的な取り消しなので、実行中の読み込みの結果を捨てさせるためシーケンス番号を進める
      photoLoadSeqRef.current += 1;
      fetchedBoundsRef.current = null;
      setPhotos([]);
      setPhotoErrorMessage(null);
      setPhotoScanMetrics(null);
      setScanFallbackPhotos(null);
      setIsLoadingPhotos(false);
      setIsScanningPhotoLibrary(false);
      return;
    }

    const fetchedBounds = fetchedBoundsRef.current;

    // 余白の内側に収まっている間は、取得済みの写真がそのまま使えるため再検索しない。
    // ここでシーケンス番号を進めてはいけない。範囲外→範囲内と戻っただけで実行中の読み込みが
    // 取り消され、`fetchedBoundsRef` が古いまま残ったり読み込み表示が先に消えたりするため。
    if (fetchedBounds !== null && isPhotoViewportBoundsContained(fetchedBounds, getPhotoViewportBounds(region))) {
      return;
    }

    // 実際に読み込みを開始する時点でだけシーケンス番号を進める(先行する読み込みを取り消す)
    const loadSeq = ++photoLoadSeqRef.current;

    setIsLoadingPhotos(true);
    setPhotoErrorMessage(null);

    try {
      const searchBounds = getPhotoViewportBounds(region, { paddingRatio: PHOTO_VIEWPORT_PADDING_RATIO });
      // キャッシュ保存に失敗した場合はDBを引かず、メモリ上の走査結果を同じ条件で絞り込む。
      // 表示件数と並び順がDB経路と食い違わないよう、絞り込みは `photoScanFallback` に寄せている
      const loadedPhotos =
        limitedScanFallbackPhotos === null
          ? await loadGeotaggedPhotosInBounds(searchBounds, displayLimit)
          : filterFallbackPhotosInBounds(limitedScanFallbackPhotos, searchBounds);

      if (loadSeq === photoLoadSeqRef.current) {
        fetchedBoundsRef.current = searchBounds;
        setPhotos(loadedPhotos);
      }
    } catch (error: unknown) {
      if (loadSeq === photoLoadSeqRef.current) {
        fetchedBoundsRef.current = null;
        setPhotos([]);
        setPhotoErrorMessage(error instanceof Error ? error.message : '写真の読み込みに失敗しました。');
      }
    } finally {
      if (loadSeq === photoLoadSeqRef.current) {
        setIsLoadingPhotos(false);
      }
    }
  }, [displayLimit, enabled, limitedScanFallbackPhotos, region]);

  /**
   * 取得済み範囲の判定を無効化する。
   *
   * 表示上限が変わったときと、キャッシュの中身が変わりうるとき(走査完了・明示的な再読み込み)は、
   * 表示範囲が同じでも結果が変わる。**この effect は検索 effect より前に宣言しておく必要がある**
   * (Reactは宣言順に effect を実行するため、後ろに置くと同じコミット内で古い範囲が使われてしまう)。
   */
  useEffect(() => {
    fetchedBoundsRef.current = null;
  }, [cacheRefreshVersion, displayLimit, limitedScanFallbackPhotos]);

  /**
   * 設定がONになったタイミングと表示範囲が余白の外へ出たタイミングで写真を読み込み、
   * OFFなら表示状態を即クリアする。
   */
  useEffect(() => {
    loadPhotosForRegion();
  }, [cacheRefreshVersion, loadPhotosForRegion]);

  /**
   * 表示と並行して写真ライブラリの差分走査を1回だけ走らせ、完了したらキャッシュを引き直す。
   *
   * 走査の失敗は表示を巻き戻さない。すでにキャッシュから描けている写真を消してしまうと、
   * 「走査に失敗したせいで地図から写真が消える」という、キャッシュ先読みで避けたかった状態に戻るため。
   */
  useEffect(() => {
    if (!enabled) {
      isScanStartedRef.current = false;
      return;
    }

    if (isScanStartedRef.current) {
      return;
    }

    isScanStartedRef.current = true;
    let isActive = true;
    setIsScanningPhotoLibrary(true);

    loadGeotaggedPhotos({ mode: 'incremental' })
      .then((result) => {
        if (!isActive) {
          return;
        }

        setPhotoScanMetrics(result.metrics);
        setScanFallbackPhotos(result.isCacheSaved ? null : result.photos);
        setCacheRefreshVersion((version) => version + 1);
      })
      .catch((error: unknown) => {
        if (!isActive) {
          return;
        }

        // 次に表示範囲が変わったときではなく、次の有効化で再試行させる
        isScanStartedRef.current = false;
        setPhotoErrorMessage(error instanceof Error ? error.message : '写真ライブラリの読み込みに失敗しました。');
      })
      .finally(() => {
        if (isActive) {
          setIsScanningPhotoLibrary(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [enabled]);

  return { photos, isLoadingPhotos, isScanningPhotoLibrary, photoErrorMessage, photoScanMetrics, refreshPhotosFromCache };
}
