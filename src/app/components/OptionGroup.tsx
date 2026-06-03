import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import type { AppStyles } from '../appStyles';

export type OptionGroupProps = {
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
export function OptionGroup({ children, note, styles, title }: OptionGroupProps) {
  return (
    <View style={styles.optionGroup}>
      <View style={styles.optionGroupHeader}>
        <Text style={styles.formItemTitle}>{title}</Text>
        {note ? <Text style={styles.optionGroupNote}>{note}</Text> : null}
      </View>
      <View style={styles.optionGroupGrid}>{children}</View>
    </View>
  );
}
