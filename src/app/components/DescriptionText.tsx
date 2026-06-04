import { Text } from 'react-native';

import type { AppStyles } from '../appStyles';

export type DescriptionTextProps = {
  /** 説明テキスト。 */
  children: string;
  /** 画面共通スタイル。 */
  styles: AppStyles;
};

/** 補足・注釈として使う小さいミュートカラーのテキスト。 */
export function DescriptionText({ children, styles }: DescriptionTextProps) {
  return <Text style={styles.formItemDescription}>{children}</Text>;
}
