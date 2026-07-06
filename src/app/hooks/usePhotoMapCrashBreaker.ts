import * as MediaLibrary from 'expo-media-library';
import { useCallback, useRef, useState, useEffect } from 'react';
import { Alert } from 'react-native';

import { hasFullPhotoAccess } from '@/features/photos/photoLibrary';
import { setSetting } from '@/features/settings/settingsRepository';
import { usePhotoMapOverlay } from './usePhotoMapOverlay';
import type { MapPhoto } from '@/features/photos/photoLibrary';

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
  /** 写真データを取得中かどうか。 */
  isLoadingPhotos: boolean;
  /** 写真取得でエラーが発生した場合のメッセージ。 */
  photoErrorMessage: string | null;
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
export function usePhotoMapCrashBreaker({ isReady, isMapReady }: UsePhotoMapCrashBreakerParams): UsePhotoMapCrashBreakerResult {
  const isUpdatingPhotoSettingRef = useRef(false);

  const [showPhotosOnMap, setShowPhotosOnMap] = useState(false);
  const [shouldRestorePhotosOnMapAfterMapReady, setShouldRestorePhotosOnMapAfterMapReady] = useState(false);
  const [isUpdatingPhotoSetting, setIsUpdatingPhotoSetting] = useState(false);

  // 写真データ取得フック。showPhotosOnMap が true のときのみ写真を取得する。
  const { photos, isLoadingPhotos, photoErrorMessage } = usePhotoMapOverlay(showPhotosOnMap);

  /**
   * 写真表示を有効化する前にpendingを保存し、ネイティブクラッシュ後の次回起動で復旧できるようにする。
   */
  const enableShowPhotosOnMapWithCrashBreaker = useCallback(async (): Promise<void> => {
    await setSetting(SHOW_PHOTOS_ON_MAP_ENABLE_PENDING_SETTING_KEY, true);
    setShowPhotosOnMap(true);
    await setSetting(SHOW_PHOTOS_ON_MAP_SETTING_KEY, true);
  }, []);

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

        const permission = await MediaLibrary.requestPermissionsAsync(false, ['photo']);

        if (!hasFullPhotoAccess(permission)) {
          setShouldRestorePhotosOnMapAfterMapReady(false);
          setShowPhotosOnMap(false);
          await setSetting(SHOW_PHOTOS_ON_MAP_SETTING_KEY, false);
          await setSetting(SHOW_PHOTOS_ON_MAP_ENABLE_PENDING_SETTING_KEY, false);
          Alert.alert(
            '写真のフルアクセスが必要です',
            'マップ上に写真を表示するには、写真ライブラリへのフルアクセスを許可してください。限定アクセスではジオタグ付き写真を十分に読み取れません。',
          );
          return;
        }

        await enableShowPhotosOnMapWithCrashBreaker();
      } finally {
        isUpdatingPhotoSettingRef.current = false;
        setIsUpdatingPhotoSetting(false);
      }
    },
    [enableShowPhotosOnMapWithCrashBreaker],
  );

  /**
   * 保存済みの写真表示ONは、MapViewの準備完了後に初めて復元する。
   * 起動直後のネイティブ地図初期化中に写真マーカーを載せてクラッシュする経路を避けるため。
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
    enableShowPhotosOnMapWithCrashBreaker()
      .catch((error: unknown) => {
        console.warn('Failed to restore photo map overlay:', error);
        setShowPhotosOnMap(false);
        setSetting(SHOW_PHOTOS_ON_MAP_SETTING_KEY, false).catch(() => undefined);
        setSetting(SHOW_PHOTOS_ON_MAP_ENABLE_PENDING_SETTING_KEY, false).catch(() => undefined);
      })
      .finally(() => {
        isUpdatingPhotoSettingRef.current = false;
        setIsUpdatingPhotoSetting(false);
      });
  }, [enableShowPhotosOnMapWithCrashBreaker, isMapReady, isReady, shouldRestorePhotosOnMapAfterMapReady]);

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
    photoErrorMessage,
    initializePhotoSetting,
    updateShowPhotosOnMap,
  };
}
