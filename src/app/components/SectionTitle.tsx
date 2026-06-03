import { Text } from 'react-native';

import type { AppStyles } from '../appStyles';

export type SectionTitleProps = {
  /** 見出し文言。 */
  children: string;
  /** 画面共通スタイル。 */
  styles: AppStyles;
};

/** 詳細画面やリスト内で使うセクション見出し。 */
export function SectionTitle({ children, styles }: SectionTitleProps) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}
