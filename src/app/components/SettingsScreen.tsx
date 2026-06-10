import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Alert, Modal, Platform, Pressable, SafeAreaView, ScrollView, Switch, Text, View } from 'react-native';
import type { MapType } from 'react-native-maps';
import { PlusAdImage } from './PlusAdImage';

import {
  USER_LOCATION_ICON_OPTIONS,
  UserLocationIconId,
} from '../../features/customization/customizationOptions';
import {
  APP_COLOR_PRESETS,
  AppColorPresetId,
  getAppColorPreset,
} from '../../features/customization/colorPresets';
import { getDefaultPremiumAccessState, PremiumOfferingSummary } from '../../features/premium/revenueCatAccess';
import { AppTheme } from '../../theme/theme';
import { AutoStartStatus } from '../appTypes';
import { AppStyles } from '../appStyles';
import { ActionPill } from './ActionPill';
import { AppScreenHeader } from './AppScreenHeader';
import { DescriptionText } from './DescriptionText';
import { InfoBlock } from './InfoBlock';
import { OptionGroup } from './OptionGroup';
import { ScreenSection } from './ScreenSection';
import { SelectionTile } from './SelectionTile';

/** 設定画面のprops。 */
export type SettingsScreenProps = {
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** GPS記録中かどうか。 */
  isRecording: boolean;
  /** 自動記録の状態。 */
  autoStartStatus: AutoStartStatus;
  /** 必要な位置情報権限が揃っているか。 */
  hasRequiredPermission: boolean;
  /** 権限要求ボタンの文言を設定誘導にするか。 */
  shouldOpenSettingsForPermission: boolean;
  /** 画面ON維持設定。 */
  keepScreenAwake: boolean;
  /** 表示中の地図種別。 */
  mapType: MapType;
  /** 写真表示設定。 */
  showPhotosOnMap: boolean;
  /** 写真表示設定を保存中か。 */
  isUpdatingPhotoSetting: boolean;
  /** GPXインポート処理中か。 */
  isImportingGpx: boolean;
  /** Plus権限状態。 */
  premiumAccessState: ReturnType<typeof getDefaultPremiumAccessState>;
  /** RevenueCat Offeringの商品概要。 */
  premiumOfferingSummary: PremiumOfferingSummary | null;
  /** 商品情報を読み込み中か。 */
  isLoadingPremiumOffering: boolean;
  /** サブスク購入処理中か。 */
  isPurchasingPremiumPackage: boolean;
  /** Customer Center表示処理中か。 */
  isPresentingPremiumCustomerCenter: boolean;
  /** 購入復元処理中か。 */
  isRestoringPremiumPurchases: boolean;
  /** 選択中の現在地アイコンID。 */
  selectedUserLocationIconId: UserLocationIconId;
  /** 地図画面へ戻る処理。 */
  onBackToMap: () => void;
  /** GPS記録開始処理。自動開始失敗時の復旧操作でだけ使う。 */
  onStartRecording: () => void;
  /** 位置情報権限要求処理。 */
  onRequestLocationPermission: () => void;
  /** 画面ON維持設定の更新処理。 */
  onUpdateKeepScreenAwake: (enabled: boolean) => Promise<void>;
  /** 地図種別の切り替え処理。 */
  onToggleMapType: () => void;
  /** 写真表示設定の更新処理。 */
  onUpdateShowPhotosOnMap: (enabled: boolean) => Promise<void>;
  /** 現在地アイコン更新処理。 */
  onUpdateUserLocationIcon: (iconId: UserLocationIconId) => void;
  /** 選択中のアプリカラープリセットID。 */
  selectedAppColorPresetId: AppColorPresetId;
  /** アプリカラープリセット更新処理。 */
  onUpdateAppColorPreset: (presetId: AppColorPresetId) => void;
  /** このアプリについて画面を開く処理。 */
  onOpenAboutAppScreen: () => void;
  /** OSSライセンス画面を開く処理。 */
  onOpenLicenseScreen: () => void;
  /** RevenueCat月払いPackageを購入する処理。 */
  onPurchaseMonthlyPremiumPackage: () => void;
  /** RevenueCat年払いPackageを購入する処理。 */
  onPurchaseYearlyPremiumPackage: () => void;
  /** RevenueCat Customer Centerを表示する処理。 */
  onPresentPremiumCustomerCenter: () => void;
  /** 購入復元処理。 */
  onRestorePremiumPurchases: () => void;
  /** データエクスポート処理。 */
  onExportAllLogs: () => void;
  /** GPXインポート処理。 */
  onImportGpx: () => void;
  /** 全データ削除処理。 */
  onDeleteAllData: () => void;
};

type MaterialIconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/**
 * OSに合わせたサブスク管理先のストア名を返す。
 *
 * @param platformOS - Platform.OSの値。
 * @returns Androidは'Playストア'、その他は'App Store'。
 */
export function getSubscriptionStoreName(platformOS: typeof Platform.OS): string {
  return platformOS === 'android' ? 'Playストア' : 'App Store';
}

/** 設定画面をデザイン案の大きなパネルと選択タイルで描画する。 */
export function SettingsScreen({
  styles,
  theme,
  isRecording,
  autoStartStatus,
  hasRequiredPermission,
  shouldOpenSettingsForPermission,
  keepScreenAwake,
  mapType,
  showPhotosOnMap,
  isUpdatingPhotoSetting,
  isImportingGpx,
  premiumAccessState,
  premiumOfferingSummary,
  isLoadingPremiumOffering,
  isPurchasingPremiumPackage,
  isPresentingPremiumCustomerCenter,
  isRestoringPremiumPurchases,
  selectedUserLocationIconId,
  selectedAppColorPresetId,
  onUpdateAppColorPreset,
  onBackToMap,
  onStartRecording,
  onRequestLocationPermission,
  onUpdateKeepScreenAwake,
  onToggleMapType,
  onUpdateShowPhotosOnMap,
  onUpdateUserLocationIcon,
  onOpenAboutAppScreen,
  onOpenLicenseScreen,
  onPurchaseMonthlyPremiumPackage,
  onPurchaseYearlyPremiumPackage,
  onPresentPremiumCustomerCenter,
  onRestorePremiumPurchases,
  onExportAllLogs,
  onImportGpx,
  onDeleteAllData,
}: SettingsScreenProps) {
  const isPlusActive = premiumAccessState.isPlusActive;
  const subscriptionDescription = isPlusActive ? `退会する場合は${getSubscriptionStoreName(Platform.OS)}のサブスク設定から行ってください。` : undefined;

  return (
    <SafeAreaView style={styles.appScreen}>
      <AppScreenHeader backLabel="地図" styles={styles} theme={theme} title="設定" onBack={onBackToMap} />

      <ScrollView contentContainerStyle={styles.screenList}>
        <GpsStatusPanel
          autoStartStatus={autoStartStatus}
          hasRequiredPermission={hasRequiredPermission}
          isRecording={isRecording}
          shouldOpenSettingsForPermission={shouldOpenSettingsForPermission}
          styles={styles}
          onRequestLocationPermission={onRequestLocationPermission}
          onStartRecording={onStartRecording}
        />

        <ScreenSection styles={styles} title="一般">
          <View style={styles.settingsInlineRow}>
            <View style={styles.settingsInlineText}>
              <Text style={styles.formItemTitle}>常に画面をONにする</Text>
              <Text style={styles.formItemDescription}>{'アプリが前面にある場合は画面をロックしません。\n記録の精度があがる可能性がありますが、消費電力が増えます。'}</Text>
            </View>
            <Switch
              value={keepScreenAwake}
              onValueChange={(value) => {
                onUpdateKeepScreenAwake(value).catch((error: unknown) => {
                  Alert.alert('設定保存失敗', error instanceof Error ? error.message : '設定を保存できませんでした。');
                });
              }}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor="#ffffff"
            />
          </View>

          {isPlusActive ? (
            <AppColorPicker
              styles={styles}
              theme={theme}
              selectedPresetId={selectedAppColorPresetId}
              onUpdatePreset={onUpdateAppColorPreset}
            />
          ) : null}
        </ScreenSection>

        <ScreenSection styles={styles} title="地図画面設定">
          <View style={styles.settingsInlineRow}>
            <View style={styles.settingsInlineText}>
              <Text style={styles.formItemTitle}>マップ上に写真を表示する</Text>
              <Text style={styles.formItemDescription}>{'位置情報が記録されている写真をマップ上に表示します。\n初回ON時に写真ライブラリのフルアクセスを要求します。'}</Text>
            </View>
            <Switch
              value={showPhotosOnMap}
              disabled={isUpdatingPhotoSetting}
              onValueChange={(value) => {
                onUpdateShowPhotosOnMap(value).catch((error: unknown) => {
                  Alert.alert('写真設定失敗', error instanceof Error ? error.message : '写真表示設定を保存できませんでした。');
                });
              }}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor="#ffffff"
            />
          </View>

          <OptionGroup styles={styles} title="マップのテーマ">
            <SelectionTile
              icon={<MaterialCommunityIcons name="map-outline" size={42} color={theme.colors.text} />}
              isSelected={mapType === 'standard'}
              label="標準マップ"
              onPress={() => {
                if (mapType !== 'standard') {
                  onToggleMapType();
                }
              }}
              styles={styles}
              wide
            />
            <SelectionTile
              icon={<MaterialCommunityIcons name="satellite-variant" size={42} color={theme.colors.text} />}
              isSelected={mapType !== 'standard'}
              label="航空写真"
              onPress={() => {
                if (mapType === 'standard') {
                  onToggleMapType();
                }
              }}
              styles={styles}
              wide
            />
          </OptionGroup>

          {isPlusActive ? (
            <UserLocationIconPicker
              isPlusActive={isPlusActive}
              selectedUserLocationIconId={selectedUserLocationIconId}
              styles={styles}
              theme={theme}
              onUpdateUserLocationIcon={onUpdateUserLocationIcon}
            />
          ) : null}
        </ScreenSection>

        <ScreenSection styles={styles} title="サブスク情報">
          <View style={styles.settingsSubscriptionRow}>
            <View style={styles.settingsInlineText}>
              <Text style={styles.formItemTitle}>ステータス</Text>
              {subscriptionDescription ? <DescriptionText styles={styles}>{subscriptionDescription}</DescriptionText> : null}
            </View>
            <Text style={[styles.settingsPlusBadge, !isPlusActive && styles.settingsFreeBadge]}>{isPlusActive ? 'Plusユーザー' : '一般ユーザー'}</Text>
          </View>
          {isPlusActive && (
            <View style={styles.settingsSubscriptionActions}>
              <ActionPill
                alignLeft
                disabled={isPresentingPremiumCustomerCenter}
                icon={<MaterialCommunityIcons name="account-cog" size={22} color={theme.colors.text} />}
                label={isPresentingPremiumCustomerCenter ? '表示中...' : 'サブスクを管理する'}
                styles={styles}
                onPress={onPresentPremiumCustomerCenter}
              />
            </View>
          )}
          {!isPlusActive && (
            <View style={styles.settingsSubscriptionActions}>
              <InfoBlock
                description="月額300円の有料サービスです。年払いにすると1か月分オトクです!"
                styles={styles}
                title="Strollia Plus(有料サブスクリプション)のごあんない"
              />
              <PlusAdImage
                accessibilityLabel="Strollia Plusの機能比較広告"
                width="100%"
              />
              <DescriptionText styles={styles}>いつでも解約できます。</DescriptionText>
              <ActionPill
                alignLeft
                backgroundColor={theme.name === 'dark' ? 'rgba(115, 199, 162, 0.08)' : 'rgba(31, 122, 92, 0.08)'}
                borderColor={theme.colors.primary}
                disabled={isPurchasingPremiumPackage}
                icon={<MaterialCommunityIcons name="currency-usd" size={21} color={theme.colors.primary} />}
                label={isPurchasingPremiumPackage ? '購入処理中...' : '月額300円ではじめる！'}
                styles={styles}
                textColor={theme.colors.primary}
                onPress={onPurchaseMonthlyPremiumPackage}
              />
              <ActionPill
                alignLeft
                backgroundColor={theme.name === 'dark' ? 'rgba(115, 199, 162, 0.08)' : 'rgba(31, 122, 92, 0.08)'}
                borderColor={theme.colors.primary}
                disabled={isPurchasingPremiumPackage}
                icon={<MaterialCommunityIcons name="currency-usd" size={21} color={theme.colors.primary} />}
                label={isPurchasingPremiumPackage ? '購入処理中...' : '年額3300円ではじめる！'}
                styles={styles}
                textColor={theme.colors.primary}
                onPress={onPurchaseYearlyPremiumPackage}
              />
              <ActionPill
                alignLeft
                disabled={isRestoringPremiumPurchases}
                icon={<MaterialCommunityIcons name="restore" size={24} color={theme.colors.text} />}
                label={isRestoringPremiumPurchases ? '復元中...' : 'Strollia Plusの購入を復元する'}
                styles={styles}
                onPress={onRestorePremiumPurchases}
              />
              {isLoadingPremiumOffering && <DescriptionText styles={styles}>商品情報を確認しています...</DescriptionText>}
            </View>
          )}
        </ScreenSection>

        <ScreenSection styles={styles} title="データ管理">
          <InfoBlock
            description={'GPSログファイルの一般的な規格のGPXファイルでエクスポート/インポートが可能です。\nインポート時にデータが競合する場合は既存データを優先します。'}
            styles={styles}
            title="GPXファイル"
          />
          <ActionPill
            alignLeft
            icon={<Feather name="upload" size={16} color={theme.name === 'dark' ? '#ffffff' : '#333333'} />}
            label="GPXファイルのエクスポート"
            styles={styles}
            onPress={onExportAllLogs}
          />
          <ActionPill
            alignLeft
            disabled={isImportingGpx}
            icon={<Feather name="download" size={16} color={theme.name === 'dark' ? '#ffffff' : '#333333'} />}
            label={isImportingGpx ? 'GPXインポート中...' : 'GPXファイルのインポート'}
            styles={styles}
            onPress={onImportGpx}
          />
          <InfoBlock description="GPS記録や実績を含むすべてのデータを削除します。" styles={styles} title="データの削除" />
          <ActionPill
            alignLeft
            danger
            icon={<Feather name="trash-2" size={16} color={theme.name === 'dark' ? theme.colors.danger : '#b0002f'} />}
            label="すべてのデータの削除"
            styles={styles}
            onPress={onDeleteAllData}
          />
        </ScreenSection>

        <ScreenSection styles={styles} title="アプリ情報">
          <ActionPill
            alignLeft
            icon={<Feather name="info" size={16} color={theme.name === 'dark' ? '#ffffff' : '#333333'} />}
            label="このアプリについて"
            styles={styles}
            onPress={onOpenAboutAppScreen}
          />
          <ActionPill
            alignLeft
            icon={<Feather name="file-text" size={16} color={theme.name === 'dark' ? '#ffffff' : '#333333'} />}
            label="オープンソースライセンス"
            styles={styles}
            onPress={onOpenLicenseScreen}
          />
        </ScreenSection>
      </ScrollView>
    </SafeAreaView>
  );
}

