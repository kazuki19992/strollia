import { SafeAreaView, ScrollView, Text, View } from 'react-native';

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
const FAQ_SECTIONS = [
  {
    title: 'GPSログの保存先はどこですか？',
    body: 'すべてのGPSログとデータは端末内に保存されます。ユーザーの明示操作なしに外部へ送信されません。',
  },
  {
    title: 'データをバックアップできますか？',
    body: 'GPXファイル形式でエクスポートしてバックアップできます。設定画面のデータ管理セクションからエクスポートしてください。',
  },
  {
    title: 'バックアップを復元できますか？',
    body: 'はい、GPXファイルをインポートして復元できます。インポート時にデータが競合する場合は既存データを優先します。',
  },
  {
    title: 'Strollia Plusでできることは何ですか？',
    body: 'Strollia Plusでは、アプリカラーのカスタマイズや現在地アイコンの選択など、記録をもっと楽しく便利にする追加機能が利用できます。',
  },
] as const;

/** よくある質問を表示する設定内子画面。 */
export function FaqScreen({ styles, theme, onBackToSettings }: FaqScreenProps) {
  return (
    <SafeAreaView style={styles.appScreen}>
      <AppScreenHeader backLabel="設定" styles={styles} theme={theme} title="よくある質問" onBack={onBackToSettings} />

      <ScrollView contentContainerStyle={styles.aboutAppContent}>
        {FAQ_SECTIONS.map((section) => (
          <ScreenSection key={section.title} styles={styles} title={section.title}>
            <Text style={styles.aboutAppBodyText}>{section.body}</Text>
          </ScreenSection>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
