import { Stack } from 'expo-router';

/**
 * 設定スタックのレイアウト。
 *
 * 子ルート(index / about / faq / licenses / licenses/[name])に
 * slide_from_right アニメーションと iOS スワイプバックを適用する。
 */
export default function SettingsLayout(): React.ReactElement {
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