type GpsStatusPanelProps = Pick<
  SettingsScreenProps,
  'styles' | 'isRecording' | 'autoStartStatus' | 'hasRequiredPermission' | 'shouldOpenSettingsForPermission' | 'onRequestLocationPermission' | 'onStartRecording'
>;

/** GPS権限と自動記録状態を、3種類の目立つパネルへ変換する。 */
function GpsStatusPanel({
  styles,
  isRecording,
  autoStartStatus,
  hasRequiredPermission,
  shouldOpenSettingsForPermission,
  onRequestLocationPermission,
  onStartRecording,
}: GpsStatusPanelProps) {
  if (!hasRequiredPermission) {
    return (
      <View style={[styles.settingsGpsPanel, styles.settingsGpsPanelWithAction, styles.settingsGpsPanelDanger]}>
        <Text style={styles.settingsGpsPanelTitle}>GPSの権限をください!</Text>
        <Text style={styles.settingsGpsPanelText}>GPS権限がありません! 記録を始めるにはボタンをタップ!</Text>
        <Pressable accessibilityRole="button" onPress={onRequestLocationPermission} style={styles.settingsGpsPanelButton}>
          <Text style={styles.settingsGpsPanelButtonDangerText}>{shouldOpenSettingsForPermission ? '設定を開く' : '権限を付与する'}</Text>
        </Pressable>
      </View>
    );
  }

  if (!isRecording && autoStartStatus === 'failed') {
    return (
      <View style={[styles.settingsGpsPanel, styles.settingsGpsPanelWithAction, styles.settingsGpsPanelWarning]}>
        <Text style={styles.settingsGpsPanelTitle}>冒険をはじめましょう!</Text>
        <Text style={styles.settingsGpsPanelText}>ボタンを押して記録をはじめましょう!</Text>
        <Pressable accessibilityRole="button" onPress={onStartRecording} style={styles.settingsGpsPanelButton}>
          <Text style={styles.settingsGpsPanelButtonWarningText}>GPSの記録を開始する</Text>
        </Pressable>
      </View>
    );
  }

  if (!isRecording) {
    return (
      <View style={styles.settingsGpsPanel}>
        <Text style={styles.settingsGpsPanelTitle}>準備中...</Text>
        <Text style={styles.settingsGpsPanelText}>GPS記録の準備をしています</Text>
      </View>
    );
  }

  return (
    <View style={[styles.settingsGpsPanel, styles.settingsGpsPanelActive]}>
      <Text style={styles.settingsGpsPanelTitle}>GPS記録中!</Text>
      <Text style={styles.settingsGpsPanelText}>{'あなたの位置情報はすとろりあがしっかりと記録しています！\n冒険にでかけましょう！'}</Text>
    </View>
  );
}

