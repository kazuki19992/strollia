# アプリ更新通知ダイアログ 設計

## 1. 目的

ストア経由でアプリを更新した既存ユーザーに限り、更新後の最初の起動で「アプリを更新しました」と更新内容を案内する。

- 新規インストールでは更新通知を表示せず、既存の初回チュートリアルを優先する
- 既存のスワイプで閉じられる `Dialog` 内に、工事看板風の更新通知コンポーネントを表示する
- 設定画面から最新の更新内容を再表示できるようにする
- 設定画面から開いた場合だけ、ダイアログ下部に「ストアページへ」ボタンを表示する
- 更新内容はリリースノート作成時に同じ差分から生成し、アプリ内の最新1件だけを保持する

## 2. 対象外

- 過去バージョンの更新履歴一覧
- サーバーやRemote Configからの更新内容取得
- Expo OTA更新の検出。対象は `Application.nativeApplicationVersion` が変わるストア配布版とする
- この実装作業中のバージョン更新や、未確定の更新内容の作成

## 3. 更新通知定義

`src/features/app-update/updateNotices.ts` に、最新1件だけを定義する。

```ts
export type AppUpdateNotice = {
  version: string;
  kind: 'feature' | 'fix';
  heading: string;
  sectionTitle: string;
  items: readonly string[];
  showMore: boolean;
};

export const LATEST_UPDATE_NOTICE: AppUpdateNotice | null = null;
```

実装PRではリリース版と掲載内容が未確定のため `null` とする。リリース準備時に `release-notes` スキルが候補を生成し、ユーザー承認後に最新定義を置き換える。

定義は次の条件をすべて満たす場合だけ有効とする。

- `version` が `Application.nativeApplicationVersion` と完全一致する
- `items` は1件または2件
- 各 `item` は `Array.from(item).length` で10文字以内
- `showMore: true` は、リリースノート上のユーザー向け候補が3件以上あり、`items` が2件に絞られていることを示す

不正な定義、対象版との不一致、ネイティブ版番号を取得できない環境では通知を表示しない。設定画面の再表示ボタンも出さない。

## 4. 永続化と表示判定

SQLiteの既存 `app_settings` を使い、次の文字列設定を追加する。DBスキーマ変更は行わない。

```text
lastAcknowledgedUpdateNoticeVersion
```

起動時は `useAppInitialization` で、既存の `firstLaunchTutorialCompleted` と一緒に読み込む。

| 状態 | 起動時の動作 |
| --- | --- |
| チュートリアル未完了 | チュートリアルだけを表示し、更新通知は表示しない |
| チュートリアル完了済み、現在版の有効な通知なし | 更新通知を表示しない |
| チュートリアル完了済み、保存版と通知版が同じ | 更新通知を表示しない |
| チュートリアル完了済み、保存版が空または通知版と異なる | 更新通知を自動表示する |

初回チュートリアルの通常完了時は、`firstLaunchTutorialCompleted: true` と、有効な現在版通知があれば `lastAcknowledgedUpdateNoticeVersion` を `setSettings` で同じトランザクションに保存する。これにより、新規インストール後の次回起動で現在版を「更新」と誤認しない。設定からのチュートリアル再表示では更新通知の既読値を変更しない。

自動表示した更新通知を閉じた場合は、閉じ方が×ボタン、OS戻る、スワイプのいずれでも、現在の通知版を保存して非表示にする。保存失敗時は既存方針に合わせて警告ログを残す。ユーザー操作によるクローズは妨げないため、保存に失敗すると次回起動で再表示される可能性がある。

設定画面から開いた場合は既読値を変更せず、単にダイアログを閉じる。

## 5. UI構成

### 5.1 グローバルダイアログ

`src/ui/components/AppUpdateNoticeDialog.tsx` を追加し、`src/app/_layout.tsx` のグローバルモーダル群へ配置する。

- 既存の `Dialog` を使用する
- `swipeToClose` は有効、`autoClose` は無効とする
- ダイアログ本体の既存の角丸、閉じるボタン、登退場アニメーション、「スワイプで閉じる」表示は維持する
- 初回チュートリアル、実績解除、Paywallなど別のグローバルモーダルが表示中の場合は更新通知を待機させ、同時表示を避ける

表示元は `automatic` と `settings` の2種類とする。`settings` の場合だけ、看板の下に「ストアページへ」ボタンを追加する。

### 5.2 工事看板コンポーネント

`src/ui/components/AppUpdateNoticeSign.tsx` を追加し、画像ではなくReact Nativeの `View` と `Text` で構成する。文言の差し替え、文字読み上げ、画面幅への追従を可能にする。

添付デザインに合わせて次の順に表示する。

