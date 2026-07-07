import { Stack } from 'expo-router';

/**
 * 日別記録スタックのレイアウト。
 *
 * 子ルート(index / [date])に slide_from_right アニメーションと
 * iOS スワイプバックを適用する。
 */
export default function DailyLogsLayout(): React.ReactElement {
  return (
    <Stack
      screenOptions={{
        animation: 'slide_from_right',
        gestureEnabled: true,
        headerShown: false,
      }}
    />
  );
}
