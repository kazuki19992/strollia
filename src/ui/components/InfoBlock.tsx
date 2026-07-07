import { Text, View } from 'react-native';

import type { AppStyles } from '@/ui/appStyles';
import { DescriptionText } from './DescriptionText';

export type InfoBlockProps = {
  /** 補足本文。改行を含めてよい。 */
  description?: string;
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 項目見出し。 */
  title: string;
};

/** ボタン群の前に置く、短い説明ブロック。 */
export function InfoBlock({ description, styles, title }: InfoBlockProps) {
  return (
    <View style={styles.infoBlock}>
      <Text style={styles.formItemTitle}>{title}</Text>
      {description ? <DescriptionText styles={styles}>{description}</DescriptionText> : null}
    </View>
  );
}
