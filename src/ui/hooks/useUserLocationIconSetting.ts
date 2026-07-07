import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { useCallback, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';

import { AppColorPresetId, DEFAULT_APP_COLOR_PRESET_ID, isAppColorPresetId } from '@/features/customization/colorPresets';
import {
  DEFAULT_USER_LOCATION_ICON_ID,
  getUserLocationIconOption,
  UserLocationIconId,
} from '@/features/customization/customizationOptions';
import {
  deleteManagedCustomIcon,
  isLegacyCustomIconReference,
  resolveCustomIconReference,
} from '@/features/customization/customIconStorage';
import { replaceCustomIconSelection } from '@/features/customization/customIconSelection';
import { setSetting, setSettings } from '@/features/settings/settingsRepository';
import type { PremiumAccessState } from '@/features/premium/revenueCatAccess';

/** 現在地アイコン設定をSQLiteへ保存するキー。 */
export const USER_LOCATION_ICON_SETTING_KEY = 'userLocationIcon';
/** アプリカラープリセット設定をSQLiteへ保存するキー。 */
export const APP_COLOR_PRESET_SETTING_KEY = 'appColorPresetId';
/** カスタムアイコン画像URIをSQLiteへ保存するキー。 */
export const CUSTOM_ICON_IMAGE_URI_SETTING_KEY = 'customIconImageUri';

/** `useUserLocationIconSetting` の初期化引数。 */
export type ApplySavedIconSettingsParams = {
  /** SQLiteから読み込んだ現在地アイコンID文字列。 */
  savedUserLocationIcon: string;
  /** SQLiteから読み込んだカラープリセットID文字列。 */
  savedAppColorPresetId: string;
  /** SQLiteから読み込んだカスタムアイコン画像URI文字列。 */
  savedCustomIconImageUri: string;
  /** 中断シグナル。 */
  signal: AbortSignal;
};

/** `useUserLocationIconSetting` が返す状態と操作の型。 */
export type UseUserLocationIconSettingResult = {
  /** 選択中のアプリカラープリセットID。 */
  selectedAppColorPresetId: AppColorPresetId;
  /** 選択中の現在地アイコンID。 */
  selectedUserLocationIconId: UserLocationIconId;
  /** カスタムアイコンの永続参照文字列。空文字は未設定。 */
  customIconReference: string;
  /** カスタムアイコンの表示用URI。未設定またはロード前はnull。 */
  customIconImageUri: string | null;
  /** カスタムアイコン画像の読み込みに失敗したかどうか。 */
  hasCustomIconImageLoadFailed: boolean;
  /**
   * 起動時 effect から呼ぶ初期化関数。
   * SQLiteから読んだ設定値を受け取り、カスタムアイコン移行・リセットを含む解決処理を実行する。
   * App.tsx の初期化 effect から同じ位置・同じ順序で呼ぶ。
   */
  applySavedIconSettings: (params: ApplySavedIconSettingsParams) => Promise<void>;
  /**
   * アプリカラープリセットを保存して即時反映する。
   *
   * @param presetId - 保存するプリセットID。
   */
  updateAppColorPreset: (presetId: AppColorPresetId) => void;
  /** フォトライブラリからカスタムアイコン画像を選択して保存する。 */
  pickCustomIcon: () => Promise<void>;
  /** 画像読込失敗時は保存設定を維持し、このセッションだけOS標準表示へ切り替える。 */
  handleCustomIconLoadError: () => void;
  /**
   * 現在地アイコンを保存して地図へ即時反映する。
   *
   * @param iconId - 保存する現在地アイコンID。
   * @param premiumAccessState - 最新のPlus利用状態。Plus専用アイコンのガードに使う。
   * @param showPremiumLockedMessage - Plus未加入時に有料項目を選んだ場合の案内を表示する。
   */
  updateUserLocationIcon: (
    iconId: UserLocationIconId,
    premiumAccessState: PremiumAccessState,
    showPremiumLockedMessage: (label: string) => void,
  ) => void;
};

/**
 * 現在地アイコンとカラープリセット設定を束ねるカスタムフック。
 *
 * カラープリセットとアイコン設定は初期化 effect で一緒に SQLite から読み込まれ、
 * カスタムアイコンの解決処理もまたアイコン設定と密接に結合しているため、
 * 1フックにまとめて責務を集約する。
 *
 * ユーザー向け挙動は App.tsx のそれと完全に同一に保つ。
 */
export function useUserLocationIconSetting(): UseUserLocationIconSettingResult {
  /** 軽い選択操作に使うタプティックを鳴らす。 */
  function triggerSelectionHaptic(): void {
    Haptics.selectionAsync().catch(() => undefined);
  }

  const [selectedAppColorPresetId, setSelectedAppColorPresetId] = useState<AppColorPresetId>(DEFAULT_APP_COLOR_PRESET_ID);
  const [selectedUserLocationIconId, setSelectedUserLocationIconId] = useState<UserLocationIconId>(DEFAULT_USER_LOCATION_ICON_ID);
  const [customIconReference, setCustomIconReference] = useState('');
  const [customIconImageUri, setCustomIconImageUri] = useState<string | null>(null);
  const [hasCustomIconImageLoadFailed, setHasCustomIconImageLoadFailed] = useState(false);
  const isPickingCustomIconRef = useRef(false);

  /**
   * 起動時に SQLite から読んだアイコン・カラー設定を解決してフック state へ反映する。
   * カスタムアイコン移行・参照消失時のリセットを含む。
   * App.tsx の初期化 effect から同じ位置・同じ順序で呼ぶ。
   *
   * 4つの初期 setState は resolveCustomIconReference の await が完了し signal.aborted を
   * 確認した後に行う。abort されたまま state を反映すると、古い設定が画面に残る問題がある。
   * 正常起動時は resolve 完了後(数十ms程度後)に UI へ反映される点が従来と異なる。
   */
  const applySavedIconSettings = useCallback(
    async ({
      savedUserLocationIcon,
      savedAppColorPresetId,
      savedCustomIconImageUri,
      signal,
    }: ApplySavedIconSettingsParams): Promise<void> => {
      const resolvedCustomIcon = await resolveCustomIconReference(savedCustomIconImageUri).catch((error: unknown) => {
        console.warn('Failed to resolve custom icon reference:', error);
        return undefined;
      });
      if (signal.aborted) {
        if (resolvedCustomIcon?.migrated) {
          await deleteManagedCustomIcon(resolvedCustomIcon.reference).catch(() => undefined);
        }
        return;
      }

      // resolve 完了後かつ abort でないことを確認してから保存設定を state へ反映する。
      setSelectedUserLocationIconId(getUserLocationIconOption(savedUserLocationIcon as UserLocationIconId).id);
      setSelectedAppColorPresetId(isAppColorPresetId(savedAppColorPresetId) ? savedAppColorPresetId : DEFAULT_APP_COLOR_PRESET_ID);
      setCustomIconReference(savedCustomIconImageUri);
      setHasCustomIconImageLoadFailed(false);
      if (resolvedCustomIcon === null && savedUserLocationIcon === 'custom') {
        let didPersistReset = false;
        try {
          await setSettings([
            { key: CUSTOM_ICON_IMAGE_URI_SETTING_KEY, value: '' },
            { key: USER_LOCATION_ICON_SETTING_KEY, value: DEFAULT_USER_LOCATION_ICON_ID },
          ]);
          didPersistReset = true;
        } catch (error: unknown) {
          console.warn('Failed to reset missing custom icon reference:', error);
        }
        if (signal.aborted) return;
        setSelectedUserLocationIconId(DEFAULT_USER_LOCATION_ICON_ID);
        setCustomIconReference('');
        setCustomIconImageUri(null);
        if (didPersistReset && isLegacyCustomIconReference(savedCustomIconImageUri)) {
          Alert.alert(
            'カスタムアイコンを読み込めませんでした',
            '保存されていた画像を読み込めなかったため、現在地アイコンをOS標準に戻しました。カスタムアイコンを使用する場合は、設定画面から画像を再設定してください。',
          );
        }
      } else if (resolvedCustomIcon?.migrated) {
        try {
          await setSetting(CUSTOM_ICON_IMAGE_URI_SETTING_KEY, resolvedCustomIcon.reference);
          if (signal.aborted) return;
          setCustomIconReference(resolvedCustomIcon.reference);
          setCustomIconImageUri(resolvedCustomIcon.uri);
        } catch (error: unknown) {
          await deleteManagedCustomIcon(resolvedCustomIcon.reference).catch((cleanupError: unknown) => {
            console.warn('Failed to delete unpersisted migrated custom icon:', cleanupError);
          });
          if (signal.aborted) return;
          console.warn('Failed to persist migrated custom icon reference:', error);
          setCustomIconImageUri(savedCustomIconImageUri || null);
        }
      } else {
        setCustomIconImageUri(resolvedCustomIcon?.uri ?? null);
      }
    },
    [],
  );

  /**
   * アプリカラープリセットを保存して即時反映する。
   *
   * @param presetId - 保存するプリセットID。
   */
  const updateAppColorPreset = useCallback((presetId: AppColorPresetId): void => {
    triggerSelectionHaptic();
    setSelectedAppColorPresetId(presetId);
    setSetting(APP_COLOR_PRESET_SETTING_KEY, presetId).catch((error: unknown) => {
      Alert.alert('設定保存失敗', error instanceof Error ? error.message : 'アプリカラーを保存できませんでした。');
    });
  }, []);

  /**
   * フォトライブラリからカスタムアイコン画像を選択して保存する。
   * システムの正方形クロップUIを使用する。
   */
  const pickCustomIcon = useCallback(async (): Promise<void> => {
    if (isPickingCustomIconRef.current) {
      return;
    }

    isPickingCustomIconRef.current = true;
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('権限が必要です', 'カスタムアイコンを設定するには写真へのアクセス権限が必要です。');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (result.canceled) {
        return;
      }

      const replacement = await replaceCustomIconSelection({
        sourceUri: result.assets[0].uri,
        previousReference: customIconReference,
        persistSelection: async (reference) => {
          await setSettings([
            { key: CUSTOM_ICON_IMAGE_URI_SETTING_KEY, value: reference },
            { key: USER_LOCATION_ICON_SETTING_KEY, value: 'custom' },
          ]);
        },
      });
      setCustomIconReference(replacement.reference);
      setCustomIconImageUri(replacement.uri);
      setSelectedUserLocationIconId('custom');
      setHasCustomIconImageLoadFailed(false);
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : 'カスタムアイコンを保存できませんでした。';
      const message = customIconReference
        ? `新しい画像を設定できませんでした。以前の設定は保持されています。\n${detail}`
        : `カスタムアイコンを設定できませんでした。\n${detail}`;
      Alert.alert('設定失敗', message);
    } finally {
      isPickingCustomIconRef.current = false;
    }
  }, [customIconReference]);

  /** 画像読込失敗時は保存設定を維持し、このセッションだけOS標準表示へ切り替える。 */
  const handleCustomIconLoadError = useCallback((): void => {
    setHasCustomIconImageLoadFailed(true);
  }, []);

  /**
   * 現在地アイコンを保存して地図へ即時反映する。
   *
   * @param iconId - 保存する現在地アイコンID。
   * @param premiumAccessState - 最新のPlus利用状態。
   * @param showPremiumLockedMessage - Plus未加入時に有料項目を選んだ場合の案内を表示する。
   */
  const updateUserLocationIcon = useCallback(
    (iconId: UserLocationIconId, premiumAccessState: PremiumAccessState, showPremiumLockedMessage: (label: string) => void): void => {
      const option = getUserLocationIconOption(iconId);

      if (option.premium && !premiumAccessState.isPlusActive) {
        showPremiumLockedMessage(option.label);
        return;
      }

      if (iconId === 'custom') {
        pickCustomIcon().catch((error: unknown) => {
          console.warn('pickCustomIcon failed:', error);
        });
        return;
      }

      triggerSelectionHaptic();
      setSelectedUserLocationIconId(option.id);
      setSetting(USER_LOCATION_ICON_SETTING_KEY, option.id).catch((error: unknown) => {
        Alert.alert('設定保存失敗', error instanceof Error ? error.message : '現在地アイコンを保存できませんでした。');
      });
    },
    [pickCustomIcon],
  );

  return {
    selectedAppColorPresetId,
    selectedUserLocationIconId,
    customIconReference,
    customIconImageUri,
    hasCustomIconImageLoadFailed,
    applySavedIconSettings,
    updateAppColorPreset,
    pickCustomIcon,
    handleCustomIconLoadError,
    updateUserLocationIcon,
  };
}
