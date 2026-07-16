# アーキテクチャ

Strollia (footspot) は Expo (React Native) 製のローカルファーストGPSロガー。
サーバーはなく、全データは端末内 SQLite に保存する。詳細な設計判断は `docs/architecture.md` を参照。

## 技術スタック

| 領域           | ライブラリ                                                                              |
| -------------- | --------------------------------------------------------------------------------------- |
| 基盤           | Expo ~57 / React 19.2 / React Native 0.86 / TypeScript ~6.0 (strict) / New Architecture |
| ナビゲーション | expo-router ~57(ファイルベースルーティング)                                             |
| 位置情報       | expo-location + expo-task-manager                                                       |
| DB             | expo-sqlite(`strollia.db`)                                                              |
| 地図           | react-native-maps                                                                       |
| 課金           | react-native-purchases (RevenueCat)                                                     |
| エラー追跡     | @sentry/react-native                                                                    |
| GPX解析        | fast-xml-parser                                                                         |
| テスト         | jest + jest-expo + @testing-library/react-native + expo-router/testing-library          |

## エントリポイント

`index.ts` がアプリのエントリポイント。以下の3つを担う。

1. Sentry 初期化(`initializeSentry`)
2. バックグラウンドGPS記録タスクの登録(`backgroundLocationTask` import)
3. expo-router へのエントリ委譲(`import 'expo-router/entry'`)

expo-router はこの import によって `src/app/_layout.tsx` をルートレイアウトとして起動する。

## レイヤー構成

```text
expo-router ルート (src/app/)
  _layout.tsx — AppStateProvider でラップし Stack ナビゲーターを配置
  index.tsx / achievements.tsx / monthly-report.tsx — トップレベル画面
  daily-logs/_layout.tsx + index.tsx + [date].tsx — 日別記録スタック
  settings/_layout.tsx + index.tsx + about.tsx + faq.tsx + licenses/ — 設定スタック
  ↓ useAppState() で状態・操作を取得
AppStateProvider (src/ui/state/AppStateProvider.tsx)
  — 全フックの結線と状態管理のハブ。navigator prop で expo-router の遷移と接続
  ↓ カスタムフックへ処理を委譲
src/ui/hooks/ — 責務別フック群(GPS記録・実績・初期化・地図等)
  ↓
サービス / リポジトリ (src/features/*/)
  ↓
SQLite (src/db/database.ts)
```

- 副作用(DB・端末API)はサービス層・リポジトリ層に寄せる
- 純粋関数にできる処理(データ変換、フォーマット、判定ロジック)は切り出してテストする

## ディレクトリマップ

