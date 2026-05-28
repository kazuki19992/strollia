import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Alert, Pressable, SafeAreaView, ScrollView, Switch, Text, View } from 'react-native';

import { getDefaultPremiumAccessState } from '../../features/premium/revenueCatAccess';
import {
  USER_LOCATION_ICON_OPTIONS,
  UserLocationIconId,
} from '../../features/customization/customizationOptions';
import { AppTheme } from '../../theme/theme';
import { AutoStartStatus } from '../appTypes';
import { AppStyles } from '../appStyles';
import { getAutoRecordNote } from '../appText';

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
  /** 写真表示設定。 */
  showPhotosOnMap: boolean;
  /** 写真表示設定を保存中か。 */
  isUpdatingPhotoSetting: boolean;
  /** GPXインポート処理中か。 */
  isImportingGpx: boolean;
  /** Plus権限状態。 */
  premiumAccessState: ReturnType<typeof getDefaultPremiumAccessState>;
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
  /** 写真表示設定の更新処理。 */
  onUpdateShowPhotosOnMap: (enabled: boolean) => Promise<void>;
  /** 現在地アイコン更新処理。 */
  onUpdateUserLocationIcon: (iconId: UserLocationIconId) => void;
  /** データエクスポート処理。 */
  onExportAllLogs: () => void;
  /** GPXインポート処理。 */
  onImportGpx: () => void;
  /** 全データ削除処理。 */
  onDeleteAllData: () => void;
};

