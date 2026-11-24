import { Redirect } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useAppState } from '@/ui/state/AppStateProvider';

/**
 * 年間レポートルート(/annual-report)。
 *
 * 表示できるレポートがない(公開期間外・未完了)ときは、ディープリンクなどで直接来ても地図へ戻す。
 * 本体のストーリー画面(AnnualReportScreen)は後続タスクで差し替える。それまでの仮の画面で、閉じる操作だけを持つ。
 */
export default function AnnualReportRoute(): React.ReactElement {
  const s = useAppState();

  if (!s.annualReport) {
    return <Redirect href="/" />;
  }

  return (
    <View style={s.styles.appScreen}>
      <Text>{`${s.annualReport.year}年の年間レポート`}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="閉じる" onPress={s.closeAnnualReport}>
        <Text>閉じる</Text>
      </Pressable>
    </View>
  );
}
