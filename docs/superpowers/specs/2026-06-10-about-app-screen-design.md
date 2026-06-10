# このアプリについて画面 Design

## 目的

設定画面から開ける「このアプリについて」子画面を追加し、Strollia が何を大切にするアプリかをユーザーに短く伝える。

## ユーザー体験

- 設定画面の「アプリ情報」セクションに「このアプリについて」を追加する。
- 位置は「オープンソースライセンス」の上にする。
- タップすると設定内の子画面へ遷移する。
- 子画面は共通ヘッダーを使い、戻る先は設定画面にする。
- 本文に入る前に、画面中央へ `assets/icon.png` のアプリアイコンを表示する。

## 本文方針

本文はユーザー向けのやわらかい紹介文にする。初稿では以下を含める。

- Strollia は歩いた場所や移動の記録を残すGPSロガーであること。
- GPSログは端末内に保存するローカルファーストの考え方。
- ユーザーの明示操作なしにGPSログや写真メタデータを外部送信しないこと。
- Plus機能は記録を便利に楽しくする追加機能で、基本の記録体験を大切にすること。

## 実装方針

- `src/app/components/AboutAppScreen.tsx` を新規作成する。
- `src/app/App.tsx` の `SettingsStackParamList` に `AboutApp` を追加する。
- `SettingsScreen` に `onOpenAboutAppScreen` props を追加し、アプリ情報セクションで `ActionPill` を表示する。
- スタイルは既存の設定画面・ライセンス画面の `appScreen`、`screenList`、`formItemTitle`、`formItemDescription` を基準にし、必要なアイコン用スタイルだけ追加する。

## テスト方針

- `SettingsScreen.test.tsx` で「このアプリについて」がライセンスより前に表示され、押下で `onOpenAboutAppScreen` が呼ばれることを確認する。
- `AboutAppScreen.test.tsx` を追加し、タイトル、戻る導線、アイコン画像、本文の主要文言を確認する。

