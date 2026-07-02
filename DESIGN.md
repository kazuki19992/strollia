# Strollia Screen Design

このドキュメントは、Strollia / footspot の画面デザイン方針をまとめる。
アーキテクチャやDB設計の詳細は `docs/` 配下を参照し、このファイルでは画面の見た目、画面遷移、共通UI部品、文言の扱いを中心に記録する。

## 1. デザインの方向性

Strollia は、ローカルファーストのGPSロガーでありつつ、訪問済みエリアが地図上に蓄積されていくアプリである。
画面は「記録を操作するアプリ」よりも、「記録が自然に残り、あとから気持ちよく眺められるアプリ」として設計する。

基本方針は以下とする。

- メイン画面は地図を主役にする
- 操作UIは必要な場所に絞り、地図の視認性を邪魔しない
- 新規画面はカードを多用せず、設定画面に近いリスト主体・帯状・ツールUIを優先する
- テキストは太字をデフォルトにしない
- 画面ごとの独自装飾より、共通コンポーネントとテーマ値を優先する
- GPSログ、写真、課金などのセンシティブな操作は、状態と影響が分かる文言を添える

## 2. ビジュアルトーン

Strollia の画面は、派手なSNS風ではなく、移動ログを静かに眺められる道具として見せる。

### 2.1 地図画面

地図画面はフルスクリーンを基本とする。
上部には固定パネルを増やさず、地図、OS表示、コンパス、開発フラグなど必要最小限の表示だけを置く。

下部には速度、距離、地名、画面遷移をまとめたダッシュボードを配置する。
ダッシュボードは地図上で読めるよう、半透明の濃い背景を使う。

### 2.2 設定・一覧・詳細画面

設定、日別ログ、OSSライセンス、実績一覧などの画面は、リスト主体で構成する。
大きな装飾カードを積み重ねるのではなく、以下のような構造を優先する。

- 画面ヘッダー
- 説明テキスト
- セクション見出し
- リスト行
- 選択タイル
- 小さな状態表示
- 主要アクション

画面全体を浮いたカードに入れたり、セクションごとに入れ子カードを作ったりしない。

### 2.3 レポート画面

月次レポートなどの振り返り画面は、通常画面より演出的にしてよい。
ただし、基本操作画面と混同しないよう、レポート画面内だけの表現として扱う。

レポートでは、スクロール誘導、出現アニメーション、数値の強調、共有向けの見栄えを優先する。
共有画像として切り出しても成立する構図にする。

## 3. カラーとテーマ

テーマは `src/theme/theme.ts` の `AppTheme` を正とする。
画面ごとに背景色を個別定義せず、共通テーマ値を参照する。

主なトークンの用途は以下である。

| トークン | 用途 |
| --- | --- |
| `background` | 画面全体の背景 |
| `card` | リスト行や控えめな面 |
| `cardStrong` | 少し強い面、画像フレームなど |
| `text` | 通常本文 |
| `mutedText` | 補足説明、空状態、メタ情報 |
| `border` | 区切り線、控えめな枠 |
| `primary` | 主要アクション、訪問済みエリア色 |
| `danger` | 削除など破壊的操作 |
| `surfaceOverlay` | 地図上やモーダルの半透明面 |
| `scrim` | 背景を抑える薄い覆い |

ライトモード / ダークモードはOS設定に追従する。
今後ユーザーがテーマ設定を選ぶ場合も、画面は直接色を分岐せずテーマ解決後の値を受け取る。

## 4. タイポグラフィ

テキストは読みやすさを優先する。

- 太字はデフォルトにしない
- 見出し、重要な数値、状態ラベルなど、本当に情報階層が必要な箇所だけ太字を使う
- 説明文は短く、設定や権限の影響が分かる文にする
- 数値メーターや距離表示はDSEG系フォントを使い、地図上でも一目で読めるようにする
- 文字間隔を詰めすぎない

日本語文言は、機能名よりもユーザーが理解しやすい言い方を優先する。
内部実装で `VisitedCell` と呼ぶものは、ユーザー向けには原則「エリア」と表現する。

## 5. 余白と形状

通常画面は、密度を高めすぎず、設定画面のように縦に読み下せる構造にする。

- リスト行はタップしやすい高さを確保する
- 画面端の余白はSafe Areaを考慮する
- マップ上の操作UIは、Apple Mapsの法的表示やコンパスを隠さない
- 角丸は必要な部品に限定し、画面全体を丸いカード化しない
- 入れ子カードは避ける