type UserLocationIconPickerProps = Pick<SettingsScreenProps, 'styles' | 'theme' | 'selectedUserLocationIconId' | 'onUpdateUserLocationIcon'> & {
  /** Plus加入状態。 */
  isPlusActive: boolean;
};

/** 現在地アイコンの選択ボタン一覧を描画する。 */
function UserLocationIconPicker({ styles, theme, selectedUserLocationIconId, isPlusActive, onUpdateUserLocationIcon }: UserLocationIconPickerProps) {
  return (
    <OptionGroup styles={styles} title="現在地アイコン (Strollia Plus)">
      {USER_LOCATION_ICON_OPTIONS.map((option) => {
        const isSelected = selectedUserLocationIconId === option.id;
        const isLocked = option.premium && !isPlusActive;
        const iconName: MaterialIconName =
          option.id === 'compass' ? 'compass-outline'
          : option.id === 'walker' ? 'walk'
          : option.id === 'custom' ? 'image-outline'
          : 'crosshairs-gps';

        return (
          <SelectionTile
            key={option.id}
            icon={
              <View style={styles.settingsIconTileContent}>
                <MaterialCommunityIcons name={iconName} size={30} color={theme.colors.text} />
                {isLocked ? <MaterialCommunityIcons name="lock-outline" size={15} color={theme.colors.mutedText} /> : null}
              </View>
            }
            isSelected={isSelected}
            label={option.label}
            styles={styles}
            onPress={isLocked ? undefined : () => onUpdateUserLocationIcon(option.id)}
          />
        );
      })}
    </OptionGroup>
  );
}

