import { Stack } from 'expo-router';

/**
 * 実績スタックのレイアウト。
 *
 * 子ルート(index / [packId])に slide_from_right アニメーションと
 * iOS スワイプバックを適用する。
 */
export default function AchievementsLayout(): React.ReactElement {
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