地図上のダッシュボードやボタンは、視認性のため例外的に濃い半透明背景と影を使ってよい。

## 6. ナビゲーション

トップレベルの起点はメインマップである。
日別ログ、実績、レポート、設定、マップ表示設定は、メインマップ下部ダッシュボードから開く。

子画面の遷移ルールは以下である。

- 親から子へ進むときは右から入る
- 戻るときは左方向へ戻る
- iOSでは左端スワイプバックを有効にする
- 地図などトップレベル画面への復帰は例外として扱ってよい

戻るボタンは `AppBackButton`、画面ヘッダーは `AppScreenHeader` を優先して使う。
戻り先のラベルは、ユーザーが戻る先を理解できる名前にする。

## 7. 主要画面

### 7.1 メインマップ

メインマップはStrolliaの中心画面である。

表示方針:

- 地図を全面に表示する
- 全履歴はPolylineではなくVisited Grid Overlayを主表示にする
- 現在地追従は初期ONにする
- ユーザーが地図をドラッグしたら追従をOFFにする
- 現在地ボタンを押したときだけ追従をONへ戻す
- 地図中心が現在地付近に戻っただけでは追従を再開しない
- 上部固定パネルは置かない

下部ダッシュボード:

- 速度リング
- 通算距離 `ODO`
- 今日の移動距離 `TODAY`
- 現在地の市区町村 / 地域名
- `日ごとの記録`
- `実績`
- `レポートを見る`
- `設定`
- `マップの表示`

速度リングはraw GPS speedに即応し、保存点の更新頻度とは分離する。

### 7.2 マップ表示設定

地図種別と写真表示は、メインマップの補助操作として扱う。

- 標準マップ / 航空写真を切り替える
- 写真表示は初期OFF
- 写真表示ONの初回操作で写真ライブラリ権限を要求する
- 権限が拒否または限定的な場合はONにしない
- ジオタグ付き写真のみを対象にする

写真はGPSログと同じくセンシティブな情報を含むため、文言は「何を読むか」「外部送信しないこと」が分かるようにする。

### 7.3 日別ログ一覧

日別ログ一覧は、保存された日ごとの記録を新しい日付順に表示する。

表示内容:

- 日付
- 記録時間帯
- 距離
- 点数
- 詳細画面への導線

日ごとの項目は `DailyLogListItem` のような軽量なリスト行を使う。
各日を大きなカードにしすぎず、一覧としてスキャンしやすくする。

### 7.4 日別詳細

日別詳細は、選択した日のルートとサマリーを表示する。

表示内容:

- 対象日のルート地図
- 開始地点
- 最新地点
- 記録開始時刻
- 記録終了時刻
- 距離
- 記録点数
- タイムライン / シーク操作
- GPX共有

地図は見返しの中心なので、補助情報より優先して十分な高さを確保する。
共有ボタンは `ShareButton` を優先する。

### 7.5 設定

設定画面は、アプリの状態確認とユーザー操作をまとめる画面である。

表示内容:

- GPS記録状態
- 権限状態とOS設定への導線
- 自動開始失敗時だけ表示する復旧用 `記録開始`
- GPXエクスポート
- GPXインポート
- マップ上の写真表示設定
- 画面ON維持設定
- Strollia Plus
- OSSライセンス
- 全データ削除

通常状態では記録開始 / 停止ボタンを置かない。
GPS記録は権限付与後に自動開始される前提であり、手動操作は復旧導線に限定する。

GPXインポート説明には、現時点でGPXのみ対応すること、既存データと競合する場合は既存データを優先することを含める。

### 7.6 実績

実績画面は、移動ログが積み上がっていることを見せる画面である。

一覧では実績画像、名前、進捗、解除状態を表示する。
ロック状態は読める程度に弱め、解除済みは達成感が出るように見せる。

実績解除モーダルは通常画面より演出を許容する。
ただし閉じ操作は分かりやすくし、スワイプ閉じも自然に扱う。

### 7.7 月次レポート

月次レポートはPlus候補の振り返り画面であり、通常設定画面よりビジュアルを強めてよい。

表示方針:

- 縦スクロール型
- 冒頭にスクロール誘導
- 距離などの大きな数値
- 対象月の移動マップ
- よく行った都道府県
- 実績ハイライト
- 共有ボタン

