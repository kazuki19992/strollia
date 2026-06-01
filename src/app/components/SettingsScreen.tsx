import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, Switch, Text, View } from 'react-native';
import type { MapType } from 'react-native-maps';

import {
  USER_LOCATION_ICON_OPTIONS,
  UserLocationIconId,
} from '../../features/customization/customizationOptions';
import { getDefaultPremiumAccessState, PremiumOfferingSummary } from '../../features/premium/revenueCatAccess';
import { AppTheme, AppThemePreference } from '../../theme/theme';
import { AutoStartStatus } from '../appTypes';
import { AppStyles } from '../appStyles';

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
  /** 選択中の画面テーマ設定。 */
  appThemePreference: AppThemePreference;
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
  /** Paywall表示処理中か。 */
  isPresentingPremiumPaywall: boolean;
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
  /** 画面テーマ設定の更新処理。 */
  onUpdateAppThemePreference: (preference: AppThemePreference) => Promise<void>;
  /** 地図種別の切り替え処理。 */
  onToggleMapType: () => void;
  /** 写真表示設定の更新処理。 */
  onUpdateShowPhotosOnMap: (enabled: boolean) => Promise<void>;
  /** 現在地アイコン更新処理。 */
  onUpdateUserLocationIcon: (iconId: UserLocationIconId) => void;
  /** OSSライセンス画面を開く処理。 */
  onOpenLicenseScreen: () => void;
  /** RevenueCat Paywallを表示する処理。 */
  onPresentPremiumPaywall: () => void;
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