/** GPS記録、画面ON維持、データ操作をまとめた設定画面を描画する。 */
export function SettingsScreen({
  styles,
  theme,
  isRecording,
  autoStartStatus,
  hasRequiredPermission,
  shouldOpenSettingsForPermission,
  keepScreenAwake,
  showPhotosOnMap,
  isUpdatingPhotoSetting,
  isImportingGpx,
  premiumAccessState,
  selectedUserLocationIconId,
  onBackToMap,
  onStartRecording,
  onRequestLocationPermission,
  onUpdateKeepScreenAwake,
  onUpdateShowPhotosOnMap,
  onUpdateUserLocationIcon,
  onExportAllLogs,
  onImportGpx,
  onDeleteAllData,
}: SettingsScreenProps) {
  return (
    <SafeAreaView style={styles.dailyContainer}>
      <View style={styles.dailyHeader}>
        <Pressable onPress={onBackToMap} style={styles.backButton}>
          <Text style={styles.backButtonText}>地図へ</Text>
        </Pressable>
        <Text style={styles.dailyTitle}>設定</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.settingsList}>
        <View style={styles.settingsCard}>
          <Text style={styles.settingsTitle}>GPS記録</Text>
          <View style={styles.settingsStatusRow}>
            <View style={[styles.statusDot, isRecording && styles.statusDotActive]} />
            <Text style={styles.settingsStatusText}>{isRecording ? '記録中' : '停止中'}</Text>
          </View>
          <Text style={styles.settingsDescription}>{getAutoRecordNote(autoStartStatus)} 権限が不足している場合は、下のボタンから許可してください。</Text>
          {!hasRequiredPermission ? (
            <View style={styles.permissionSettingsBox}>
              <Text style={styles.permissionTitle}>位置情報の常時許可が必要です</Text>
              <Text style={styles.permissionText}>OSの権限で「常に」許可すると、画面を閉じても記録できます。</Text>
              <Pressable onPress={onRequestLocationPermission} style={styles.permissionButton}>
                <Text style={styles.permissionButtonText}>{shouldOpenSettingsForPermission ? '設定を開く' : '権限を付与する'}</Text>
              </Pressable>
            </View>
          ) : autoStartStatus === 'failed' ? (
            <View style={styles.actions}>
              <Pressable disabled={isRecording} onPress={onStartRecording} style={[styles.primaryButton, isRecording && styles.buttonDisabled]}>
                <Text style={styles.primaryButtonText}>記録開始</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.settingsCard}>
          <View style={styles.settingsToggleRow}>
            <View style={styles.settingsToggleTextColumn}>
              <Text style={styles.settingsTitle}>常に画面をONにする</Text>
              <Text style={styles.settingsDescription}>アプリが前面にある間は画面をロックしません。記録の精度が上がる可能性がありますが、消費電力が増えます。</Text>
            </View>
            <Switch
              value={keepScreenAwake}
              onValueChange={(value) => {
                onUpdateKeepScreenAwake(value).catch((error: unknown) => {
                  Alert.alert('設定保存失敗', error instanceof Error ? error.message : '設定を保存できませんでした。');
                });
              }}
              trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
              thumbColor={theme.colors.cardStrong}
            />
          </View>
        </View>

        <View style={styles.settingsCard}>
          <View style={styles.settingsToggleRow}>
            <View style={styles.settingsToggleTextColumn}>
              <Text style={styles.settingsTitle}>マップ上に写真を表示</Text>
              <Text style={styles.settingsDescription}>ジオタグ付き写真だけを地図上に小さく表示します。初回ON時に写真ライブラリのフルアクセスを要求します。</Text>
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
              thumbColor={theme.colors.cardStrong}
            />
          </View>
        </View>

        <View style={styles.settingsCard}>
          <View style={styles.settingsActionTitleRow}>
            <Text style={styles.settingsTitle}>Strollia Plus</Text>
            <Text style={styles.premiumBadge}>RevenueCat連携済み</Text>
          </View>
          <Text style={styles.settingsDescription}>
            RevenueCatでPlus状態を確認します。無料時はOS標準の現在地アイコンを使います。
          </Text>
          <View style={styles.settingsStatusRow}>
            <MaterialCommunityIcons
              name={premiumAccessState.isPlusActive ? 'check-decagram-outline' : 'lock-outline'}
              size={18}
              color={theme.colors.primary}
            />
            <Text style={styles.settingsStatusText}>
              {premiumAccessState.isPlusActive ? 'Plus有効' : 'Plus未加入'} / {premiumAccessState.entitlementId}
            </Text>
          </View>
          <UserLocationIconPicker
            styles={styles}
            theme={theme}
            isPlusActive={premiumAccessState.isPlusActive}
            selectedUserLocationIconId={selectedUserLocationIconId}
            onUpdateUserLocationIcon={onUpdateUserLocationIcon}
          />
        </View>

        <View style={styles.settingsCard}>
          <Text style={styles.settingsTitle}>データ</Text>
          <Text style={styles.settingsDescription}>GPSログのバックアップや他アプリ連携に使います。</Text>
          <Pressable onPress={onExportAllLogs} style={styles.settingsAction}>
            <Feather name="upload" size={18} color={theme.colors.primary} />
            <Text style={styles.settingsActionText}>データのエクスポート</Text>
          </Pressable>
          <Text style={styles.settingsDescription}>GPXファイルを端末内に取り込みます。KMLは未対応です。同じ時刻と座標の点がある場合は既存データを優先します。</Text>
          <Pressable disabled={isImportingGpx} onPress={onImportGpx} style={[styles.settingsAction, isImportingGpx && styles.buttonDisabled]}>
            <Feather name="download" size={18} color={theme.colors.primary} />
            <Text style={styles.settingsActionText}>{isImportingGpx ? 'GPXインポート中...' : 'GPXをインポート'}</Text>
          </Pressable>
          <Pressable onPress={onDeleteAllData} style={styles.dangerAction}>
            <MaterialCommunityIcons name="delete-outline" size={20} color={theme.colors.danger} />
            <Text style={styles.dangerActionText}>すべてのデータを削除</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type UserLocationIconPickerProps = Pick<SettingsScreenProps, 'styles' | 'theme' | 'selectedUserLocationIconId' | 'onUpdateUserLocationIcon'> & {
  /** Plus加入状態。 */
  isPlusActive: boolean;
};

/** 現在地アイコンの選択ボタン一覧を描画する。 */
function UserLocationIconPicker({ styles, theme, selectedUserLocationIconId, isPlusActive, onUpdateUserLocationIcon }: UserLocationIconPickerProps) {
  return (
    <View style={styles.customizationSection}>
      <Text style={styles.settingsStatusText}>現在地アイコン</Text>
      <View style={styles.customizationOptionGrid}>
        {USER_LOCATION_ICON_OPTIONS.map((option) => {
          const isSelected = selectedUserLocationIconId === option.id;
          const isLocked = option.premium && !isPlusActive;

          return (
            <Pressable
              key={option.id}
              onPress={() => onUpdateUserLocationIcon(option.id)}
              style={[styles.customizationOption, isSelected && styles.customizationOptionSelected]}
            >
              <MaterialCommunityIcons
                name={option.id === 'compass' ? 'compass-outline' : option.id === 'walker' ? 'walk' : 'crosshairs-gps'}
                size={24}
                color={isSelected ? theme.colors.primary : theme.colors.text}
              />
              <View style={styles.settingsActionTitleRow}>
                <Text style={styles.customizationOptionText}>{option.label}</Text>
                {isLocked && <MaterialCommunityIcons name="lock-outline" size={14} color={theme.colors.mutedText} />}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
