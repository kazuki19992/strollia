# GPX Import Progress and Performance Plan

## Goal

大容量GPXのインポートを高速化し、開始直後からアプリ内操作を安全にロックしながら、#147のODO表示を進捗ダイアログへ追加する。

## Tasks

- [x] 1. `GpxImportProgressDialog` の失敗テストを追加する。
  - ODOラベル、DSEG数値部、`km`、中央揃え、段階別メッセージを検証する。
- [x] 2. ダイアログへ `stage` と `odometerDistanceMeters` を追加する。
  - 既存マップと同じ距離整形と `NUMERIC_DISPLAY_FONT` を使う。
  - 進捗バーの直下にODO行を配置する。
- [x] 3. Providerの失敗統合テストを追加する。
  - 注意ダイアログ確認直後にUIロックされ、OSピッカー呼び出し前に1フレーム譲ることを検証する。
  - キャンセル、成功、失敗でロック解除されることを検証する。
- [x] 4. ProviderにUIロックと進捗段階を実装する。
  - `importGpx` が注意確認後にロックし、ファイル選択後に段階を更新する。
  - グローバルオーバーレイはアプリを操作不能にするが、OSファイルピッカーを妨げない。
- [x] 5. Repositoryの失敗テストを追加する。
  - チャンク間の固定待機がないことと、複数ポイントの同一visited cellが集約されることを検証する。
- [x] 6. チャンク内visited-cell更新を集約する。
  - 集約upsert APIを追加し、既存の100m visited grid意味を保つ。
  - 50msチャンク待機を削除する。
- [x] 7. 必要なJSDocとドキュメントを更新する。
- [x] 8. 型チェック、対象テスト、lint、全テストを実行する。
- [ ] 9. Galaxy A25 5Gで大容量GPXを手動検証する。

## Commit Plan

1. `feat(import): GPXインポート中の操作ロックとODO表示を追加`
2. `perf(import): GPX保存時のvisited cell更新を集約`
