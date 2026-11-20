import { Text } from 'react-native';

import type { AppStyles } from '@/ui/appStyles';

export type DescriptionTextProps = {
  /** 説明テキスト。 */
  children: string;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** trueなら中央揃えにする。ボタンの下など、中央にまとめた要素に添える補足で使う。 */
  centered?: boolean;
};

/** 補足・注釈として使う小さいミュートカラーのテキスト。 */
export function DescriptionText({ children, styles, centered = false }: DescriptionTextProps) {
  return (
    <Text style={centered ? [styles.formItemDescription, styles.descriptionTextCentered] : styles.formItemDescription}>{children}</Text>
  );
}
