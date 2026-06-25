import { SafeAreaView, ScrollView, Text } from 'react-native';

import { AppStyles } from '../appStyles';
import { AppTheme } from '../../theme/theme';
import { AppScreenHeader } from './AppScreenHeader';
import { ScreenSection } from './ScreenSection';

/** よくある質問画面のprops。 */
export type FaqScreenProps = {
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 設定画面へ戻る処理。 */
  onBackToSettings: () => void;
};

/** よくある質問で表示する質問と答えのセクション。 */
const FAQ_ITEMS = [
  {
    title: '止まっているのに距離や軌跡が記録されることがあります',
    body: 'GPSは屋外でも数メートルの誤差が生じます。すとろりあでは5m未満の移動をフィルタリングしていますが、それ以上のブレが発生した場合は記録されることがあります。屋内・地下・高層ビルが密集した場所では誤差が大きくなりやすいです。',
  },
  {
    title: 'アプリを閉じても記録されますか？',
    body: '位置情報の権限を「常に許可」に設定することで、バックグラウンドでも記録できます。ただし、お使いのスマートフォンの判断により記録が一時停止されることがあります。アプリ終了時や、アプリは終了していないもののホーム画面や他のアプリを使っているとき（バックグラウンドで動作しているとき）の記録を完全に保証することはできません。',
  },
  {
    title: 'GPXファイルとは何ですか？',
    body: 'GPS機器や地図アプリ間でルートや軌跡を共有するための標準的なファイル形式です。すとろりあでは記録したログをGPXファイルとしてエクスポート・インポートできます。',
  },
  {
    title: '記録したデータはサーバーに送られますか？',
    body: 'いいえ。GPSログや移動履歴はお使いの端末内にのみ保存されます。ユーザーの明示的な操作なしに外部へ送信されることはありません。',
  },
  {
    title: '機種変更するとデータはどうなりますか？',
    body: '現在、端末間の自動移行機能はありません。機種変更前にGPXエクスポートでデータをバックアップし、新しい端末でインポートすることをお勧めします。',
  },
] as const;

/** よくある質問を表示する設定内子画面。 */
export function FaqScreen({ styles, theme, onBackToSettings }: FaqScreenProps) {
  return (
    <SafeAreaView style={styles.appScreen}>
      <AppScreenHeader backLabel="設定" styles={styles} theme={theme} title="よくある質問" onBack={onBackToSettings} />

      <ScrollView contentContainerStyle={styles.aboutAppContent}>
        {FAQ_ITEMS.map((item) => (
          <ScreenSection key={item.title} styles={styles} title={item.title}>
            <Text style={styles.aboutAppBodyText}>{item.body}</Text>
          </ScreenSection>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
