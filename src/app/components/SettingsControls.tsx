import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { AppStyles } from '../appStyles';
import type { AppTheme } from '../../theme/theme';

type SettingsSectionProps = {
  /** セクション内の内容。 */
  children: ReactNode;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** セクション見出し。 */
  title: string;
};

/** 設定系画面で使うセクション見出しと本文領域。 */
export function SettingsSection({ children, styles, title }: SettingsSectionProps) {
  return (
    <View style={styles.settingsSection}>
      <Text style={styles.settingsSectionTitle}>{title}</Text>
      <View style={styles.settingsSectionBody}>{children}</View>
    </View>
  );
}

type SettingsScreenHeaderProps = {
  /** 戻るボタンの表示名。 */
  backLabel: string;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 画面タイトル。 */
  title: string;
  /** 戻る処理。 */
  onBack: () => void;
};

/** 設定系の子画面で共通利用する、中央タイトル付きヘッダー。 */
export function SettingsScreenHeader({ backLabel, styles, theme, title, onBack }: SettingsScreenHeaderProps) {
  return (
    <View style={styles.settingsHeader}>
      <Pressable accessibilityLabel={`${backLabel}へ戻る`} accessibilityRole="button" onPress={onBack} style={styles.settingsBackRibbon}>
        <Feather name="chevron-left" size={22} color={theme.name === 'dark' ? '#333333' : theme.colors.text} />
        <Text style={styles.settingsBackRibbonText}>{backLabel}</Text>
      </Pressable>
      <Text style={styles.settingsHeaderTitle}>{title}</Text>
    </View>
  );
}

type SettingsInfoBlockProps = {
  /** 補足本文。改行を含めてよい。 */
  description?: string;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 項目見出し。 */
  title: string;
};

/** ボタン群の前に置く、設定項目の短い説明。 */
export function SettingsInfoBlock({ description, styles, title }: SettingsInfoBlockProps) {
  return (
    <View style={styles.settingsInfoBlock}>
      <Text style={styles.settingsItemTitle}>{title}</Text>
      {description ? <Text style={styles.settingsItemDescription}>{description}</Text> : null}
    </View>
  );
}

type SettingsOptionGroupProps = {
  /** 選択肢。 */
  children: ReactNode;
  /** 現在設定メモ。 */
  note?: string;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 項目見出し。 */
  title: string;
};

/** 2択/3択の横並び選択ボタン群。 */
export function SettingsOptionGroup({ children, note, styles, title }: SettingsOptionGroupProps) {
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

type SettingsSelectionTileProps = {
  /** アイコン表示。 */
  icon?: ReactNode;
  /** 選択中かどうか。 */
  isSelected?: boolean;
  /** 表示名。改行を含めてよい。 */
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

/** primary枠と10%塗りで選択状態を表すアウトライン選択ボタン。 */
export function SettingsSelectionTile({ icon, isSelected = false, label, onPress, styles, swatchColor, wide = false }: SettingsSelectionTileProps) {
  return (
    <Pressable
      accessibilityLabel={label.replace(/\n/g, '')}
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

type SettingsActionPillProps = {
  /** 内容を左寄せするか。 */
  alignLeft?: boolean;
  /** 背景色を上書きする場合の色。 */
  backgroundColor?: string;
  /** 枠線色を上書きする場合の色。 */
  borderColor?: string;
  /** 危険操作かどうか。 */
  danger?: boolean;
  /** 無効化するか。 */
  disabled?: boolean;
  /** 左側アイコン。 */
  icon?: ReactNode;
  /** 表示名。 */
  label: string;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 文字色を上書きする場合の色。 */
  textColor?: string;
  /** 押下処理。 */
  onPress: () => void;
};

/** 設定画面下部のアウトラインピルボタン。 */
export function SettingsActionPill({
  alignLeft = false,
  backgroundColor,
  borderColor,
  danger = false,
  disabled = false,
  icon,
  label,
  styles,
  textColor,
  onPress,
}: SettingsActionPillProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.settingsActionPill,
        danger && styles.settingsActionPillDanger,
        alignLeft && styles.settingsActionPillLeft,
        backgroundColor ? { backgroundColor } : null,
        borderColor ? { borderColor } : null,
        disabled && styles.buttonDisabled,
      ]}
    >
      <View style={[styles.settingsActionPillContent, alignLeft && styles.settingsActionPillContentLeft]}>
        {icon}
        <Text style={[styles.settingsActionPillText, danger && styles.settingsActionPillDangerText, textColor ? { color: textColor } : null]}>{label}</Text>
      </View>
    </Pressable>
  );
}
