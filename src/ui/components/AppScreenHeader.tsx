import { Text, View } from 'react-native';

import type { AppStyles } from '@/ui/appStyles';
import type { AppTheme } from '@/theme/theme';
import { AppBackButton } from './AppBackButton';

export type AppScreenHeaderProps = {
  /** 戻るボタンの表示名。 */
  backLabel: string;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 画面タイトル。 */
  title: string;
  /** タイトル下に表示する補助テキスト。 */
  subtitle?: string;
  /** 戻る処理。 */
  onBack: () => void;
};

/** アプリ内の子画面で共通利用する、中央タイトル付きヘッダー。 */
export function AppScreenHeader({ backLabel, styles, theme, title, subtitle, onBack }: AppScreenHeaderProps) {
  return (
    <View style={styles.appHeader}>
      <AppBackButton label={backLabel} styles={styles} theme={theme} onPress={onBack} />
      {subtitle ? (
        <View style={styles.appHeaderTitleStack}>
          <Text style={styles.appHeaderTitleInStack}>{title}</Text>
          <Text style={styles.appHeaderSubtitle}>{subtitle}</Text>
        </View>
      ) : (
        <Text style={styles.appHeaderTitle}>{title}</Text>
      )}
    </View>
  );
}
