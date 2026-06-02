import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, SafeAreaView, ScrollView, Text, View } from 'react-native';

import { OSS_LICENSES } from '../generated/ossLicenses';
import type { OssLicenseEntry } from '../generated/ossLicenses';
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
  const [selectedLicense, setSelectedLicense] = useState<OssLicenseEntry | null>(null);

  return (
    <SafeAreaView style={styles.settingsScreen}>
      <View style={styles.settingsHeader}>
        <Pressable accessibilityLabel="設定画面へ戻る" accessibilityRole="button" onPress={onBackToSettings} style={styles.settingsBackRibbon}>
          <Feather name="chevron-left" size={22} color={theme.name === 'dark' ? '#333333' : theme.colors.text} />
          <Text style={styles.settingsBackRibbonText}>設定</Text>
        </Pressable>
        <Text style={styles.settingsHeaderTitle}>ライセンス</Text>
        <View style={styles.settingsHeaderSpacer} />
      </View>

      <FlatList
        data={OSS_LICENSES}
        keyExtractor={(license) => license.id}
        contentContainerStyle={styles.licenseList}
        renderItem={({ item: license }) => (
          <Pressable
            accessibilityLabel={`${license.name} のライセンス詳細を開く`}
            accessibilityRole="button"
            onPress={() => setSelectedLicense(license)}
            style={styles.licenseListItem}
          >
            <Text style={styles.licenseListItemText}>{license.name}</Text>
            <Feather name="chevron-right" size={19} color={theme.colors.mutedText} />
          </Pressable>
        )}
      />

      <LicenseDetailDialog
        license={selectedLicense}
        styles={styles}
        theme={theme}
        onClose={() => setSelectedLicense(null)}
      />
    </SafeAreaView>
  );
}

type LicenseDetailDialogProps = {
  /** 表示するライセンス。 */
  license: OssLicenseEntry | null;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 一覧へ戻る処理。 */
  onClose: () => void;
};

/** ライセンス詳細を全画面ダイアログとして描画する。 */
function LicenseDetailDialog({ license, styles, theme, onClose }: LicenseDetailDialogProps) {
  return (
    <Modal animationType="slide" presentationStyle="fullScreen" visible={license !== null} onRequestClose={onClose}>
      <SafeAreaView style={styles.settingsScreen}>
        <View style={styles.settingsHeader}>
          <Pressable accessibilityLabel="ライセンス詳細を閉じる" accessibilityRole="button" onPress={onClose} style={styles.settingsBackRibbon}>
            <Feather name="chevron-left" size={22} color={theme.name === 'dark' ? '#333333' : theme.colors.text} />
            <Text style={styles.settingsBackRibbonText}>閉じる</Text>
          </Pressable>
          <Text style={styles.settingsHeaderTitle}>詳細</Text>
          <View style={styles.settingsHeaderSpacer} />
        </View>

        {license ? (
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
        ) : null}
      </SafeAreaView>
    </Modal>
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
