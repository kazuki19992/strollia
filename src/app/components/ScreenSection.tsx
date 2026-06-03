import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import type { AppStyles } from '../appStyles';

export type ScreenSectionProps = {
  /** セクション内の内容。 */
  children: ReactNode;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** セクション見出し。 */
  title: string;
};

/** 画面内のセクション見出しと本文領域。 */
export function ScreenSection({ children, styles, title }: ScreenSectionProps) {
  return (
    <View style={styles.screenSection}>
      <Text style={styles.screenSectionTitle}>{title}</Text>
      <View style={styles.screenSectionBody}>{children}</View>
    </View>
  );
}
