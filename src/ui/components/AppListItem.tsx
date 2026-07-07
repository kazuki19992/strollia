import { Feather } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';

import type { AppTheme } from '@/theme/theme';
import type { AppStyles } from '@/ui/appStyles';

export type AppListItemProps = {
  /** アクセシビリティ用の行ラベル。 */
  accessibilityLabel: string;
  /** 補足情報。 */
  detail?: string;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** サブタイトル。 */
  subtitle?: string;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 行タイトル。 */
  title: string;
  /** 押下処理。 */
  onPress: () => void;
  /** 日別ログなど、タイトルを強めに見せる行か。 */
  prominent?: boolean;
};

/** アプリ内の詳細遷移リストで共通利用する行コンポーネント。 */
export function AppListItem({ accessibilityLabel, detail, styles, subtitle, theme, title, prominent = false, onPress }: AppListItemProps) {
  return (
    <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" onPress={onPress} style={styles.appListItem}>
      <View style={styles.appListItemTextColumn}>
        <Text style={[styles.appListItemTitle, prominent && styles.appListItemTitleProminent]}>{title}</Text>
        {subtitle ? <Text style={styles.appListItemSubtitle}>{subtitle}</Text> : null}
        {detail ? <Text style={styles.appListItemDetail}>{detail}</Text> : null}
      </View>
      <Feather name="chevron-right" size={24} color={theme.colors.mutedText} />
    </Pressable>
  );
}
