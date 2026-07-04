import { Image, SafeAreaView, ScrollView, Text, View } from 'react-native';

import { AppStyles } from '../appStyles';
import { AppTheme } from '../../theme/theme';
import { AppScreenHeader } from './AppScreenHeader';
import { ScreenSection } from './ScreenSection';

/** アプリ説明画面のprops。 */
export type AboutAppScreenProps = {
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 設定画面へ戻る処理。 */
  onBackToSettings: () => void;
};

/** アプリ説明で表示する本文セクション。 */
const ABOUT_APP_SECTIONS = [
  {
    title: '歩いた場所を、あなたの記録として残す',
    body: 'すとろりあは、毎日の移動や散歩の足あとを端末に残していくGPSロガーです。地図を埋めたり、日々の距離を振り返ったりしながら、自分だけの移動記録を育てていけます。',
  },
  {
    title: 'ローカルファースト',
    body: 'GPSログや移動履歴は端末内に保存します。ユーザーの明示操作なしに、移動履歴や写真メタデータを外部へ送信しません。',
  },
  {
    title: '現在地を使う機能について',
    body: '現在地を利用する機能を追加する場合があります。その場合も、機能を明示的に有効にしたときだけ、必要な現在地情報を外部サービスへ送信する設計にします。移動履歴をサーバーに保存することはありません。',
  },
  {
    title: 'Plusについて',
    body: 'Strollia Plusは、記録をもっと楽しく便利にするための追加機能です。基本の記録体験と、ユーザー自身がデータを扱えることを大切にします。',
  },
] as const;

/** すとろりあの概要とプライバシー方針を表示する設定内子画面。 */
export function AboutAppScreen({ styles, theme, onBackToSettings }: AboutAppScreenProps) {
  return (
    <SafeAreaView style={styles.appScreen}>
      <AppScreenHeader backLabel="設定" styles={styles} theme={theme} title="このアプリについて" onBack={onBackToSettings} />

      <ScrollView contentContainerStyle={styles.aboutAppContent}>
        <View style={styles.aboutAppIconWrap}>
          <Image accessibilityLabel="すとろりあのアプリアイコン" source={require('../../../assets/icon.png')} style={styles.aboutAppIcon} />
        </View>

        {ABOUT_APP_SECTIONS.map((section) => (
          <ScreenSection key={section.title} styles={styles} title={section.title}>
            <Text style={styles.aboutAppBodyText}>{section.body}</Text>
          </ScreenSection>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
