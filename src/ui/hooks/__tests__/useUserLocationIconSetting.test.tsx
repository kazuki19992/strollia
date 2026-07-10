import { act, renderHook } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';

import { useUserLocationIconSetting, UseUserLocationIconSettingResult } from '@/ui/hooks/useUserLocationIconSetting';
import {
  resolveCustomIconReference,
  isLegacyCustomIconReference,
  deleteManagedCustomIcon,
} from '@/features/customization/customIconStorage';
import { replaceCustomIconSelection } from '@/features/customization/customIconSelection';
import { setSetting, setSettings } from '@/features/settings/settingsRepository';
import type { PremiumAccessState } from '@/features/premium/revenueCatAccess';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock('@/features/customization/customIconStorage', () => ({
  resolveCustomIconReference: jest.fn().mockResolvedValue(null),
  isLegacyCustomIconReference: jest.fn((reference: string) => /^[A-Za-z][A-Za-z\d+.-]*:\/\//.test(reference)),
  deleteManagedCustomIcon: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/features/customization/customIconSelection', () => ({
  replaceCustomIconSelection: jest.fn(),
}));

jest.mock('@/features/settings/settingsRepository', () => ({
  setSetting: jest.fn().mockResolvedValue(undefined),
  setSettings: jest.fn().mockResolvedValue(undefined),
}));

/** テスト用の Plus 有効な状態。 */
const PLUS_ACTIVE_STATE: PremiumAccessState = { isPlusActive: true, entitlementId: 'strollia_plus' };
/** テスト用の Plus 無効な状態。 */
const PLUS_INACTIVE_STATE: PremiumAccessState = { isPlusActive: false, entitlementId: 'strollia_plus' };

describe('現在地アイコン・カラープリセット設定フック useUserLocationIconSetting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (resolveCustomIconReference as jest.Mock).mockResolvedValue(null);
  });

  describe('初期状態', () => {
    it('初期 selectedAppColorPresetId は matcha になる', () => {
      const { result } = renderHook(() => useUserLocationIconSetting());

      expect(result.current.selectedAppColorPresetId).toBe('matcha');
    });

    it('初期 selectedUserLocationIconId は default になる', () => {
      const { result } = renderHook(() => useUserLocationIconSetting());

      expect(result.current.selectedUserLocationIconId).toBe('default');
    });

    it('初期 customIconImageUri は null になる', () => {
      const { result } = renderHook(() => useUserLocationIconSetting());

      expect(result.current.customIconImageUri).toBeNull();
    });

    it('初期 hasCustomIconImageLoadFailed は false になる', () => {
      const { result } = renderHook(() => useUserLocationIconSetting());

      expect(result.current.hasCustomIconImageLoadFailed).toBe(false);
    });
  });

  describe('handleCustomIconLoadError', () => {
    it('呼び出すと hasCustomIconImageLoadFailed が true になる', () => {
      const { result } = renderHook(() => useUserLocationIconSetting());

      act(() => {
        result.current.handleCustomIconLoadError();
      });

      expect(result.current.hasCustomIconImageLoadFailed).toBe(true);
    });
  });

  describe('updateAppColorPreset', () => {
    it('プリセットIDを設定すると selectedAppColorPresetId が更新される', () => {
      const { result } = renderHook(() => useUserLocationIconSetting());

      act(() => {
        result.current.updateAppColorPreset('sakura');
      });

      expect(result.current.selectedAppColorPresetId).toBe('sakura');
    });

    it('プリセット変更時に setSetting が呼ばれる', () => {
      const { result } = renderHook(() => useUserLocationIconSetting());

      act(() => {
        result.current.updateAppColorPreset('umi');
      });

      expect(setSetting).toHaveBeenCalledWith('appColorPresetId', 'umi');
    });

    it('プリセット変更時に selectionAsync haptic が呼ばれる', () => {
      const { result } = renderHook(() => useUserLocationIconSetting());

      act(() => {
        result.current.updateAppColorPreset('tomato');
      });

      expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateUserLocationIcon', () => {
    it('Plus 不要アイコンを選択すると selectedUserLocationIconId が更新される', () => {
      const { result } = renderHook(() => useUserLocationIconSetting());

      act(() => {
        result.current.updateUserLocationIcon('default', PLUS_ACTIVE_STATE, jest.fn());
      });

      expect(result.current.selectedUserLocationIconId).toBe('default');
    });

    it('Plus 専用アイコンを Plus 未加入で選択すると showPremiumLockedMessage が呼ばれる', () => {
      const { result } = renderHook(() => useUserLocationIconSetting());
      const showPremiumLockedMessage = jest.fn();

      act(() => {
        result.current.updateUserLocationIcon('walker', PLUS_INACTIVE_STATE, showPremiumLockedMessage);
      });

      expect(showPremiumLockedMessage).toHaveBeenCalledWith('さんぽ');
      expect(result.current.selectedUserLocationIconId).toBe('default'); // 変わらない
    });

    it('Plus 専用アイコンを Plus 加入済みで選択すると selectedUserLocationIconId が更新される', () => {
      const { result } = renderHook(() => useUserLocationIconSetting());

      act(() => {
        result.current.updateUserLocationIcon('walker', PLUS_ACTIVE_STATE, jest.fn());
      });

      expect(result.current.selectedUserLocationIconId).toBe('walker');
    });

    it('アイコン変更時に setSetting が呼ばれる', () => {
      const { result } = renderHook(() => useUserLocationIconSetting());

      act(() => {
        result.current.updateUserLocationIcon('compass', PLUS_ACTIVE_STATE, jest.fn());
      });

      expect(setSetting).toHaveBeenCalledWith('userLocationIcon', 'compass');
    });
  });

  describe('applySavedIconSettings', () => {
    it('有効なアイコンIDを渡すと selectedUserLocationIconId が設定される', async () => {
      const { result } = renderHook(() => useUserLocationIconSetting());

      (resolveCustomIconReference as jest.Mock).mockResolvedValue({ reference: '', uri: 'file://icon.jpg', migrated: false });

      await act(async () => {
        await result.current.applySavedIconSettings({
          savedUserLocationIcon: 'walker',
          savedAppColorPresetId: 'sakura',
          savedCustomIconImageUri: '',
          signal: new AbortController().signal,
        });
      });

      expect(result.current.selectedUserLocationIconId).toBe('walker');
    });

    it('有効なプリセットIDを渡すと selectedAppColorPresetId が設定される', async () => {
      const { result } = renderHook(() => useUserLocationIconSetting());

      (resolveCustomIconReference as jest.Mock).mockResolvedValue(null);

      await act(async () => {
        await result.current.applySavedIconSettings({
          savedUserLocationIcon: 'default',
          savedAppColorPresetId: 'sakura',
          savedCustomIconImageUri: '',
          signal: new AbortController().signal,
        });
      });

      expect(result.current.selectedAppColorPresetId).toBe('sakura');
    });

    it('無効なプリセットIDを渡すと DEFAULT（matcha）へフォールバックする', async () => {
      const { result } = renderHook(() => useUserLocationIconSetting());

      (resolveCustomIconReference as jest.Mock).mockResolvedValue(null);

      await act(async () => {
        await result.current.applySavedIconSettings({
          savedUserLocationIcon: 'default',
          savedAppColorPresetId: 'unknown_preset',
          savedCustomIconImageUri: '',
          signal: new AbortController().signal,
        });
      });

      expect(result.current.selectedAppColorPresetId).toBe('matcha');
    });

    it('カスタムアイコン参照が解決できたとき customIconImageUri が設定される', async () => {
      const { result } = renderHook(() => useUserLocationIconSetting());

      (resolveCustomIconReference as jest.Mock).mockResolvedValue({
        reference: 'managed:icon.jpg',
        uri: 'file:///managed/icon.jpg',
        migrated: false,
      });

      await act(async () => {
        await result.current.applySavedIconSettings({
          savedUserLocationIcon: 'custom',
          savedAppColorPresetId: 'matcha',
          savedCustomIconImageUri: 'managed:icon.jpg',
          signal: new AbortController().signal,
        });
      });

      expect(result.current.customIconImageUri).toBe('file:///managed/icon.jpg');
    });

    it('カスタムアイコン参照が null かつアイコンが custom のとき OS標準へリセットする', async () => {
      const { result } = renderHook(() => useUserLocationIconSetting());

      (resolveCustomIconReference as jest.Mock).mockResolvedValue(null);
      (isLegacyCustomIconReference as jest.Mock).mockReturnValue(false);

      await act(async () => {
        await result.current.applySavedIconSettings({
          savedUserLocationIcon: 'custom',
          savedAppColorPresetId: 'matcha',
          savedCustomIconImageUri: 'managed:missing.jpg',
          signal: new AbortController().signal,
        });
      });

      expect(result.current.selectedUserLocationIconId).toBe('default');
      expect(result.current.customIconImageUri).toBeNull();
      expect(setSettings).toHaveBeenCalledWith([
        { key: 'customIconImageUri', value: '' },
        { key: 'userLocationIcon', value: 'default' },
      ]);
    });

    it('旧URI形式のカスタムアイコンが消失した場合はアラートを表示する', async () => {
      const { result } = renderHook(() => useUserLocationIconSetting());
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

      (resolveCustomIconReference as jest.Mock).mockResolvedValue(null);
      (isLegacyCustomIconReference as jest.Mock).mockReturnValue(true);

      await act(async () => {
        await result.current.applySavedIconSettings({
          savedUserLocationIcon: 'custom',
          savedAppColorPresetId: 'matcha',
          savedCustomIconImageUri: 'file:///old/icon.jpg',
          signal: new AbortController().signal,
        });
      });

      expect(alertSpy).toHaveBeenCalledWith('カスタムアイコンを読み込めませんでした', expect.any(String));
      alertSpy.mockRestore();
    });

    it('移行が必要なカスタムアイコンは新参照へ更新する', async () => {
      const { result } = renderHook(() => useUserLocationIconSetting());

      (resolveCustomIconReference as jest.Mock).mockResolvedValue({
        reference: 'managed:migrated.jpg',
        uri: 'file:///managed/migrated.jpg',
        migrated: true,
      });

      await act(async () => {
        await result.current.applySavedIconSettings({
          savedUserLocationIcon: 'custom',
          savedAppColorPresetId: 'matcha',
          savedCustomIconImageUri: 'file:///old/icon.jpg',
          signal: new AbortController().signal,
        });
      });

      expect(result.current.customIconImageUri).toBe('file:///managed/migrated.jpg');
      expect(setSetting).toHaveBeenCalledWith('customIconImageUri', 'managed:migrated.jpg');
    });

    it('AbortSignal が発火した場合は state 更新をスキップする', async () => {
      const { result } = renderHook(() => useUserLocationIconSetting());
      const controller = new AbortController();

      // resolveCustomIconReference の前に signal を中断する
      (resolveCustomIconReference as jest.Mock).mockImplementation(async () => {
        controller.abort();
        return { reference: 'managed:icon.jpg', uri: 'file:///icon.jpg', migrated: false };
      });

      await act(async () => {
        await result.current.applySavedIconSettings({
          savedUserLocationIcon: 'custom',
          savedAppColorPresetId: 'matcha',
          savedCustomIconImageUri: 'managed:icon.jpg',
          signal: controller.signal,
        });
      });

      // 中断後は customIconImageUri が null のまま
      expect(result.current.customIconImageUri).toBeNull();
    });

    it('resolve中に abort された場合、保存設定が selectedUserLocationIconId / selectedAppColorPresetId に反映されない', async () => {
      // 修正前は resolveCustomIconReference の await 前に setState を呼んでいたため、
      // abort 後も保存設定が state に残っていた。修正後は resolve 完了後にのみ setState を呼ぶ。
      const { result } = renderHook(() => useUserLocationIconSetting());
      const controller = new AbortController();

      // resolve を pending のまま保持し、in-flight 中に abort されたことを再現する。
      // resolve完了前に setState する回帰が入っても検出できるよう、実際に非同期を挟む。
      let resolveReference: (value: null) => void = () => undefined;
      (resolveCustomIconReference as jest.Mock).mockImplementation(
        () =>
          new Promise<null>((resolve) => {
            resolveReference = resolve;
          }),
      );

      await act(async () => {
        const promise = result.current.applySavedIconSettings({
          savedUserLocationIcon: 'walker',
          savedAppColorPresetId: 'sakura',
          savedCustomIconImageUri: '',
          signal: controller.signal,
        });
        // pending 中に abort し、その後 resolve して applySavedIconSettings を完了させる
        controller.abort();
        resolveReference(null);
        await promise;
      });

      // abort されたため保存設定が state に反映されない（初期値のまま）
      expect(result.current.selectedUserLocationIconId).toBe('default');
      expect(result.current.selectedAppColorPresetId).toBe('matcha');
    });
  });

  describe('pickCustomIcon', () => {
    it('権限が拒否された場合はアラートを表示する', async () => {
      const { result } = renderHook(() => useUserLocationIconSetting());
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });

      await act(async () => {
        await result.current.pickCustomIcon();
      });

      expect(alertSpy).toHaveBeenCalledWith('権限が必要です', expect.any(String));
      alertSpy.mockRestore();
    });

    it('画像選択がキャンセルされた場合は state が変わらない', async () => {
      const { result } = renderHook(() => useUserLocationIconSetting());

      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: [] });

      await act(async () => {
        await result.current.pickCustomIcon();
      });

      expect(result.current.selectedUserLocationIconId).toBe('default');
      expect(result.current.customIconImageUri).toBeNull();
    });

    it('画像選択が成功すると custom アイコンが設定される', async () => {
      const { result } = renderHook(() => useUserLocationIconSetting());

      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///picked/icon.jpg' }],
      });
      (replaceCustomIconSelection as jest.Mock).mockResolvedValue({
        reference: 'managed:new.jpg',
        uri: 'file:///managed/new.jpg',
      });

      await act(async () => {
        await result.current.pickCustomIcon();
      });

      expect(result.current.selectedUserLocationIconId).toBe('custom');
      expect(result.current.customIconImageUri).toBe('file:///managed/new.jpg');
      expect(result.current.hasCustomIconImageLoadFailed).toBe(false);
    });
  });
});