| パス                                | 役割                                                                                                                                                                                                                                                                                                                |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/_layout.tsx`               | ルートレイアウト。AppStateProvider でラップし、Stack ナビゲーター・グローバルモーダル群を配置する。Sentry 画面名の更新も担う                                                                                                                                                                                        |
| `src/app/index.tsx`                 | 地図画面ルート(`/`)。AppStateProvider から状態を取得し MapScreen を描画する                                                                                                                                                                                                                                         |
| `src/app/achievements.tsx`          | 実績一覧ルート(`/achievements`)                                                                                                                                                                                                                                                                                     |
| `src/app/monthly-report.tsx`        | 月次レポートルート(`/monthly-report`)                                                                                                                                                                                                                                                                               |
| `src/app/daily-logs/`               | 日別記録スタック。`_layout.tsx` + `index.tsx`(一覧) + `[date].tsx`(詳細)                                                                                                                                                                                                                                            |
| `src/app/settings/`                 | 設定スタック。`_layout.tsx` + `index.tsx` + `about.tsx` + `faq.tsx` + `licenses/index.tsx` + `licenses/[name].tsx`                                                                                                                                                                                                  |
| `src/ui/state/AppStateProvider.tsx` | アプリ全体の状態・フック・コールバックを提供する Context Provider。旧 App.tsx のフック結線部を一括して受け持つ。`navigator` prop で expo-router の `router.push` と接続する                                                                                                                                         |
| `src/ui/appStyles.ts`               | 全画面共通の StyleSheet(`createStyles(theme)`)。`src/ui/styles/` 配下の責務別ファイルを束ねる                                                                                                                                                                                                                       |
| `src/ui/styles/`                    | appStyles を責務別に分割したファイル群(`commonStyles.ts` / `mapStyles.ts` / `settingsStyles.ts` / `achievementStyles.ts` / `dailyLogStyles.ts`)                                                                                                                                                                     |
| `src/ui/appText.ts`                 | ユーザー向け文言定数                                                                                                                                                                                                                                                                                                |
| `src/ui/appTypes.ts`                | `ScreenMode` など UI 層の型定義                                                                                                                                                                                                                                                                                     |
| `src/ui/pathnameToScreenMode.ts`    | expo-router のパス名を `ScreenMode` に変換する純粋関数。Sentry 画面名解決とフック互換のための橋渡し                                                                                                                                                                                                                 |
| `src/ui/sentryScreen.ts`            | Sentry 画面名を前面表示の優先度から解決する純粋関数(`resolveSentryScreenName`)                                                                                                                                                                                                                                      |
| `src/ui/components/`                | 画面・共通UIコンポーネント(1ファイル1コンポーネント)。マップダッシュボード関連: `MapBottomDashboard.tsx`(合成), `DashboardAction.tsx`, `DashboardDistanceMetric.tsx`, `MapDisplayTypeButton.tsx`, `SpeedDial.tsx`, `dashboardScaling.ts`(計算・定数)                                                                |
| `src/ui/components/reports/`        | 月次レポート専用コンポーネントと `reportStyles.ts`                                                                                                                                                                                                                                                                  |
| `src/ui/hooks/`                     | カスタムフック群。主要フック: `useAppInitialization`(起動初期化), `useLocationRecordingSync`(GPS記録同期), `useAchievementState`(実績), `usePremiumAccess`(課金), `useMapFollowState`(地図追従), `useVisitedGridOverlay`(訪問グリッド), `useUserLocationIconSetting`(アイコン), `usePhotoMapCrashBreaker`(写真表示) |
| `src/ui/generated/`                 | 生成物(OSSライセンス。`npm run generate:licenses`)                                                                                                                                                                                                                                                                  |
| `src/features/location/`            | GPS記録・権限・訪問セル                                                                                                                                                                                                                                                                                             |
| `src/features/logs/`                | 日別ログのDB操作(`logRepository.ts`)とサービス層(`dailyLogsService.ts` / `dailyLogDetailService.ts`)                                                                                                                                                                                                                |
| `src/features/achievements/`        | 実績の解除条件・通知                                                                                                                                                                                                                                                                                                |
| `src/features/premium/`             | RevenueCat統合・Plus判定(`revenueCatAccess.ts`)                                                                                                                                                                                                                                                                     |
| `src/features/customization/`       | カラープリセット・現在地アイコン                                                                                                                                                                                                                                                                                    |
| `src/features/settings/`            | アプリ設定の読み書き(`settingsRepository.ts`)                                                                                                                                                                                                                                                                       |
| `src/features/export/` / `import/`  | GPXエクスポート / インポート                                                                                                                                                                                                                                                                                        |
| `src/features/photos/`              | 写真ジオタグ表示                                                                                                                                                                                                                                                                                                    |
| `src/features/map/`                 | マップ描画設定                                                                                                                                                                                                                                                                                                      |
| `src/features/reports/`             | 月次レポート集計                                                                                                                                                                                                                                                                                                    |
| `src/db/database.ts`                | SQLite初期化・マイグレーション集約(`initializeDatabase`)                                                                                                                                                                                                                                                            |
| `src/theme/theme.ts`                | `AppTheme`(ライト/ダーク)・カラープリセット適用                                                                                                                                                                                                                                                                     |
| `src/config/`                       | Sentry設定・開発フラグ(`developmentFlags.ts`)・法的リンク                                                                                                                                                                                                                                                           |
| `src/types/gps.ts`                  | GPS関連の型定義                                                                                                                                                                                                                                                                                                     |
| `src/utils/`                        | 日付・距離のユーティリティ                                                                                                                                                                                                                                                                                          |

## ナビゲーション構成

- expo-router のファイルベースルーティングを採用している。`src/app/` 配下のファイル構造がそのままURLパスになる
- ルートレイアウト(`src/app/_layout.tsx`)の `<Stack>` は `animation: 'none'`。地図画面(トップレベル)へ戻るときはフェード + 微量下スライドで視覚的に区別する
- 日別記録スタック(`src/app/daily-logs/_layout.tsx`)・設定スタック(`src/app/settings/_layout.tsx`)はそれぞれ `animation: 'slide_from_right', gestureEnabled: true` で子画面を管理する。iOS スワイプバックが有効になる
- Sentry 画面名は `_layout.tsx` が `usePathname()` を監視し、`pathnameToScreenMode` / `pathnameToDailyLogsSentryScreenName` / `pathnameToSettingsSentryScreenName` / `resolveSentryScreenName` の純粋関数群で `Settings:SettingsHome` 等の文字列を導出して `updateSentryScreenContext` へ通知する
- 地図フォーカス制御: 地図へ戻る操作(`openMap`)では `mapFollowState.prepareMapRegionRestore()` を呼び、復帰後に `animateToRegion` で現在地を復元する
- メインマップ初期表示範囲: `AppStateProvider` が `useLocationRecordingSync`を通じて `pointsBounds`(SQLの`MIN/MAX/COUNT`集計)を取得し、`createRegionFromBounds`(`src/features/map/routeMapper.ts`)でメモリへのポイント本体ロードなしに初期表示範囲を算出する

## ローカルファースト原則

- GPSログ・写真メタデータをユーザーの明示操作なしに外部送信しない
- バックアップはGPXインポート・エクスポートで実現(インポートはGPXのみ、既存データ優先)
- GPS記録は権限付与後に自動開始。手動開始/停止ボタンは復旧導線のみ

## 詳細ドキュメント

`docs/` 配下: `overview.md`, `mvp.md`, `architecture.md`, `data-storage.md`(DBスキーマ),
`map-rendering.md`, `achievements.md`, `photo-geotag.md`, `import-export.md`,
`monetization.md`, `plus-features.md`, `revenuecat-integration.md`, `todo.md`。
過去の設計・計画は `docs/superpowers/specs/`・`docs/superpowers/plans/`。