共有画像として見たときにも成立するよう、ページ単位の余白、コントラスト、数値の大きさを調整する。

### 7.8 OSSライセンス

OSSライセンスは設定画面から開く。

- 一覧はライブラリ名中心のリストにする
- カード型一覧にはしない
- 詳細は通常の子画面遷移として表示する
- 戻るラベルは一覧では「設定」、詳細では「ライセンス」にする

## 8. 共通コンポーネント方針

画面共通で使える部品は、特定画面名に閉じた名前にしない。

優先して再利用する部品:

- `AppScreenHeader`
- `AppBackButton`
- `AppListItem`
- `ScreenSection`
- `SectionTitle`
- `DescriptionText`
- `InfoBlock`
- `DataSummaryRow`
- `ActionPill`
- `SelectionTile`
- `OptionGroup`
- `ShareButton`
- `StepSlider`
- `RouteMapPanel`

新しい画面独自コンポーネントを作る前に、既存共通コンポーネントで表現できるか確認する。
どうしても画面独自コンポーネントが必要な場合は、理由を明確にしてから追加する。

## 9. インタラクション

主要操作では、短いアニメーションと軽いタプティックフィードバックを使ってよい。

使いどころ:

- 画面切り替え
- メニュー / パネル表示
- 現在地ボタンの表示・非表示
- 実績解除
- レポートカードの出現
- マップ種別切り替え

アニメーションは操作の意味を補うために使い、操作を待たせたり、画面の読み取りを邪魔したりしない。

## 10. 文言

文言は短く、ユーザーが次に何をすればよいか分かるようにする。

方針:

- 内部用語をそのまま出さない
- `VisitedCell` は「エリア」と表現する
- インポートは「GPXのみ」と明記する
- 既存データ優先の挙動は説明する
- 写真表示、位置情報、削除、課金は影響範囲を明記する
- エラー時は復旧方法を添える

## 11. アクセシビリティ

小さなアイコンだけの操作は避け、必要に応じてテキストラベルを併用する。
地図上のボタンは背景とのコントラストを確保する。

確認観点:

- ライト / ダーク両方で読める
- 地図上でもボタンが見える
- タップ領域が小さすぎない
- 色だけに依存して状態を伝えない
- エラーと成功状態は文言でも分かる

## 12. 避けること

- カードを多用したAI生成っぽい画面
- 画面全体を浮いたカードに入れる
- 入れ子カード
- 太字だらけの情報設計
- 画面ごとの独自背景色
- 画面固有名に閉じた再利用不能な共通部品
- GPS記録の通常開始 / 停止ボタン
- 写真やGPSログが外部送信されるように見える文言
- GPX以外に対応しているように見えるインポート説明

## 13. 実装リファレンス: デザイントークン実値

このセクション以降は、コードベースから抽出した実装用の具体値をまとめる。
値を変更した場合は、参照元のソースファイルとこのドキュメントを同時に更新する。

### 13.1 カラートークン

定義元: `src/theme/theme.ts` の `lightTheme` / `darkTheme`。

| トークン | ライト | ダーク |
| --- | --- | --- |
| `background` | `#ffffff` | `#202020` |
| `card` | `#f8f8f8` | `#252525` |
| `cardStrong` | `#f0f0f0` | `#2e2e2e` |
| `text` | `#1a1a1a` | `#f0f0f0` |
| `mutedText` | `#666666` | `#999999` |
| `border` | `#e0e0e0` | `#3a3a3a` |
| `primary` | `#1f7a5c` | `#73c7a2` |
| `primaryText` | `#fffdf8` | `#102018` |
| `danger` | `#b33f52` | `#ff8899` |
| `dangerSurface` | `#fff1f3` | `#3a2028` |
| `mapLine` | `#1f7a5c` | `#73c7a2` |
| `routeMapEmptyBackground` | `#172b63` | `#142d5c` |
| `routeMapEmptyText` | `#ffffff` | `#ffffff` |
| `shareButtonBackground` | `#333333` | `#f0f0f0` |
| `shareButtonText` | `#ffffff` | `#111111` |
| `plusCtaBackground` | `rgba(31,122,92,0.08)` | `rgba(115,199,162,0.08)` |
| `surfaceOverlay` | `rgba(248,248,248,0.94)` | `rgba(37,37,37,0.94)` |
| `scrim` | `rgba(0,0,0,0.08)` | `rgba(0,0,0,0.28)` |
| `shadow` | `#000000` | `#000000` |

