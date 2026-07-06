# アーキテクチャ

Strollia (footspot) は Expo (React Native) 製のローカルファーストGPSロガー。
サーバーはなく、全データは端末内 SQLite に保存する。詳細な設計判断は `docs/architecture.md` を参照。

## 技術スタック

| 領域           | ライブラリ                                                         |
| -------------- | ------------------------------------------------------------------ |
| 基盤           | Expo ~54 / React 19 / React Native 0.81 / TypeScript ~5.9 (strict) |
| ナビゲーション | @react-navigation/native + native-stack                            |
| 位置情報       | expo-location + expo-task-manager                                  |
| DB             | expo-sqlite(`strollia.db`)                                         |
| 地図           | react-native-maps                                                  |
| 課金           | react-native-purchases (RevenueCat)                                |
| エラー追跡     | @sentry/react-native                                               |
| GPX解析        | fast-xml-parser                                                    |
| テスト         | jest + jest-expo + react-test-renderer                             |

## レイヤー構成

```text
UIコンポーネント (src/app/components/)
  ↓ props でデータと操作を受け取る(DB・端末APIを直接呼ばない)
App.tsx (src/app/App.tsx) — フックの結線とレンダリングのハブ
  ↓ カスタムフックへ処理を委譲
src/app/hooks/ — 責務別フック群(GPS記録・実績・初期化・地図等)
  ↓
サービス / リポジトリ (src/features/*/)
  ↓
SQLite (src/db/database.ts)
```

- 副作用(DB・端末API)はサービス層・リポジトリ層に寄せる
- 純粋関数にできる処理(データ変換、フォーマット、判定ロジック)は切り出してテストする

## ディレクトリマップ

| パス                               | 役割                                                                                                                                                                                                                                                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/App.tsx`                  | メインアプリ。フックの結線・props の橋渡し・レンダリングを担う                                                                                                                                                                                                                                                      |
| `src/app/appStyles.ts`             | 全画面共通の StyleSheet(`createStyles(theme)`)                                                                                                                                                                                                                                                                      |
| `src/app/appText.ts`               | ユーザー向け文言定数                                                                                                                                                                                                                                                                                                |
| `src/app/components/`              | 画面・共通UIコンポーネント(1ファイル1コンポーネント)                                                                                                                                                                                                                                                                |
| `src/app/components/reports/`      | 月次レポート専用コンポーネントと `reportStyles.ts`                                                                                                                                                                                                                                                                  |
| `src/app/hooks/`                   | カスタムフック群。主要フック: `useAppInitialization`(起動初期化), `useLocationRecordingSync`(GPS記録同期), `useAchievementState`(実績), `usePremiumAccess`(課金), `useMapFollowState`(地図追従), `useVisitedGridOverlay`(訪問グリッド), `useUserLocationIconSetting`(アイコン), `usePhotoMapCrashBreaker`(写真表示) |
| `src/app/generated/`               | 生成物(OSSライセンス。`npm run generate:licenses`)                                                                                                                                                                                                                                                                  |
| `src/features/location/`           | GPS記録・権限・訪問セル                                                                                                                                                                                                                                                                                             |
| `src/features/logs/`               | 日別ログのDB操作                                                                                                                                                                                                                                                                                                    |
| `src/features/achievements/`       | 実績の解除条件・通知                                                                                                                                                                                                                                                                                                |
| `src/features/premium/`            | RevenueCat統合・Plus判定(`revenueCatAccess.ts`)                                                                                                                                                                                                                                                                     |
| `src/features/customization/`      | カラープリセット・現在地アイコン                                                                                                                                                                                                                                                                                    |
| `src/features/settings/`           | アプリ設定の読み書き(`settingsRepository.ts`)                                                                                                                                                                                                                                                                       |
| `src/features/export/` / `import/` | GPXエクスポート / インポート                                                                                                                                                                                                                                                                                        |
| `src/features/photos/`             | 写真ジオタグ表示                                                                                                                                                                                                                                                                                                    |
| `src/features/map/`                | マップ描画設定                                                                                                                                                                                                                                                                                                      |
| `src/features/reports/`            | 月次レポート集計                                                                                                                                                                                                                                                                                                    |
| `src/db/database.ts`               | SQLite初期化・マイグレーション集約(`initializeDatabase`)                                                                                                                                                                                                                                                            |
| `src/theme/theme.ts`               | `AppTheme`(ライト/ダーク)・カラープリセット適用                                                                                                                                                                                                                                                                     |
| `src/config/`                      | Sentry設定・開発フラグ(`developmentFlags.ts`)・法的リンク                                                                                                                                                                                                                                                           |
| `src/types/gps.ts`                 | GPS関連の型定義                                                                                                                                                                                                                                                                                                     |
| `src/utils/`                       | 日付・距離のユーティリティ                                                                                                                                                                                                                                                                                          |

## ナビゲーション構成

- トップレベルはメインマップ。App.tsx の状態で画面グループを切り替える
- 日別記録系・設定系はそれぞれ独立した `NavigationContainer`(`NavigationIndependentTree`)+ `createNativeStackNavigator`
- `screenOptions`: `{ animation: 'slide_from_right', gestureEnabled: true, headerShown: false }`
- Sentry 向けに `Settings:SettingsHome` のような画面名を `updateSentryScreenContext` へ通知する

## ローカルファースト原則

- GPSログ・写真メタデータをユーザーの明示操作なしに外部送信しない
- バックアップはGPXインポート・エクスポートで実現(インポートはGPXのみ、既存データ優先)
- GPS記録は権限付与後に自動開始。手動開始/停止ボタンは復旧導線のみ

## 詳細ドキュメント

`docs/` 配下: `overview.md`, `mvp.md`, `architecture.md`, `data-storage.md`(DBスキーマ),
`map-rendering.md`, `achievements.md`, `photo-geotag.md`, `import-export.md`,
`monetization.md`, `plus-features.md`, `revenuecat-integration.md`, `todo.md`。
過去の設計・計画は `docs/superpowers/specs/`・`docs/superpowers/plans/`。
