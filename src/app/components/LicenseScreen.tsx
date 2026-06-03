import { Feather } from '@expo/vector-icons';
import { FlatList, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';

import { OSS_LICENSES } from '../generated/ossLicenses';
import type { OssLicenseEntry } from '../generated/ossLicenses';
import { AppStyles } from '../appStyles';
import { AppTheme } from '../../theme/theme';
import { AppScreenHeader } from './AppScreenHeader';

/** ライセンス画面のprops。 */
export type LicenseScreenProps = {
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 設定画面へ戻る処理。 */
  onBackToSettings: () => void;
  /** ライセンス詳細画面へ移動する処理。 */
  onOpenLicenseDetail: (license: OssLicenseEntry) => void;
};

/** 生成済みOSSライセンス一覧を表示する画面を描画する。 */
export function LicenseScreen({ styles, theme, onBackToSettings, onOpenLicenseDetail }: LicenseScreenProps) {
  return (
    <SafeAreaView style={styles.appScreen}>
      <AppScreenHeader backLabel="設定" styles={styles} theme={theme} title="ライセンス" onBack={onBackToSettings} />

      <FlatList
        data={OSS_LICENSES}
        keyExtractor={(license) => license.id}
        contentContainerStyle={styles.licenseList}
        renderItem={({ item: license }) => (
          <Pressable
            accessibilityLabel={`${license.name} のライセンス詳細を開く`}
            accessibilityRole="button"
            onPress={() => onOpenLicenseDetail(license)}
            style={styles.licenseListItem}
          >
            <Text style={styles.licenseListItemText}>{license.name}</Text>
            <Feather name="chevron-right" size={19} color={theme.colors.mutedText} />
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

/** ライセンス詳細画面のprops。 */
export type LicenseDetailScreenProps = {
  /** 表示するライセンス。 */
  license: OssLicenseEntry;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 一覧へ戻る処理。 */
  onBackToLicenseList: () => void;
};

/**
 * ライセンス詳細画面を描画する。
 *
 * @param props - {@link LicenseDetailScreenProps} を参照。
 */
export function LicenseDetailScreen({ license, styles, theme, onBackToLicenseList }: LicenseDetailScreenProps) {
  return (
    <SafeAreaView style={styles.appScreen}>
      <AppScreenHeader backLabel="ライセンス" styles={styles} theme={theme} title="詳細" onBack={onBackToLicenseList} />

      <ScrollView contentContainerStyle={styles.licenseDetail}>
        <Text style={styles.licenseDetailTitle}>{license.name}</Text>
        <View style={styles.licenseMetaList}>
          {license.version ? <LicenseMetaRow label="バージョン" value={license.version} styles={styles} /> : null}
          <LicenseMetaRow label="ライセンス" value={license.licenses} styles={styles} />
          {license.repository ? <LicenseMetaRow label="リポジトリ" value={license.repository} styles={styles} /> : null}
        </View>
        {license.licenseText ? <Text style={styles.licenseBodyText}>{license.licenseText}</Text> : null}
        {license.noticeText ? <Text style={styles.licenseBodyText}>{license.noticeText}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

type LicenseMetaRowProps = {
  /** 項目名。 */
  label: string;
  /** 値。 */
  value: string;
  /** 画面共通スタイル。 */
  styles: AppStyles;
};

/** ライセンス詳細のメタ情報行を描画する。 */
function LicenseMetaRow({ label, value, styles }: LicenseMetaRowProps) {
  return (
    <View style={styles.licenseMetaRow}>
      <Text style={styles.licenseMetaLabel}>{label}</Text>
      <Text style={styles.licenseMetaValue}>{value}</Text>
    </View>
  );
}
