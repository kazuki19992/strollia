# 写真マップ Phase 2-b: photo_assets テーブル + ビューポート絞り込み

作成日: 2026-08-21

親設計書: `docs/superpowers/specs/2026-08-10-photo-map-scan-limit-removal-design.md`（§4.2 / §4.4 / §5 / §6）

## 位置づけ

Phase 2 の段階リリース 2-a / 2-b / 2-c のうち **2-b**。

- **2-a（完了・PR #146）**: クラスタリングの O(N) 化 + 半径の量子化
- **2-b（本計画）**: `photo_assets` テーブル + リポジトリ + ビューポート絞り込み
- **2-c（未着手）**: ページング走査 + 差分スキャン + 上限撤廃

## 目的

描画対象を画面周辺の写真だけに絞る。あわせて 2-c で使う `photo_assets` の
スキーマ・リポジトリ・読み書き経路を先に通し、2-c を「書き込み側の差し替え」に縮める。

## 非目的

- ライブラリ全体の走査（2-c）
- 200件上限の撤廃（2-c）
- 写真編集（撮影日時・位置の変更）の追従（Phase 2 全体のスコープ外）
- 削除された写真の検知（同上）

## 設計判断: 2-b で書き込み側をどうするか

親設計書は 2-b の範囲を「テーブル + リポジトリ + ビューポート絞り込み」としているが、
**走査（2-c）が無い状態ではテーブルを埋めるものが無い**ため、そのままでは
ビューポート検索が常に空を返す。

したがって 2-b では、**既存の `loadGeotaggedPhotos`（最新200件）の結果を
`photo_assets` へ保存する**ことにする。

- 2-b の時点で読み書きの全経路が実際に動き、スキーマとリポジトリを実データで検証できる
- 2-c は「書き込み側を 200件ロードからページング走査へ差し替える」だけになる
- ユーザーから見た表示内容は 2-b の前後で変わらない（対象は同じ最新200件のまま）

## リスク（ユーザー承認済みで進行）

親設計書 §9-2「`uri` 単独でのサムネイル表示」は**未検証**である。

`photo_assets` には再起動をまたいで安定している `uri`（iOS: `ph://…`）だけを保存し、
`localUri` は保存しない（一時パスのため）。現行の `toMapPhoto` は `localUri ?? uri` の順で
採用しているため、**`uri` 単独で `<Image>` が描画できるかは実機でしか確認できない**。

- 実機確認で問題が無ければそのまま
- 描画できなかった場合の切り替え先: `local_uri` を「保存しないが表示直前に都度取得する値」として扱い、
  ビューポート検索の結果に対してのみ `getAssetInfoAsync` で `localUri` を解決する

この分岐は `MapPhoto` を組み立てる箇所に閉じるよう実装すること。**手戻り範囲を1箇所に閉じ込めるのが
このリスクに対する唯一の対策**なので、`uri` の採用箇所を散らさないこと。

## 実装

### Task 1: `photo_assets` テーブルとインデックス

`src/db/database.ts` の `initializeDatabase` へ追加する。

```sql
CREATE TABLE IF NOT EXISTS photo_assets (
  asset_id TEXT PRIMARY KEY,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  taken_at TEXT NULL,
  uri TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  last_seen_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_photo_assets_latitude_longitude
  ON photo_assets(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_photo_assets_taken_at
  ON photo_assets(taken_at);
```

- `taken_at` とそのインデックスは **2-c 以降で使う準備工事**。2-b では絞り込みに使わないが、
  後からスキーマ変更と全件再走査が要らないよう最初から用意する（親設計書 §9 の確定事項）
- `src/features/logs/logRepository.ts` の `deleteAllUserData` に `photo_assets` の削除を追加する

既存のマイグレーション追加手順は `.claude/skills/db-schema-change/SKILL.md` に従うこと。

### Task 2: ビューポート範囲計算（純粋関数）