/** 設定画面をデザイン案の大きなパネルと選択タイルで描画する。 */
export function SettingsScreen({
  styles,
  theme,
  isRecording,
  autoStartStatus,
  hasRequiredPermission,
  shouldOpenSettingsForPermission,
  keepScreenAwake,
  appThemePreference,
  mapType,
  showPhotosOnMap,
  isUpdatingPhotoSetting,
  isImportingGpx,
  premiumAccessState,
  isLoadingPremiumOffering,
  isPresentingPremiumPaywall,
  isRestoringPremiumPurchases,
  selectedUserLocationIconId,
  onBackToMap,
  onStartRecording,
  onRequestLocationPermission,
  onUpdateKeepScreenAwake,
  onUpdateAppThemePreference,
  onToggleMapType,
  onUpdateShowPhotosOnMap,
  onUpdateUserLocationIcon,
  onOpenLicenseScreen,
  onPresentPremiumPaywall,
  onRestorePremiumPurchases,
  onExportAllLogs,
  onImportGpx,
  onDeleteAllData,
}: SettingsScreenProps) {
  const isPlusActive = premiumAccessState.isPlusActive;

  return (
    <SafeAreaView style={styles.settingsScreen}>
      <View style={styles.settingsHeader}>
        <Pressable accessibilityRole="button" onPress={onBackToMap} style={styles.settingsBackRibbon}>
          <Feather name="chevron-left" size={22} color={theme.name === 'dark' ? '#333333' : theme.colors.text} />
          <Text style={styles.settingsBackRibbonText}>地図</Text>
        </Pressable>
        <Text style={styles.settingsHeaderTitle}>設定</Text>
        <View style={styles.settingsHeaderSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.settingsList}>
        <GpsStatusPanel
          autoStartStatus={autoStartStatus}
          hasRequiredPermission={hasRequiredPermission}
          isRecording={isRecording}
          shouldOpenSettingsForPermission={shouldOpenSettingsForPermission}
          styles={styles}
          onRequestLocationPermission={onRequestLocationPermission}
          onStartRecording={onStartRecording}
        />

        <SettingsSection styles={styles} title="一般">
          <View style={styles.settingsInlineRow}>
            <View style={styles.settingsInlineText}>
              <Text style={styles.settingsItemTitle}>常に画面をONにする</Text>
              <Text style={styles.settingsItemDescription}>アプリが前面にある場合は画面をロックしません。記録の精度があがる可能性がありますが、消費電力が増えます。</Text>
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

          <OptionGroup note={`設定中: ${getAppThemePreferenceLabel(appThemePreference)}`} styles={styles} title="画面のテーマ">
            <SelectionTile
              isSelected={appThemePreference === 'system'}
              label="スマホの設定に合わせる"
              styles={styles}
              onPress={() => {
                onUpdateAppThemePreference('system').catch((error: unknown) => {
                  Alert.alert('設定保存失敗', error instanceof Error ? error.message : 'テーマ設定を保存できませんでした。');
                });
              }}
            />
            <SelectionTile
              isSelected={appThemePreference === 'light'}
              label="いつもライト"
              styles={styles}
              swatchColor="#ffffff"
              onPress={() => {
                onUpdateAppThemePreference('light').catch((error: unknown) => {
                  Alert.alert('設定保存失敗', error instanceof Error ? error.message : 'テーマ設定を保存できませんでした。');
                });
              }}
            />
            <SelectionTile
              isSelected={appThemePreference === 'dark'}
              label="いつもダーク"
              styles={styles}
              swatchColor="#333333"
              onPress={() => {
                onUpdateAppThemePreference('dark').catch((error: unknown) => {
                  Alert.alert('設定保存失敗', error instanceof Error ? error.message : 'テーマ設定を保存できませんでした。');
                });
              }}
            />
          </OptionGroup>
        </SettingsSection>

        <SettingsSection styles={styles} title="地図画面設定">
          <View style={styles.settingsInlineRow}>
            <View style={styles.settingsInlineText}>
              <Text style={styles.settingsItemTitle}>マップ上に写真を表示する</Text>
              <Text style={styles.settingsItemDescription}>位置情報が記録されている写真をマップ上に表示します。初回ON時に写真ライブラリのフルアクセスを要求します。</Text>
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

          <OptionGroup note={mapType === 'standard' ? '設定中: 標準マップ' : '設定中: 航空写真'} styles={styles} title="マップのテーマ">
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

          <UserLocationIconPicker
            isPlusActive={isPlusActive}
            selectedUserLocationIconId={selectedUserLocationIconId}
            styles={styles}
            theme={theme}
            onUpdateUserLocationIcon={onUpdateUserLocationIcon}
          />
        </SettingsSection>

        <SettingsSection styles={styles} title="サブスク情報">
          <View style={styles.settingsSubscriptionRow}>
            <View style={styles.settingsInlineText}>
              <Text style={styles.settingsItemTitle}>ステータス</Text>
              <Text style={styles.settingsItemDescription}>
                {isPlusActive ? '退会する場合はストア名のサブスク設定から行ってください。' : 'Strollia Plusで現在地アイコンとレポート機能を開放できます。'}
              </Text>
            </View>
            {isPlusActive ? <Text style={styles.settingsPlusBadge}>Plusユーザー</Text> : null}
          </View>
          {!isPlusActive && (
            <View style={styles.settingsSubscriptionActions}>
              <Pressable
                disabled={isPresentingPremiumPaywall}
                onPress={onPresentPremiumPaywall}
                style={[styles.settingsSubscribeButton, isPresentingPremiumPaywall && styles.buttonDisabled]}
              >
                <Text style={styles.settingsSubscribeButtonText}>{isPresentingPremiumPaywall ? '表示中...' : '加入する'}</Text>
              </Pressable>
              <Pressable
                disabled={isRestoringPremiumPurchases}
                onPress={onRestorePremiumPurchases}
                style={[styles.settingsRestoreButton, isRestoringPremiumPurchases && styles.buttonDisabled]}
              >
                <Text style={styles.settingsRestoreButtonText}>{isRestoringPremiumPurchases ? '復元中...' : 'サブスクを復元する'}</Text>
              </Pressable>
              {isLoadingPremiumOffering && <Text style={styles.settingsItemDescription}>商品情報を確認しています...</Text>}
            </View>
          )}
        </SettingsSection>

        <SettingsSection styles={styles} title="データ管理">
          <ActionPill description="GPSログのバックアップや他アプリ連携に使います" label="GPXのエクスポート" styles={styles} onPress={onExportAllLogs} />
          <ActionPill
            description="データが競合する場合は既存データを優先します"
            disabled={isImportingGpx}
            label={isImportingGpx ? 'GPXインポート中...' : 'GPXのインポート'}
            styles={styles}
            onPress={onImportGpx}
          />
          <ActionPill danger description="GPS記録や実績などのすべてのデータを削除します" label="すべてのデータの削除" styles={styles} onPress={onDeleteAllData} />
        </SettingsSection>

        <SettingsSection styles={styles} title="アプリ情報">
          <ActionPill
            alignLeft
            icon={<Feather name="file-text" size={24} color={theme.name === 'dark' ? '#333333' : '#ffffff'} />}
            label="オープンソースライセンス"
            styles={styles}
            onPress={onOpenLicenseScreen}
          />
        </SettingsSection>
      </ScrollView>
    </SafeAreaView>
  );
}

type GpsStatusPanelProps = Pick<
  SettingsScreenProps,
  'styles' | 'isRecording' | 'autoStartStatus' | 'hasRequiredPermission' | 'shouldOpenSettingsForPermission' | 'onRequestLocationPermission' | 'onStartRecording'
>;

/** テーマ設定IDを設定画面の表示名へ変換する。 */
function getAppThemePreferenceLabel(preference: AppThemePreference): string {
  switch (preference) {
    case 'system':
      return 'スマホの設定に合わせる';
    case 'light':
      return 'いつもライト';
    case 'dark':
      return 'いつもダーク';
  }
}

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
      <View style={[styles.settingsGpsPanel, styles.settingsGpsPanelDanger]}>
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
      <View style={[styles.settingsGpsPanel, styles.settingsGpsPanelWarning]}>
        <Text style={styles.settingsGpsPanelTitle}>冒険をはじめましょう!</Text>
        <Text style={styles.settingsGpsPanelText}>ボタンを押して記録をはじめましょう!</Text>
        <Pressable accessibilityRole="button" onPress={onStartRecording} style={styles.settingsGpsPanelButton}>
          <Text style={styles.settingsGpsPanelButtonWarningText}>GPSの記録を開始する</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.settingsGpsPanel, styles.settingsGpsPanelActive]}>
      <Text style={styles.settingsGpsPanelTitle}>GPS記録中!</Text>
      <Text style={styles.settingsGpsPanelText}>あなたの位置情報はすとろりあがしっかりと記録しています! 冒険にでかけましょう!</Text>
    </View>
  );
}