1. 青い上帯に白文字で「アプリを新しくしました」または修正向けの上段文言
2. 白地に青文字の大見出し
3. 青枠の更新内容欄
4. 青い丸棒の `Ver X.Y.Z`
5. 右寄せの小さな「詳しくはリリースノートをご確認ください」

看板本体と更新内容欄は `borderRadius: 0` とし、角丸に切り抜かない。バージョン帯だけは `borderRadius: 999` の丸棒にする。看板はライト／ダークモードにかかわらず固定の青と白で描画し、工事看板としての見た目を保つ。

更新内容は最大2件を1行ずつ表示する。`showMore` が `true` の場合だけ、3行目に一回り小さい文字で「など……」を表示する。看板デザインとして明示的に強い見出しが必要な箇所だけ太字を使用する。

ダイアログの最大幅内に収まるレスポンシブな文字サイズと余白を使う。小さい画面ではダイアログ内の内容領域を縦スクロール可能にし、看板、ストアボタン、スワイプ案内が欠けないようにする。

### 5.3 設定画面

設定画面の「アプリ情報」セクションで、「このアプリについて」の直後に既存 `ActionPill` を使った「最新の更新内容を見る」を追加する。有効な現在版通知がある場合だけ表示し、押すと表示元 `settings` で更新通知ダイアログを開く。

## 6. ストアページ

ストアURLを `src/config/storeUrls.ts` に集約する。

- iOS: 既存のApp Store URL `https://apps.apple.com/jp/app/id6777709044`
- Android: `https://play.google.com/store/apps/details?id=com.kazuki19992.strollia`

実績共有で使っているApp Store URLも同じ定義を参照し、URLの重複を避ける。「ストアページへ」を押すと現在OSのURLを `Linking.openURL` で開く。失敗時は警告ログを残し、ダイアログは表示したままにする。

## 7. 状態管理

`AppStateProvider` に次を追加する。

- 有効な現在版更新通知
- 更新通知の表示状態
- 表示元 `automatic | settings`
- 設定画面から開く操作
- 閉じる操作
- ストアページを開く操作

起動判定に必要な値は `useAppInitialization` からsetter経由で反映する。純粋な定義検証と現在版解決は `src/features/app-update/updateNotices.ts` に置き、UIや初期化フックから分離する。

## 8. テスト

TDDで次を検証する。

### 定義・判定

- ネイティブ版と定義版が一致する場合だけ通知を解決する
- 定義が `null`、版不一致、項目0件／3件以上、11文字以上を安全に非表示へ落とす
- 1件／2件の有効な通知を受け付ける

### 起動初期化

- 新規インストール相当ではチュートリアルだけを表示する
- チュートリアル完了済みで未読の現在版だけを自動表示する
- 同じ版を既読済みなら表示しない
- 有効な現在版通知がなければ表示しない
- 初回チュートリアル完了時に、完了フラグと通知版を原子的に保存する

### コンポーネント

- 看板本体は角丸なし、バージョン帯だけ丸棒である
- 更新内容を最大2件表示する
- `showMore: true` の場合だけ小さい「など……」を表示する
- 既存 `Dialog` のスワイプクローズが有効である
- 自動表示では「ストアページへ」を表示しない
- 設定画面からの表示だけ「ストアページへ」を表示し、操作をコールバックへ渡す

### 設定画面・統合

- 有効な現在版通知がある場合だけ「最新の更新内容を見る」を表示する
- 設定ボタンから表示元 `settings` でダイアログを開く
- 自動表示を閉じると通知版を保存する
- 設定からの再表示を閉じても既読値を変更しない

## 9. 主な変更ファイル

- `src/features/app-update/updateNotices.ts`
- `src/config/storeUrls.ts`
- `src/ui/components/AppUpdateNoticeSign.tsx`
- `src/ui/components/AppUpdateNoticeDialog.tsx`
- `src/ui/hooks/useAppInitialization.ts`
- `src/ui/state/AppStateProvider.tsx`
- `src/app/_layout.tsx`
- `src/app/settings/index.tsx`
- `src/ui/components/SettingsScreen.tsx`
- `src/ui/styles/achievementStyles.ts`
- 関連する `__tests__` 配下のテスト

DBスキーマ変更や新しい外部依存は追加しない。

## 10. リリース運用

1. `release-notes` スキルが `main..develop` の差分からストア向けリリースノートとアプリ内更新通知候補を作る
2. アプリ内候補は最大2件、各10文字以内とし、候補が3件以上なら `showMore: true` にする
3. ユーザーが対象版、種別、見出し、短文を承認する
4. 承認後に `LATEST_UPDATE_NOTICE` の最新1件を更新する
5. `package.json`、`app.json`、`package-lock.json` のリリース版と通知版が一致することを確認する

定義のない版では通知を表示しないため、リリース内容の反映漏れがあっても誤った告知は出さない。
