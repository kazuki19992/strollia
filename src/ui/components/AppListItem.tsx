import { Feather } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import type { ReactNode } from 'react';

import type { AppTheme } from '@/theme/theme';
import type { AppStyles } from '@/ui/appStyles';

export type AppListItemProps = {
  /** アクセシビリティ用の行ラベル。 */
  accessibilityLabel: string;
  /** 補足情報。 */
  detail?: string;
  /** タイトル・サブタイトルの下に表示する追加要素。進捗バーなどを差す汎用スロット。 */
  footer?: ReactNode;
  /** 行の先頭に表示する補助アイコンなどの要素。 */
  leading?: ReactNode;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** サブタイトル。 */
  subtitle?: string;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 行タイトル。 */
  title: string;
  /** 行の右端(chevron-rightの手前)に表示する補助要素を差す汎用スロット。到達済みバッジなどに使う。 */
  trailing?: ReactNode;
  /** 押下処理。 */
  onPress: () => void;
  /** 日別ログなど、タイトルを強めに見せる行か。 */
  prominent?: boolean;
  /** 右端のchevron-rightを表示するか。既定はtrue。画面遷移しない行(地図ズームのみ等)ではfalseにして誤誘導を避ける。 */
  showChevron?: boolean;
};

/** アプリ内の詳細遷移リストで共通利用する行コンポーネント。 */
export function AppListItem({
  accessibilityLabel,
  detail,
  footer,
  leading,
  styles,
  subtitle,
  theme,
  title,
  trailing,
  prominent = false,
  showChevron = true,
  onPress,
}: AppListItemProps) {
  return (
    <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" onPress={onPress} style={styles.appListItem}>
      {leading ? <View>{leading}</View> : null}
      <View style={styles.appListItemTextColumn}>
        <Text style={[styles.appListItemTitle, prominent && styles.appListItemTitleProminent]}>{title}</Text>
        {subtitle ? <Text style={styles.appListItemSubtitle}>{subtitle}</Text> : null}
        {detail ? <Text style={styles.appListItemDetail}>{detail}</Text> : null}
        {footer ? <View style={styles.appListItemFooter}>{footer}</View> : null}
      </View>
      {trailing ? <View>{trailing}</View> : null}
      {showChevron ? <Feather name="chevron-right" size={24} color={theme.colors.mutedText} /> : null}
    </Pressable>
  );
}
