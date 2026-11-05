import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { AppStyles } from '@/ui/appStyles';

/** 2段レイアウトの props。 */
export type TwoPaneLayoutProps = {
  /** 左ペインに表示する内容。 */
  primary: ReactNode;
  /** 右ペインに表示する内容。 */
  secondary: ReactNode;
  /** アプリ共通スタイル。 */
  styles: AppStyles;
  /** ルート要素のtestID。 */
  testID?: string;
};

/** 横画面で左右を50:50に分けて並べる汎用レイアウト。縦画面では呼び出し側が使わない。 */
export function TwoPaneLayout({ primary, secondary, styles, testID }: TwoPaneLayoutProps) {
  return (
    <View style={styles.twoPaneRow} testID={testID}>
      <View style={styles.twoPanePane} testID="two-pane-primary">
        {primary}
      </View>
      <View style={styles.twoPanePane} testID="two-pane-secondary">
        {secondary}
      </View>
    </View>
  );
}
