import { getPermissionsAsync, requestPermissionsAsync } from 'expo-media-library';
import { useCallback, useRef, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import type { Region } from 'react-native-maps';

import { reportPhotoMapDiagnostics } from '@/config/sentry';
import { hasFullPhotoAccess } from '@/features/photos/photoLibrary';
import { setSetting } from '@/features/settings/settingsRepository';
import { usePhotoMapOverlay } from './usePhotoMapOverlay';
import type { MapPhoto } from '@/features/photos/photoLibrary';
import type { PhotoScanMetrics } from '@/features/photos/photoScanMetrics';

/** マップ上の写真表示設定をSQLiteへ保存するキー。 */
export const SHOW_PHOTOS_ON_MAP_SETTING_KEY = 'showPhotosOnMap';
/** 写真表示を安全に有効化できたかを判定するための一時フラグ。 */
export const SHOW_PHOTOS_ON_MAP_ENABLE_PENDING_SETTING_KEY = 'showPhotosOnMapEnablePending';
/** 写真マーカー描画後にクラッシュしないことを確認する猶予時間。 */
const PHOTO_MAP_ENABLE_STABLE_DELAY_MS = 2000;

/** `usePhotoMapCrashBreaker` フックの引数。 */
export type UsePhotoMapCrashBreakerParams = {
  /**
   * アプリの初期化完了フラグ。
   * false の間は写真表示復元 effect を動作させない。
   */
  isReady: boolean;
  /**
   * ネイティブ地図の初期化完了フラグ。
   * MapView 準備完了後に写真表示を復元する。
   */
  isMapReady: boolean;
  /**
   * 写真の検索範囲に使う地図表示範囲。
   * ジェスチャー中に更新されない範囲(Visited Grid と同じもの)を渡す。
   */
  photoOverlayRegion: Region;
  /**
   * 「地図に表示する写真」設定から解決した表示上限。上限なしの場合はnull。
   *
   * 地図のパン・ズームのたびに設定を読み直さないよう、UI層で保持した値を受け取る。
   */
  photoDisplayLimit?: number | null;
};

/** `usePhotoMapCrashBreaker` が返す状態と操作の型。 */
export type UsePhotoMapCrashBreakerResult = {
  /**
   * マップ上に写真を表示するかどうか。
   * クラッシュブレーカーにより無効化されると false に戻る。
   */
  showPhotosOnMap: boolean;
  /**
   * 写真表示設定の更新中かどうか。
   * 権限要求・設定保存の非同期処理中は true になる。
   */
  isUpdatingPhotoSetting: boolean;
  /** 地図上に表示するジオタグ付き写真。isLoadingPhotos が true の間は前回の値を保持する。 */
  photos: MapPhoto[];
  /** 写真データ(`photo_assets`)を取得中かどうか。 */
  isLoadingPhotos: boolean;
  /** 背後で写真ライブラリの差分走査が動いているかどうか。 */
  isScanningPhotoLibrary: boolean;
  /** 写真取得でエラーが発生した場合のメッセージ。 */
  photoErrorMessage: string | null;
  /**
   * 直近の写真ライブラリ走査の計測値。走査前・写真表示OFF時はnull。
   *
   * 走査上限の撤廃(Phase 2-c)を実測で設計するための一時的な計測値を、画面まで素通しする。
   */
  photoScanMetrics: PhotoScanMetrics | null;
  /**
   * 初回起動時の設定読み込み完了後に呼ぶ初期化関数。
   * App.tsx の初期化 effect から savedShowPhotosOnMap / savedShowPhotosOnMapEnablePending の
   * 読み込み結果を受けて呼ぶ。
   *
   * @param savedShowPhotosOnMap - 保存済みの写真表示設定。
   * @param savedShowPhotosOnMapEnablePending - 前回のクラッシュブレーカーが残っていたか。
   */
  initializePhotoSetting: (params: { savedShowPhotosOnMap: boolean; savedShowPhotosOnMapEnablePending: boolean }) => void;
  /**
   * 写真表示設定を切り替える。初回ON時は写真ライブラリのフルアクセス権限を要求する。
   *
   * @param enabled - マップ上の写真表示を有効にするかどうか。
   */
  updateShowPhotosOnMap: (enabled: boolean) => Promise<void>;
  /**
   * 写真ライブラリを走査せずに `photo_assets` を引き直す。
   *
   * 明示的な全件スキャンの完了後に、地図の表示を最新化するために使う。
   * 引数の意味は `PhotoMapOverlayState.refreshPhotosFromCache` を参照。
   */
  refreshPhotosFromCache: (scanFallbackPhotos?: MapPhoto[] | null) => void;
};

/**
 * 写真表示設定とクラッシュブレーカー機構を束ねるカスタムフック。
 *
 * App.tsx から以下を切り出した:
 * - state: showPhotosOnMap / shouldRestorePhotosOnMapAfterMapReady / isUpdatingPhotoSetting
 * - ref: isUpdatingPhotoSettingRef
 * - 関数: enableShowPhotosOnMapWithCrashBreaker / updateShowPhotosOnMap
 * - effect: クラッシュブレーカー復元 effect / pending 解除 effect
 *
 * クラッシュブレーカー: ネイティブ地図初期化中に写真マーカーを載せてクラッシュする経路を
 * 避けるため、写真表示有効化時に pending フラグを SQLite に保存し、次回起動時に残った
 * pending を復旧シグナルとして自動的に写真表示を OFF に戻す。
 *
 * ユーザー向け挙動は App.tsx のそれと完全に同一に保つ。
 */
export function usePhotoMapCrashBreaker({
  isReady,
  isMapReady,
  photoOverlayRegion,
  photoDisplayLimit = null,
}: UsePhotoMapCrashBreakerParams): UsePhotoMapCrashBreakerResult {
  const isUpdatingPhotoSettingRef = useRef(false);

  const [showPhotosOnMap, setShowPhotosOnMap] = useState(false);
  const [shouldRestorePhotosOnMapAfterMapReady, setShouldRestorePhotosOnMapAfterMapReady] = useState(false);
  const [isUpdatingPhotoSetting, setIsUpdatingPhotoSetting] = useState(false);

  // 写真データ取得フック。showPhotosOnMap が true のときのみ写真を取得する。
  const { photos, isLoadingPhotos, isScanningPhotoLibrary, photoErrorMessage, photoScanMetrics, refreshPhotosFromCache } =
    usePhotoMapOverlay(showPhotosOnMap, photoOverlayRegion, photoDisplayLimit);

  /**
   * 写真表示を有効化する前にpendingを保存し、ネイティブクラッシュ後の次回起動で復旧できるようにする。
   */
  const enableShowPhotosOnMapWithCrashBreaker = useCallback(async (): Promise<void> => {
    await setSetting(SHOW_PHOTOS_ON_MAP_ENABLE_PENDING_SETTING_KEY, true);
    setShowPhotosOnMap(true);
    await setSetting(SHOW_PHOTOS_ON_MAP_SETTING_KEY, true);
  }, []);

  /**
   * 写真表示のUI状態と永続化キーをOFFへ巻き戻す。
   *
   * 有効化・復元の失敗時に「UIはONのままSQLiteはOFF」という乖離を残さないための
   * 共通処理。巻き戻し自体の失敗はそれ以上回復できないため、診断できるよう
   * ログに残すだけに留める。
   */
  const resetPhotoMapPersistedState = useCallback(async (): Promise<void> => {
    setShowPhotosOnMap(false);
    await setSetting(SHOW_PHOTOS_ON_MAP_SETTING_KEY, false).catch((cleanupError: unknown) => {
      console.warn('Failed to reset showPhotosOnMap setting after error:', cleanupError);
    });
    await setSetting(SHOW_PHOTOS_ON_MAP_ENABLE_PENDING_SETTING_KEY, false).catch((cleanupError: unknown) => {
      console.warn('Failed to reset showPhotosOnMap pending flag after error:', cleanupError);
    });
  }, []);

  /**
   * 保存済みの写真表示ONを、現在の権限を再確認したうえで復元する。
   *
   * **復元経路でも権限の確認が要る。** フルアクセスで `photo_assets` を作ったあとにOS設定で
   * 「選択した写真」へ変更されると、保存済みの行には現在アクセスできない写真が含まれる。
   * 権限を見ずに復元すると、ユーザーがアクセスを取り消した写真がビューポート検索経由で
   * 地図へ再表示されてしまう(`docs/photo-geotag.md` §11「権限が取り消された場合は写真表示を停止する」)。
   *
   * 権限は `getPermissionsAsync` で**参照するだけ**にする。起動直後の復元でダイアログを出すのは
   * 不親切であり、権限の要求は写真表示をONにする導線の責務であるため。
   * 満たさない場合はUIと永続化をまとめてOFFへ戻し、Alertは出さない。
   *
   * @returns なし。
   */
  const restorePhotosOnMapIfPermitted = useCallback(async (): Promise<void> => {
    const permission = await getPermissionsAsync();

    if (!hasFullPhotoAccess(permission)) {
      await resetPhotoMapPersistedState();
      return;
    }

    await enableShowPhotosOnMapWithCrashBreaker();
  }, [enableShowPhotosOnMapWithCrashBreaker, resetPhotoMapPersistedState]);

  /**
   * 写真表示設定を切り替える。初回ON時は写真ライブラリのフルアクセス権限を要求する。
   *
   * @param enabled - マップ上の写真表示を有効にするかどうか。
   * @returns なし。
   */
  const updateShowPhotosOnMap = useCallback(
    async (enabled: boolean): Promise<void> => {
      if (isUpdatingPhotoSettingRef.current) {
        return;
      }

      isUpdatingPhotoSettingRef.current = true;
      setIsUpdatingPhotoSetting(true);

      try {
        if (!enabled) {
          setShouldRestorePhotosOnMapAfterMapReady(false);
          setShowPhotosOnMap(false);
          await setSetting(SHOW_PHOTOS_ON_MAP_SETTING_KEY, false);
          await setSetting(SHOW_PHOTOS_ON_MAP_ENABLE_PENDING_SETTING_KEY, false);
          return;
        }

        const permission = await requestPermissionsAsync(false, ['photo']);

        // 実機で「ONにしても写真が出ない」原因が権限段階かを切り分けるための調査用計装。
        // 保存済み設定からの復元経路は権限要求を通らないため、この経路だけで送る。
        //
        // accessPrivileges は expo-media-library の型上 optional で、OS/APIレベルによっては未設定になる
        // (limited を返すのは iOS 14 以降 / Android 14 (API 34) 以降のみ)。未設定でも granted が true なら
        // hasFullPhotoAccess はフルアクセス扱いとする。そのため診断値の null は「拒否」ではなく
        // 「OS が accessPrivileges を返さなかった」を意味する。granted と併せて読むこと。
        reportPhotoMapDiagnostics('permission', {
          granted: permission.granted,
          accessPrivileges: permission.accessPrivileges ?? null,
          hasFullAccess: hasFullPhotoAccess(permission),
        });

        if (!hasFullPhotoAccess(permission)) {
          setShouldRestorePhotosOnMapAfterMapReady(false);
          await resetPhotoMapPersistedState();
          Alert.alert(
            '写真のフルアクセスが必要です',
            'マップ上に写真を表示するには、写真ライブラリへのフルアクセスを許可してください。限定アクセスではジオタグ付き写真を十分に読み取れません。',
          );
          return;
        }

        try {
          await enableShowPhotosOnMapWithCrashBreaker();
        } catch (error: unknown) {
          console.warn('Failed to enable photo map overlay:', error);
          await resetPhotoMapPersistedState();
          // サイレントにOFFへ戻すとユーザーが混乱するため、権限拒否時と同様に理由を通知する
          Alert.alert('写真表示を有効化できませんでした', '設定の保存に失敗したため、写真表示をOFFに戻しました。');
        }
      } finally {
        isUpdatingPhotoSettingRef.current = false;
        setIsUpdatingPhotoSetting(false);
      }
    },
    [enableShowPhotosOnMapWithCrashBreaker, resetPhotoMapPersistedState],
  );

  /**
   * 保存済みの写真表示ONは、MapViewの準備完了後に初めて復元する。
   * 起動直後のネイティブ地図初期化中に写真マーカーを載せてクラッシュする経路を避けるため。
   *
   * 復元時には権限を再確認する(詳細は `restorePhotosOnMapIfPermitted` を参照)。
   * 権限の参照自体に失敗した場合も、フルアクセスと言い切れないためcatchでOFFへ巻き戻す。
   */
  useEffect(() => {
    if (!shouldRestorePhotosOnMapAfterMapReady || !isReady || !isMapReady) {
      return;
    }

    if (isUpdatingPhotoSettingRef.current) {
      return;
    }

    isUpdatingPhotoSettingRef.current = true;
    setIsUpdatingPhotoSetting(true);
    setShouldRestorePhotosOnMapAfterMapReady(false);
    restorePhotosOnMapIfPermitted()
      .catch((error: unknown) => {
        console.warn('Failed to restore photo map overlay:', error);
        // resetPhotoMapPersistedState は内部で失敗をログに残すため fire-and-forget でよい
        void resetPhotoMapPersistedState();
      })
      .finally(() => {
        isUpdatingPhotoSettingRef.current = false;
        setIsUpdatingPhotoSetting(false);
      });
  }, [isMapReady, isReady, resetPhotoMapPersistedState, restorePhotosOnMapIfPermitted, shouldRestorePhotosOnMapAfterMapReady]);

  /**
   * 写真読み込みとマーカー描画が一定時間続いたら、前回クラッシュ判定用のpendingを解除する。
   * ネイティブクラッシュはJSで捕捉できないため、次回起動時に残ったpendingを復旧シグナルとして使う。
   */
  useEffect(() => {
    if (!showPhotosOnMap || !isMapReady || isLoadingPhotos) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setSetting(SHOW_PHOTOS_ON_MAP_ENABLE_PENDING_SETTING_KEY, false).catch((error: unknown) => {
        console.warn('Failed to clear photo map crash breaker:', error);
      });
    }, PHOTO_MAP_ENABLE_STABLE_DELAY_MS);

    return () => clearTimeout(timeoutId);
  }, [isLoadingPhotos, isMapReady, showPhotosOnMap]);

  /**
   * 初回起動時の設定読み込み完了後に呼ぶ初期化関数。
   * App.tsx の初期化 effect から読み込んだ savedShowPhotosOnMap / savedShowPhotosOnMapEnablePending を受けて呼ぶ。
   *
   * @param params.savedShowPhotosOnMap - 保存済みの写真表示設定。
   * @param params.savedShowPhotosOnMapEnablePending - 前回のクラッシュブレーカーが残っていたか。
   */
  const initializePhotoSetting = useCallback(
    ({
      savedShowPhotosOnMap,
      savedShowPhotosOnMapEnablePending,
    }: {
      savedShowPhotosOnMap: boolean;
      savedShowPhotosOnMapEnablePending: boolean;
    }): void => {
      setShowPhotosOnMap(false);
      if (savedShowPhotosOnMapEnablePending) {
        setShouldRestorePhotosOnMapAfterMapReady(false);
      } else {
        setShouldRestorePhotosOnMapAfterMapReady(savedShowPhotosOnMap);
      }
    },
    [],
  );

  return {
    showPhotosOnMap,
    isUpdatingPhotoSetting,
    photos,
    isLoadingPhotos,
    isScanningPhotoLibrary,
    photoErrorMessage,
    photoScanMetrics,
    initializePhotoSetting,
    updateShowPhotosOnMap,
    refreshPhotosFromCache,
  };
}
