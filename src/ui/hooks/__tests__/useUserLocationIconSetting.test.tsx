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

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

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

type HookProbeProps = {
  /** フックの戻り値をテストへ渡すコールバック。 */
  onResult: (result: UseUserLocationIconSettingResult) => void;
};

/** フックを実行するための最小コンポーネント。 */
function HookProbe({ onResult }: HookProbeProps) {
  const result = useUserLocationIconSetting();
  onResult(result);
  return null;
}

describe('現在地アイコン・カラープリセット設定フック useUserLocationIconSetting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (resolveCustomIconReference as jest.Mock).mockResolvedValue(null);
  });

  describe('初期状態', () => {
    it('初期 selectedAppColorPresetId は matcha になる', () => {
      let result: UseUserLocationIconSettingResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.selectedAppColorPresetId).toBe('matcha');
    });

    it('初期 selectedUserLocationIconId は default になる', () => {
      let result: UseUserLocationIconSettingResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.selectedUserLocationIconId).toBe('default');
    });

    it('初期 customIconImageUri は null になる', () => {
      let result: UseUserLocationIconSettingResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.customIconImageUri).toBeNull();
    });

    it('初期 hasCustomIconImageLoadFailed は false になる', () => {
      let result: UseUserLocationIconSettingResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      expect(result!.hasCustomIconImageLoadFailed).toBe(false);
    });
  });

  describe('handleCustomIconLoadError', () => {
    it('呼び出すと hasCustomIconImageLoadFailed が true になる', () => {
      let result: UseUserLocationIconSettingResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.handleCustomIconLoadError();
      });

      expect(result!.hasCustomIconImageLoadFailed).toBe(true);
    });
  });

  describe('updateAppColorPreset', () => {
    it('プリセットIDを設定すると selectedAppColorPresetId が更新される', () => {
      let result: UseUserLocationIconSettingResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.updateAppColorPreset('sakura');
      });

      expect(result!.selectedAppColorPresetId).toBe('sakura');
    });

    it('プリセット変更時に setSetting が呼ばれる', () => {
      let result: UseUserLocationIconSettingResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.updateAppColorPreset('umi');
      });

      expect(setSetting).toHaveBeenCalledWith('appColorPresetId', 'umi');
    });

    it('プリセット変更時に selectionAsync haptic が呼ばれる', () => {
      let result: UseUserLocationIconSettingResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.updateAppColorPreset('tomato');
      });

      expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateUserLocationIcon', () => {
    it('Plus 不要アイコンを選択すると selectedUserLocationIconId が更新される', () => {
      let result: UseUserLocationIconSettingResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.updateUserLocationIcon('default', PLUS_ACTIVE_STATE, jest.fn());
      });

      expect(result!.selectedUserLocationIconId).toBe('default');
    });

    it('Plus 専用アイコンを Plus 未加入で選択すると showPremiumLockedMessage が呼ばれる', () => {
      let result: UseUserLocationIconSettingResult | undefined;
      const showPremiumLockedMessage = jest.fn();

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.updateUserLocationIcon('walker', PLUS_INACTIVE_STATE, showPremiumLockedMessage);
      });

      expect(showPremiumLockedMessage).toHaveBeenCalledWith('さんぽ');
      expect(result!.selectedUserLocationIconId).toBe('default'); // 変わらない
    });

    it('Plus 専用アイコンを Plus 加入済みで選択すると selectedUserLocationIconId が更新される', () => {
      let result: UseUserLocationIconSettingResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.updateUserLocationIcon('walker', PLUS_ACTIVE_STATE, jest.fn());
      });

      expect(result!.selectedUserLocationIconId).toBe('walker');
    });

    it('アイコン変更時に setSetting が呼ばれる', () => {
      let result: UseUserLocationIconSettingResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      act(() => {
        result!.updateUserLocationIcon('compass', PLUS_ACTIVE_STATE, jest.fn());
      });

      expect(setSetting).toHaveBeenCalledWith('userLocationIcon', 'compass');
    });
  });

  describe('applySavedIconSettings', () => {
    it('有効なアイコンIDを渡すと selectedUserLocationIconId が設定される', async () => {
      let result: UseUserLocationIconSettingResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      (resolveCustomIconReference as jest.Mock).mockResolvedValue({ reference: '', uri: 'file://icon.jpg', migrated: false });

      await act(async () => {
        await result!.applySavedIconSettings({
          savedUserLocationIcon: 'walker',
          savedAppColorPresetId: 'sakura',
          savedCustomIconImageUri: '',
          signal: new AbortController().signal,
        });
      });

      expect(result!.selectedUserLocationIconId).toBe('walker');
    });

    it('有効なプリセットIDを渡すと selectedAppColorPresetId が設定される', async () => {
      let result: UseUserLocationIconSettingResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      (resolveCustomIconReference as jest.Mock).mockResolvedValue(null);

      await act(async () => {
        await result!.applySavedIconSettings({
          savedUserLocationIcon: 'default',
          savedAppColorPresetId: 'sakura',
          savedCustomIconImageUri: '',
          signal: new AbortController().signal,
        });
      });

      expect(result!.selectedAppColorPresetId).toBe('sakura');
    });

    it('無効なプリセットIDを渡すと DEFAULT（matcha）へフォールバックする', async () => {
      let result: UseUserLocationIconSettingResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      (resolveCustomIconReference as jest.Mock).mockResolvedValue(null);

      await act(async () => {
        await result!.applySavedIconSettings({
          savedUserLocationIcon: 'default',
          savedAppColorPresetId: 'unknown_preset',
          savedCustomIconImageUri: '',
          signal: new AbortController().signal,
        });
      });

      expect(result!.selectedAppColorPresetId).toBe('matcha');
    });

    it('カスタムアイコン参照が解決できたとき customIconImageUri が設定される', async () => {
      let result: UseUserLocationIconSettingResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      (resolveCustomIconReference as jest.Mock).mockResolvedValue({
        reference: 'managed:icon.jpg',
        uri: 'file:///managed/icon.jpg',
        migrated: false,
      });

      await act(async () => {
        await result!.applySavedIconSettings({
          savedUserLocationIcon: 'custom',
          savedAppColorPresetId: 'matcha',
          savedCustomIconImageUri: 'managed:icon.jpg',
          signal: new AbortController().signal,
        });
      });

      expect(result!.customIconImageUri).toBe('file:///managed/icon.jpg');
    });

    it('カスタムアイコン参照が null かつアイコンが custom のとき OS標準へリセットする', async () => {
      let result: UseUserLocationIconSettingResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      (resolveCustomIconReference as jest.Mock).mockResolvedValue(null);
      (isLegacyCustomIconReference as jest.Mock).mockReturnValue(false);

      await act(async () => {
        await result!.applySavedIconSettings({
          savedUserLocationIcon: 'custom',
          savedAppColorPresetId: 'matcha',
          savedCustomIconImageUri: 'managed:missing.jpg',
          signal: new AbortController().signal,
        });
      });

      expect(result!.selectedUserLocationIconId).toBe('default');
      expect(result!.customIconImageUri).toBeNull();
      expect(setSettings).toHaveBeenCalledWith([
        { key: 'customIconImageUri', value: '' },
        { key: 'userLocationIcon', value: 'default' },
      ]);
    });

    it('旧URI形式のカスタムアイコンが消失した場合はアラートを表示する', async () => {
      let result: UseUserLocationIconSettingResult | undefined;
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      (resolveCustomIconReference as jest.Mock).mockResolvedValue(null);
      (isLegacyCustomIconReference as jest.Mock).mockReturnValue(true);

      await act(async () => {
        await result!.applySavedIconSettings({
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
      let result: UseUserLocationIconSettingResult | undefined;

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      (resolveCustomIconReference as jest.Mock).mockResolvedValue({
        reference: 'managed:migrated.jpg',
        uri: 'file:///managed/migrated.jpg',
        migrated: true,
      });

      await act(async () => {
        await result!.applySavedIconSettings({
          savedUserLocationIcon: 'custom',
          savedAppColorPresetId: 'matcha',
          savedCustomIconImageUri: 'file:///old/icon.jpg',
          signal: new AbortController().signal,
        });
      });

      expect(result!.customIconImageUri).toBe('file:///managed/migrated.jpg');
      expect(setSetting).toHaveBeenCalledWith('customIconImageUri', 'managed:migrated.jpg');
    });

    it('AbortSignal が発火した場合は state 更新をスキップする', async () => {
      let result: UseUserLocationIconSettingResult | undefined;
      const controller = new AbortController();

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      // resolveCustomIconReference の前に signal を中断する
      (resolveCustomIconReference as jest.Mock).mockImplementation(async () => {
        controller.abort();
        return { reference: 'managed:icon.jpg', uri: 'file:///icon.jpg', migrated: false };
      });

      await act(async () => {
        await result!.applySavedIconSettings({
          savedUserLocationIcon: 'custom',
          savedAppColorPresetId: 'matcha',
          savedCustomIconImageUri: 'managed:icon.jpg',
          signal: controller.signal,
        });
      });

      // 中断後は customIconImageUri が null のまま
      expect(result!.customIconImageUri).toBeNull();
    });

    it('resolve中に abort された場合、保存設定が selectedUserLocationIconId / selectedAppColorPresetId に反映されない', async () => {
      // 修正前は resolveCustomIconReference の await 前に setState を呼んでいたため、
      // abort 後も保存設定が state に残っていた。修正後は resolve 完了後にのみ setState を呼ぶ。
      let result: UseUserLocationIconSettingResult | undefined;
      const controller = new AbortController();

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      // resolve 中（await 中）に abort する
      (resolveCustomIconReference as jest.Mock).mockImplementation(async () => {
        controller.abort();
        return null;
      });

      await act(async () => {
        await result!.applySavedIconSettings({
          savedUserLocationIcon: 'walker',
          savedAppColorPresetId: 'sakura',
          savedCustomIconImageUri: '',
          signal: controller.signal,
        });
      });

      // abort されたため保存設定が state に反映されない（初期値のまま）
      expect(result!.selectedUserLocationIconId).toBe('default');
      expect(result!.selectedAppColorPresetId).toBe('matcha');
    });
  });

  describe('pickCustomIcon', () => {
    it('権限が拒否された場合はアラートを表示する', async () => {
      let result: UseUserLocationIconSettingResult | undefined;
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false });

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.pickCustomIcon();
      });

      expect(alertSpy).toHaveBeenCalledWith('権限が必要です', expect.any(String));
      alertSpy.mockRestore();
    });

    it('画像選択がキャンセルされた場合は state が変わらない', async () => {
      let result: UseUserLocationIconSettingResult | undefined;

      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: [] });

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.pickCustomIcon();
      });

      expect(result!.selectedUserLocationIconId).toBe('default');
      expect(result!.customIconImageUri).toBeNull();
    });

    it('画像選択が成功すると custom アイコンが設定される', async () => {
      let result: UseUserLocationIconSettingResult | undefined;

      (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true });
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///picked/icon.jpg' }],
      });
      (replaceCustomIconSelection as jest.Mock).mockResolvedValue({
        reference: 'managed:new.jpg',
        uri: 'file:///managed/new.jpg',
      });

      act(() => {
        ReactTestRenderer.create(<HookProbe onResult={(r) => (result = r)} />);
      });

      await act(async () => {
        await result!.pickCustomIcon();
      });

      expect(result!.selectedUserLocationIconId).toBe('custom');
      expect(result!.customIconImageUri).toBe('file:///managed/new.jpg');
      expect(result!.hasCustomIconImageLoadFailed).toBe(false);
    });
  });
});
