# 全GPSポイントのメモリロード廃止 - Progress Ledger

Plan: docs/superpowers/plans/2026-07-15-remove-full-points-memory-load.md

## Tasks

- [x] Task 1: routeMapper のスプレッド展開を除去する (commits e7d697d..f0b3b3e, review clean)
- [x] Task 2: logRepository に境界・月別・複数日クエリを追加する (commits f0b3b3e..d0063dd, review clean)
- [x] Task 3: dailyLogsService に総距離フォールバック計算を追加し、achievementRepository の重複ロジックを共通化する (commits d0063dd..96d8246, review clean; ブリーフのテスト期待値バグを実装者が独立検証の上で修正)
- [x] Task 4: GPXエクスポートを日別チャンク追記方式に変更する (commits 96d8246..bd3cd87, review clean)
- [x] Task 5: useAutoFitInitialRoute を境界ベースの初期表示へ切り替える (commits bd3cd87..6f31d9b, review clean)
- [x] Task 6: useLocationRecordingSync から全件points読み込みを除去する (commits 6f31d9b..c797ad9, review clean; ブリーフ範囲外だったuseLocationRecordingSync.test.tsxも整合修正。Minor未解消: refreshData成功後にpointsBounds/distanceが実際に反映されることを検証するテストが無い)
- [x] Task 7: AppStateProvider・MapScreen・画面ルートを配線し直す (commits c797ad9..f2d44e0, review clean; typecheck 0件確認済み。Minor未解消: 月次レポート非同期フローの直接テストはTask 8のAppMapReturn.test.tsxのみに依存)
- [x] Task 8: 統合テスト(AppMapReturn.test.tsx)を追従させ全体テストを緑にする (commits f2d44e0..f18f3ff, review clean; 全体テスト150/151スイート1111/1111件成功。DailyLogsScreen.test.tsxのみ既知の無関係な既存失敗。Minor未解消: AppCustomIconCentering.test.tsxにも古いgetAllLocationPointsモックが残るが現状未使用のため実害なし)
- [x] Task 9: 関連ドキュメントを更新する (commits f18f3ff..164abe1, review clean)
- [x] Task 10: 最終検証 (commit 164abe1..70ba45b→a1e0382, review: 進捗レジャーの内容変更がformatコミットへ混入していたためコミット分割で修正。typecheck/lint 0件、test 150/151スイート成功、format適用済み)