type SettingsSectionProps = {
  /** 子要素。 */
  children: ReactNode;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** セクション見出し。 */
  title: string;
};

/** 設定画面の見出しと中身をまとめる。 */
function SettingsSection({ children, styles, title }: SettingsSectionProps) {
  return (
    <View style={styles.settingsSection}>
      <Text style={styles.settingsSectionTitle}>{title}</Text>
      <View style={styles.settingsSectionBody}>{children}</View>
    </View>
  );
}

type OptionGroupProps = {
  /** 子要素。 */
  children: ReactNode;
  /** 現在設定メモ。 */
  note?: string;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** グループ見出し。 */
  title: string;
};

/** 選択タイルの見出しと注釈を描画する。 */
function OptionGroup({ children, note, styles, title }: OptionGroupProps) {
  return (
    <View style={styles.settingsOptionGroup}>
      <View style={styles.settingsOptionHeader}>
        <Text style={styles.settingsItemTitle}>{title}</Text>
        {note ? <Text style={styles.settingsOptionNote}>{note}</Text> : null}
      </View>
      <View style={styles.settingsOptionGrid}>{children}</View>
    </View>
  );
}

type SelectionTileProps = {
  /** アイコン表示。 */
  icon?: ReactNode;
  /** 選択中かどうか。 */
  isSelected?: boolean;
  /** 表示名。 */
  label: string;
  /** 押下処理。 */
  onPress?: () => void;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 色見本。 */
  swatchColor?: string;
  /** 2列幅にするか。 */
  wide?: boolean;
};

/** デザイン案の枠線付き選択ボタン。 */
function SelectionTile({ icon, isSelected = false, label, onPress, styles, swatchColor, wide = false }: SelectionTileProps) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={[styles.settingsSelectionTile, wide && styles.settingsSelectionTileWide, isSelected && styles.settingsSelectionTileSelected]}
    >
      {swatchColor ? <View style={[styles.settingsThemeSwatch, { backgroundColor: swatchColor }]} /> : icon}
      <Text style={styles.settingsSelectionTileText}>{label}</Text>
    </Pressable>
  );
}

type UserLocationIconPickerProps = Pick<SettingsScreenProps, 'styles' | 'theme' | 'selectedUserLocationIconId' | 'onUpdateUserLocationIcon'> & {
  /** Plus加入状態。 */
  isPlusActive: boolean;
};

/** 現在地アイコンの選択ボタン一覧を描画する。 */
function UserLocationIconPicker({ styles, theme, selectedUserLocationIconId, isPlusActive, onUpdateUserLocationIcon }: UserLocationIconPickerProps) {
  return (
    <OptionGroup note={`設定中: ${USER_LOCATION_ICON_OPTIONS.find((option) => option.id === selectedUserLocationIconId)?.label ?? 'OS標準'}`} styles={styles} title="現在地アイコン (Strollia Plus)">
      {USER_LOCATION_ICON_OPTIONS.map((option) => {
        const isSelected = selectedUserLocationIconId === option.id;
        const isLocked = option.premium && !isPlusActive;
        const iconName: MaterialIconName = option.id === 'compass' ? 'compass-outline' : option.id === 'walker' ? 'walk' : 'crosshairs-gps';

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
            onPress={() => onUpdateUserLocationIcon(option.id)}
          />
        );
      })}
    </OptionGroup>
  );
}

type ActionPillProps = {
  /** 内容を左寄せするか。 */
  alignLeft?: boolean;
  /** 危険操作かどうか。 */
  danger?: boolean;
  /** 補足説明。 */
  description?: string;
  /** 無効化するか。 */
  disabled?: boolean;
  /** 左側アイコン。 */
  icon?: ReactNode;
  /** 表示名。 */
  label: string;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 押下処理。 */
  onPress: () => void;
};

/** データ管理とアプリ情報で使う横長ピルボタン。 */
function ActionPill({ alignLeft = false, danger = false, description, disabled = false, icon, label, styles, onPress }: ActionPillProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.settingsActionPill,
        !description && styles.settingsActionPillCompact,
        danger && styles.settingsActionPillDanger,
        alignLeft && styles.settingsActionPillLeft,
        disabled && styles.buttonDisabled,
      ]}
    >
      <View style={[styles.settingsActionPillContent, alignLeft && styles.settingsActionPillContentLeft]}>
        {icon}
        <Text style={[styles.settingsActionPillText, danger && styles.settingsActionPillDangerText]}>{label}</Text>
      </View>
      {description ? <Text style={[styles.settingsActionPillDescription, danger && styles.settingsActionPillDescriptionDanger]}>{description}</Text> : null}
    </Pressable>
  );
}
