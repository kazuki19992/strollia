import { Feather } from '@expo/vector-icons';
import { Pressable, Text } from 'react-native';

import type { AppStyles } from '../appStyles';
import type { AppTheme } from '../../theme/theme';

export type AppBackButtonProps = {
  /** 戻る先の表示名。 */
  label: string;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 押下処理。 */
  onPress: () => void;
};

/** 子画面の左上で使う共通の戻るボタン。 */
export function AppBackButton({ label, styles, theme, onPress }: AppBackButtonProps) {
  return (
    <Pressable accessibilityLabel={`${label}へ戻る`} accessibilityRole="button" onPress={onPress} style={styles.appHeaderBackButton}>
      <Feather name="chevron-left" size={22} color={theme.name === 'dark' ? theme.colors.primaryText : theme.colors.text} />
      <Text style={styles.appHeaderBackButtonText}>{label}</Text>
    </Pressable>
  );
}