type AppColorPickerProps = {
  styles: AppStyles;
  theme: AppTheme;
  selectedPresetId: AppColorPresetId;
  onUpdatePreset: (presetId: AppColorPresetId) => void;
};

/** アプリカラープリセット選択ドロップダウン。 */
function AppColorPicker({ styles, theme, selectedPresetId, onUpdatePreset }: AppColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedPreset = getAppColorPreset(selectedPresetId);
  const dotColor = theme.name === 'dark' ? selectedPreset.dark.primary : selectedPreset.light.primary;

  return (
    <OptionGroup styles={styles} title="アプリカラー (Strollia Plus)" note="現在地アイコンの背景・エリアの塗り色など、アプリ全体のカラーが変わります。">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="アプリカラーを選択"
        onPress={() => setIsOpen(true)}
        style={styles.colorPresetDropdownButton}
      >
        <View style={[styles.colorPresetDot, { backgroundColor: dotColor }]} />
        <Text style={styles.colorPresetLabel}>{selectedPreset.label}</Text>
        <MaterialCommunityIcons name="chevron-down" size={18} color={theme.colors.mutedText} />
      </Pressable>

      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.colorPresetModalBackdrop} onPress={() => setIsOpen(false)}>
          <View style={styles.colorPresetModalSheet}>
            {APP_COLOR_PRESETS.map((preset) => {
              const presetDotColor = theme.name === 'dark' ? preset.dark.primary : preset.light.primary;
              const isSelected = preset.id === selectedPresetId;

              return (
                <Pressable
                  key={preset.id}
                  accessibilityRole="button"
                  accessibilityLabel={preset.label}
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => {
                    onUpdatePreset(preset.id);
                    setIsOpen(false);
                  }}
                  style={styles.colorPresetRow}
                >
                  <View style={[styles.colorPresetDot, { backgroundColor: presetDotColor }]} />
                  <Text style={styles.colorPresetRowLabel}>{preset.label}</Text>
                  {isSelected && (
                    <MaterialCommunityIcons name="check" size={18} color={theme.colors.primary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </OptionGroup>
  );
}