注意点:

- 画面コードで色をハードコードしない。必ず `theme.colors.*` または `appStyles.ts` のスタイルを経由する
- `primary` / `primaryText` / `mapLine` はユーザーが12色プリセットで変更できる(`src/features/customization/colorPresets.ts` の `applyColorPreset`)。上表の値はデフォルトの「まっちゃ」であり、固定値として扱ってはいけない
- Plusバッジだけは例外で、プリセットに関わらず常に「まっちゃ」色を使う(`appStyles.ts` 冒頭参照)

`appStyles.ts` 内で派生する準トークン(設定系画面で使用):

| 変数 | ライト | ダーク |
| --- | --- | --- |
| `settingsText` | `#333333` | `#ffffff` |
| `settingsMuted` | `#767676` | `rgba(255,255,255,0.62)` |
| `settingsBorder` | `rgba(51,51,51,0.20)` | `rgba(255,255,255,0.28)` |
| `selectionSurface` | primaryの10%透過 | 同左 |
| `settingsGpsActive` | `#00b035` | 同左 |
| `settingsGpsDanger` | `#b0002f` | 同左 |
| `settingsWarning` | `#a36100` | 同左 |
| `mapPanelBackground` | `rgba(51,51,51,0.80)` | 同左 |
| `mapPanelText` | `#ffffff` | 同左 |

### 13.2 カラープリセット(12色)

定義元: `src/features/customization/colorPresets.ts`。デフォルトは `matcha`。

| ID | 名称 | ライトprimary | ダークprimary |
| --- | --- | --- | --- |
| matcha | まっちゃ | `#1f7a5c` | `#73c7a2` |
| wakaba | わかば | `#5a8a1a` | `#9fd45a` |
| himawari | ひまわり | `#b08000` | `#f0c040` |
| mikan | みかん | `#c06010` | `#f08840` |
| yuuyake | ゆうやけ | `#c04020` | `#f07050` |
| tomato | トマト | `#b02020` | `#f06060` |
| sakura | さくら | `#b04070` | `#f090b0` |
| tasogare | たそがれ | `#6030a0` | `#a870e0` |
| hoshizora | ほしぞら | `#3040a0` | `#7090e0` |
| umi | うみ | `#1060a0` | `#50a0e0` |
| ramune | ラムネ | `#008090` | `#40c0d0` |
| asatsuyu | あさつゆ | `#13a890` | `#5fd8be` |

### 13.3 タイポグラフィ実値

定義元: `src/app/appStyles.ts`。フォントはOS標準。数値表示のみ `DSEG7Classic-BoldItalic`(`src/theme/fonts.ts` の `NUMERIC_DISPLAY_FONT`)。

| 用途 | スタイル名 | fontSize | fontWeight | lineHeight |
| --- | --- | --- | --- | --- |
| 画面ヘッダータイトル | `appHeaderTitle` | 14 | 900 | 18 |
| ヘッダーサブタイトル | `appHeaderSubtitle` | 11 | 400 | 14 |
| セクション見出し(詳細画面) | `sectionTitle` | 18 | 900 | 23 |
| セクション見出し(設定系) | `screenSectionTitle` | 16 | 900 | 20 |
| リスト行タイトル | `appListItemTitle` | 15 | 400 | 20 |
| リスト行タイトル(強調) | `appListItemTitleProminent` | 23 | 400 | 30 |
| リスト行サブタイトル | `appListItemSubtitle` | 14 | 400 | 19 |
| 項目見出し | `formItemTitle` | 14 | 400 | 18 |
| 補足説明 | `formItemDescription` | 11 | 400 | 14 |
| データ行の値 | `dataSummaryValue` | 19 | 400 | 25 |
| ボタン(ピル) | `actionPillText` | 14 | 400 | 18 |
| 空状態タイトル | `emptyTitle` | 18 | 800 | - |

太字(900)は見出し類に限定し、本文・リスト行・ボタンは 400 を使う(§4 の方針の実装値)。

### 13.4 余白・角丸・影

余白(`appStyles.ts` の頻出値):

- 画面の左右余白: 24(`screenList` の `paddingHorizontal`)
- リスト内ギャップ: 16(`screenList` の `gap`)、セクション内: 10〜14
- リスト行: `minHeight` 56 / `paddingVertical` 13(`appListItem`)
- ヘッダー: `minHeight` 68 / 上18・下16・左右24(`appHeader`)

