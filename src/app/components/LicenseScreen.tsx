import { Feather } from '@expo/vector-icons';
import { FlatList, Pressable, SafeAreaView, Text, View } from 'react-native';

import { OSS_LICENSES, OSS_LICENSES_GENERATED_AT } from '../generated/ossLicenses';
import { AppStyles } from '../appStyles';
import { AppTheme } from '../../theme/theme';

/** ライセンス画面のprops。 */
export type LicenseScreenProps = {
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 設定画面へ戻る処理。 */
  onBackToSettings: () => void;
};

/** 生成済みOSSライセンス一覧を表示する画面を描画する。 */
export function LicenseScreen({ styles, theme, onBackToSettings }: LicenseScreenProps) {
  return (
    <SafeAreaView style={styles.dailyContainer}>
      <View style={styles.dailyHeader}>
        <Pressable accessibilityLabel="ライセンス画面を閉じる" accessibilityRole="button" onPress={onBackToSettings} style={styles.backButton}>
          <Text style={styles.backButtonText}>戻る</Text>
        </Pressable>
        <Text style={styles.dailyTitle}>ライセンス</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FlatList
        data={OSS_LICENSES}
        keyExtractor={(license) => license.id}
        contentContainerStyle={styles.settingsList}
        ListHeaderComponent={(
          <View style={styles.settingsCard}>
            <Text style={styles.settingsTitle}>OSSライセンス</Text>
            <Text style={styles.settingsDescription}>
              Strolliaで利用しているオープンソースソフトウェアのライセンスです。
            </Text>
            <Text style={styles.settingsDescription}>生成日時: {OSS_LICENSES_GENERATED_AT}</Text>
          </View>
        )}
        renderItem={({ item: license }) => (
          <View key={license.id} style={styles.settingsCard}>
            <View style={styles.settingsActionTitleRow}>
              <Feather name={license.source === 'ios' ? 'smartphone' : 'package'} size={18} color={theme.colors.primary} />
              <Text style={styles.settingsTitle}>{license.name}</Text>
            </View>
            {license.version ? <Text style={styles.settingsStatusText}>{license.version}</Text> : null}
            <Text style={styles.settingsStatusText}>{license.licenses}</Text>
            {license.repository ? <Text style={styles.settingsDescription}>{license.repository}</Text> : null}
            {license.licenseText ? <Text style={styles.settingsDescription}>{license.licenseText}</Text> : null}
            {license.noticeText ? <Text style={styles.settingsDescription}>{license.noticeText}</Text> : null}
          </View>
        )}
      />
    </SafeAreaView>
  );
}
