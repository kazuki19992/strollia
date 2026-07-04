import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import type { AppStyles } from '@/app/appStyles';
import { DescriptionText } from './DescriptionText';

export type OptionGroupProps = {
  /** 選択肢。 */
  children: ReactNode;
  /** 見出し下に表示する補足説明。 */
  note?: string;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 項目見出し。 */
  title: string;
};

/** 2択/3択の横並び選択ボタン群。 */
export function OptionGroup({ children, note, styles, title }: OptionGroupProps) {
  return (
    <View style={styles.optionGroup}>
      <View style={styles.optionGroupHeader}>
        <Text style={styles.formItemTitle}>{title}</Text>
      </View>
      {note ? <DescriptionText styles={styles}>{note}</DescriptionText> : null}
      <View style={styles.optionGroupGrid}>{children}</View>
    </View>
  );
}