角丸の使い分け:

| 値 | 用途 |
| --- | --- |
| 999 | ピルボタン(`actionPill`)、アイコンボタン(`iconButton`)、バッジ |
| 26〜30 | ダイアログ、モーダル |
| 20〜24 | 実績カード、画像フレーム |
| 12〜18 | ボタン、入力枠、パネル |

影(`shadowColor` は常に `#000000`):

| 用途 | offset | opacity | radius |
| --- | --- | --- | --- |
| 標準(小さいボタン等) | (0, 4) | 0.24 | 7 |
| 浮遊ボタン・パネル | (0, 8) | 0.18〜0.28 | 12〜14 |
| 大きなパネル | (0, 18) | 0.2 | 28 |
| モーダル | (0, 24) | 0.26 | 32 |

## 14. 実装リファレンス: 共通コンポーネントカタログ

配置: `src/app/components/`。全コンポーネントに共通する規約:

- `styles: AppStyles`(`appStyles.ts` の `createStyles` 戻り値)と、テーマ色が必要なら `theme: AppTheme` を props で受け取る
- 押下可能な要素には `accessibilityLabel` と `accessibilityRole="button"` を必ず付ける
- 1ファイル1コンポーネント、named export

| コンポーネント | 用途 | 主なprops |
| --- | --- | --- |
| `AppScreenHeader` | 子画面の共通ヘッダー(中央タイトル+戻る) | `backLabel`, `title`, `subtitle?`, `onBack`, `styles`, `theme` |
| `AppBackButton` | 左上の戻るボタン(chevron-left+ラベル) | `label`, `onPress`, `styles`, `theme` |
| `AppListItem` | 詳細遷移リスト行(右端chevron-right) | `title`, `subtitle?`, `detail?`, `prominent?`, `accessibilityLabel`, `onPress`, `styles`, `theme` |
| `DailyLogListItem` | 日別ログ行(AppListItemのラッパー) | `log`, `startAreaName?`, `endAreaName?`, `onPress`, `styles`, `theme` |
| `ScreenSection` | セクション見出し+本文領域 | `title`, `children`, `styles` |
| `SectionTitle` | セクション見出し単体 | `children`, `styles` |
| `DescriptionText` | ミュートカラーの補足説明 | `children`, `styles` |
| `InfoBlock` | 見出し+補足のブロック(ボタン群の前置き) | `title`, `description?`, `styles` |
| `DataSummaryRow` | ラベルと値を罫線付きで並べる行 | `label`, `value`, `styles` |
| `ActionPill` | アウトラインのピル型アクションボタン | `label`, `icon?`, `danger?`, `disabled?`, `alignLeft?`, `onPress`, `styles` |
| `SelectionTile` | primary枠+10%塗りで選択状態を表すタイル | `label`, `icon?`, `swatchColor?`, `isSelected?`, `wide?`, `onPress?`, `styles` |
| `OptionGroup` | 2択/3択の横並び選択ボタン群 | `title`, `note?`, `children`, `styles` |
| `ShareButton` | 共有ボタン(icon/wideバリアント) | `accessibilityLabel`, `iconColor`, `label?`, `variant?`, `onPress` |
| `StepSlider` | 単一つまみのスライダー | - |
| `RangeSlider` | 2つまみの範囲スライダー(時間帯選択) | `minValue`, `maxValue`, `stepValue`, `startValue`, `endValue`, `onChange` 他 |
| `Dialog` | 共通ダイアログ(スワイプ閉じ・紙吹雪・自動クローズ) | `visible`, `children`, `dismissible?`, `swipeToClose?`, `showConfetti?`, `autoClose?`, `onClose`, `styles` |
| `RouteMapPanel` | 保存済みルートのMapView表示 | `points`, `regionPoints?`, `emptyLabel`, `onMapLoaded?`, `styles`, `theme` |
| `TopToast` | 画面上部のトースト | - |
| `IndeterminateProgressBar` | 不定長プログレスバー | - |

## 15. 実装リファレンス: 画面実装の雛形

標準的な子画面の構成(実例: `src/app/components/DailyLogsScreen.tsx`):