余白込みの緯度経度境界を求める純粋関数を用意する。日付変更線をまたぐ場合の扱いを含む。

- 余白は表示範囲の外側へ持たせ、小さなパンで再取得が走らないようにする
  （`GRID_OVERLAY_CONFIG.boundsPaddingRatio` と同じ考え方）
- **経度180度線をまたぐ場合、`BETWEEN` は min > max となり空集合を返す**。
  既存の `getGridBoundsForRegion`（`src/features/location/grid/gridCell.ts`）が
  `crossesAntimeridian` を扱っているので、**同じ判定方法を踏襲する**（独自実装しない）
- 緯度は極付近でクランプする

既存の実装を必ず読んでから、同じ考え方・同じ命名感で書くこと。

### Task 3: `photoAssetRepository.ts`

`src/features/photos/photoAssetRepository.ts` を新設する。

必要な操作:

- **UPSERT 保存**: 同じ `asset_id` を再保存しても行が増えない。`created_at` は初回のみ、
  `updated_at` / `last_seen_at` は毎回更新する。複数件の保存は `withExclusiveTransaction` でまとめる
- **ビューポート検索**: 緯度経度の範囲で絞り込む。日付変更線をまたぐ場合は OR 条件へ分岐する
- ジオタグの無い写真は呼び出し側で除外済みである前提とし、リポジトリは受け取った行を保存する

テストは `db` をモジュールモックする（`.ai/context/testing.md` のパターン）。

### Task 4: 書き込み経路

`loadGeotaggedPhotos` が得た写真を `photo_assets` へ保存する。

- 保存する `uri` は **`getAssetsAsync` が返す安定した `uri`**。
  `getAssetInfoAsync` の `localUri` を保存してはいけない（一時パスのため）
- 現行の `toMapPhoto` は `localUri ?? uri` を `MapPhoto.uri` にしている。
  DB へ保存する値と `MapPhoto` に載せる値が別物になる点に注意すること
- 保存の失敗が写真表示そのものを壊さないようにする（表示は継続し、失敗はログに残す）

### Task 5: 読み込み経路をビューポート検索へ切り替え

`usePhotoMapOverlay` が、表示範囲に応じて `photo_assets` から写真を読むようにする。

- 表示範囲が変わるたびに SQL を撃たない。余白の外へ出たときだけ再取得する
  （`isGridBoundsContained` と同じ考え方が使えるか検討する）
- 写真表示が OFF のときは検索しない
- 既存の「読み込み中」表示・エラー表示の挙動は維持する

`usePhotoMapCrashBreaker` のクラッシュブレーカー動作は**変更しないこと**。

### Task 6: ドキュメント改訂

- `docs/data-storage.md` §4.7 の `photo_assets` 案を**改訂**する。
  既存案は `id INTEGER` 主キー + `local_uri` + `thumbnail_uri` で本設計と異なるため、
  追記ではなく置き換えになる（親設計書 §9-4 の承認事項）
- `docs/photo-geotag.md` §8 の「初期実装では写真メタデータをDBに保存しない」を
  「ジオタグ付き写真のメタデータのみ端末内DBへ保存する（写真本体は複製せず、外部送信もしない）」へ改める
  （親設計書 §9-1 の承認事項）
- `local_uri` を保存しない理由と、§9-2 が未検証である旨を残す

## プライバシー / ローカルファースト

- 保存するのは**ジオタグ付き写真のメタデータのみ**。写真本体は複製しない
- 外部送信は一切しない（AGENTS.md §5）
- 全データ削除（`deleteAllUserData`）で `photo_assets` も確実に消えること

## 完了条件

- `npm run typecheck` エラー 0
- `npm test` 全通過
- `npm run lint` error 0
- `npm run format:check` clean
- 既存の写真関連テストが挙動不変であること
- 全データ削除で `photo_assets` が消えることがテストで担保されていること