```tsx
import { SafeAreaView, ScrollView, Text, View } from 'react-native';

import { AppTheme } from '../../theme/theme';
import { AppStyles } from '../appStyles';
import { AppScreenHeader } from './AppScreenHeader';

/** ○○画面のprops。 */
export type XxxScreenProps = {
  /** 画面共通スタイル。 */
  styles: AppStyles;
  /** 現在テーマ。 */
  theme: AppTheme;
  /** 戻る処理。 */
  onBack: () => void;
};

/** ○○画面を描画する。 */
export function XxxScreen({ styles, theme, onBack }: XxxScreenProps) {
  return (
    <SafeAreaView style={styles.appScreen}>
      <AppScreenHeader backLabel="設定" styles={styles} theme={theme} title="○○" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.screenList}>
        {/* ScreenSection / AppListItem / ActionPill などを並べる */}
      </ScrollView>
    </SafeAreaView>
  );
}
```

実装ルール:

- ルートは `SafeAreaView` + `styles.appScreen`(背景は `theme.colors.background`)
- スタイルは `appStyles.ts` の `createStyles(theme)` に集約する。画面ローカルの `StyleSheet.create` は原則作らない
- 画面はデータと操作を props で受け取る。DB操作や端末API呼び出しは画面内に直接書かず、呼び出し元(App.tsx)やサービス層から渡す
- 空状態は `emptyTitle` / `emptyText` スタイルで文言を表示する

ナビゲーション(実例: `src/app/App.tsx`):

- 日別記録系・設定系はそれぞれ `createNativeStackNavigator` + 独立した `NavigationContainer`(`NavigationIndependentTree`)で構成する
- `screenOptions` は `{ animation: 'slide_from_right', gestureEnabled: true, headerShown: false }`(右入り/左戻り+iOSスワイプバック、§6 の実装値)
- 新しい子画面は該当スタック(`SettingsStack` / `DailyLogStack`)に `Stack.Screen` を追加する
- Sentry 用に画面名を `Settings:XxxScreen` 形式で `updateSentryScreenContext` へ通知する(既存の `onStateChange` パターンに従う)

## 16. 実装リファレンス: アイコン・アニメーション・ハプティクス

アイコン(`@expo/vector-icons`):

- 一般UI(chevron、共有、設定など): `Feather`
- 機能・状態(ロック、トロフィー、衛星など): `MaterialCommunityIcons`
- サイズ: リスト・ボタン 16〜24 / パネルボタン 28 / ダッシュボード 30〜36
- 色は `theme.colors.text` / `mutedText` / `primary` を使う。地図上の固定ダークUIのみ `#ffffff`

アニメーション(React Native標準 `Animated` のみ。Reanimated は不使用):

- ダイアログ登場: `Animated.spring`(damping 9, mass 0.72, stiffness 190)
- ダイアログ退場: `Animated.timing`(duration 500)
- ドラッグ復帰: `Animated.spring`(damping 12, stiffness 210)
- レイアウト変化: `LayoutAnimation.configureNext`(easeInEaseOut)
- 実装は `src/app/components/Dialog.tsx` を参照

ハプティクス(`expo-haptics`):

- 実績解除など達成イベント: `Haptics.notificationAsync(Success)`
- 選択操作: `Haptics.selectionAsync()`
- 軽い操作フィードバック: `Haptics.impactAsync(ImpactFeedbackStyle.Light)`

## 17. 実装リファレンス: レポート画面専用カラー

月次レポート(§7.7)はテーマに追従せず常にダーク基調で描画する。
定義元: `src/app/components/reports/reportStyles.ts`。

| 用途 | 値 |
| --- | --- |
| 背景 | `#202020` |
| 面 | `#2d2d2d` |
| 浮いた面 | `#383838` |
| テキスト | `#ffffff` |
| ミュート | `rgba(255,255,255,0.66)` |
| 罫線・控えめ | `rgba(255,255,255,0.18)` |
| アクセント(ゴールド) | `#f5a900` |

レポート系のスタイルは `reportStyles.ts` に閉じ、`appStyles.ts` と混ぜない。

## 18. 変更時の確認

画面デザインを変更した場合は、以下を確認する。

- ライト / ダークで背景、文字、境界線が破綻していない
- メインマップ上のUIが地図、法的表示、コンパスを隠していない
- 新規画面がカード主体になっていない
- 共通コンポーネントを再利用できている
- 太字が必要な箇所に限定されている
- 子画面遷移が右入り / 左戻りになっている
- iOSの左端スワイプバックが可能な画面で有効になっている
- テストの画面説明文が日本語で書かれている
- ユーザー向け挙動を変えた場合は関連する `docs/` も更新している

