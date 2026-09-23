# スポット訪問実績 設計書

作成日: 2026-09-23

## 1. 目的

日本三名瀑やJRA競馬場のように、**簡単には変わらない場所**を訪れた実績を作る。
複数のスポットをまとめた「パック」を単位とし、パック内の全スポットへ到達すると完走実績が解除される。

Strollia Plus 限定機能とする。

パック候補の一覧と選定基準は `docs/landmark-spot-packs.md` を参照する。

## 2. 用語

| 用語     | 意味                                                             |
| -------- | ---------------------------------------------------------------- |
| スポット | 到達判定の対象となる1地点。座標・到達半径・必要滞在時間を持つ    |
| パック   | スポットの集合。「日本三名瀑」「JRA競馬場」など                  |
| 到達     | スポットの到達半径内に必要滞在時間だけ留まり、訪問が確定した状態 |
| 完走     | パック内の全スポットへ到達した状態。既存の実績として解除される   |

## 3. スコープ

### 3.1 対象

- スポット到達の検知と記録
- パック完走の実績解除
- 実績画面のスポットセクションとパック詳細画面
- 初回11パック・スポット実体61件のマスタデータ

### 3.2 非対象

| 項目                         | 理由                                                                      |
| ---------------------------- | ------------------------------------------------------------------------- |
| 過去GPSログの遡及判定        | 機能導入以降の記録のみを対象とする                                        |
| 無料ユーザーへの到達検知     | Plus限定機能のため、検知自体を行わない                                    |
| パック単位の買い切りIAP      | 初回は実装しない。データモデルだけ用意し、後から加算的に足す              |
| 個別スポットのトロフィー画像 | トロフィーはパック完走にのみ用意する。余力が出た段階で再検討              |
| 高速道路の走破率実績         | 判定方式が根本的に異なる。`docs/landmark-spot-packs.md` 第7節に構想を記録 |

## 4. 課金方針

### 4.1 Plus限定

スポット実績は Strollia Plus 限定機能とする。無料ユーザーは**到達検知も行わない**。

Plusが無効な間は `resolveLandmarkArrival` を呼ばず、滞在状態もリセットする。
Plusが切れている間にスポットの半径内にいても何も記録されない。これは仕様である。

滞在場所の「取得失敗時はカウンタを保持する」挙動とは逆の扱いにする。
取得失敗は一時的な障害だが、Plus無効は明示的な権利消失であり、意味が異なるため。

### 4.2 解約時のデータ保持

`landmark_spot_visits` と `achievement_unlocks` の行は、Plus解約時に**削除も更新もしない**。
再加入した時点で既存行がそのまま一覧へ復帰し、続きから再開できる。

解除済みの完走実績も残るため、再加入時に同じ実績の解除通知が再送されることはない。

これは滞在場所の既存方針（`docs/stay-places.md`: 解約しても登録済みの行は削除・更新せず、再契約時に全件を自動的に有効へ戻す）と同一である。

### 4.3 将来のパック単位IAP

パックはデータモデル上の第一級の概念とするが、初回リリースでIAP商品は作らない。

将来足す場合は、entitlement判定を以下の形にする。

```ts
/** パックが解放済みか判定する。Plusは全パックを含む。 */
function isPackUnlocked(packId: string, access: PremiumAccessState): boolean {
  return access.isPlusActive || access.unlockedPackEntitlementIds.has(toPackEntitlement(packId));
}
```

初回は右辺が常に空集合になる。`isPlusActive` を別軸のORにしておくことで、
「パック追加のたびにPlus商品へ紐づけるのを忘れ、既存Plusユーザーが新パックを見失う」という事故を構造的に防ぐ。

## 5. データモデル

### 5.1 スポットとパックは多対多

同一スポットが複数パックに所属する。初回ラインナップでは以下が該当する。

| スポット   | 所属パック                    |
| ---------- | ----------------------------- |
| 備中松山城 | 現存天守十二城 ∩ 日本三大山城 |
| 松江城     | 現存天守十二城 ∩ 日本三大湖城 |

**パックごとにスポットを重複定義してはならない。** 重複定義すると同じ場所へ2回行かなければ両方が埋まらず、不自然な体験になる。

スポットは座標の実体として1件だけ定義し、パックはスポットの参照集合を持つ。
訪問記録は `spot_id` 単位で1行入るため、備中松山城へ1回到達すれば両パックのカウントが同時に進む。

この構造により、将来の日本百観音（西国33＋坂東33＋秩父34＝100）のような入れ子パックも、
特別な仕組みなしに表現できる（百観音パックが100件を参照し、その部分集合を3つの小パックが参照する）。

### 5.2 ファイル構成

マスタデータはアプリコードから分離し、JSON Schema で型を定義する。

```
data/landmarks/                          アプリコードの外側
  landmarkSpots.schema.json              スポットのスキーマ（型の正）
  landmarkPacks.schema.json              パックのスキーマ
  landmarkSpots.json                     スポット実体61件
  landmarkPacks.json                     パック定義11件

scripts/
  generate-landmark-catalog.mjs          スキーマ検証 → 参照整合性チェック → TS生成

src/features/landmarks/
  landmarkCatalog.generated.ts           生成物。手動編集しない
```

`package.json` に `"generate:landmarks": "node scripts/generate-landmark-catalog.mjs"` を追加する。
既存の `generate:licenses` / `generate-stay-place-emoji-catalog.mjs` と同じ運用とする。

### 5.3 実行時の性質

生成した `landmarkCatalog.generated.ts` をアプリから import する。

- Metro がビルド時にバンドルへ展開するため、**実行時のファイルI/OもSQLiteアクセスも発生しない**
- 起動時からメモリ常駐する。61件でおよそ12KB、将来400件でも80KB程度
- バックグラウンド位置配信のヘッドレスJSコンテキストでもバンドル全体が評価されるため、UIが起動していなくても参照できる（`src/features/location/backgroundLocationTask.ts` のコメント参照）

マスタをDBへ同期しない。同期層を持つと真実の源が2つになり、
「JSONを直したのにDBが古い」という不整合と、観測ごとのSQLite読み込みを抱え込むため。

### 5.4 ID方針

| フィールド | 用途                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------- |
| `id`       | UUIDv7。DBの `spot_id` に保存する安定識別子                                              |
| `slug`     | 大文字スネークケースの可読キー（`CAPE_SOYA` など）。JSON内の相互参照と差分の可読性に使う |

`landmarkPacks.json` は `spotSlugs` でスポットを参照し、**生成時にUUIDへ解決する**。
UUIDv7を直接書くと手編集が困難になるため、可読キーで参照を書けるようにする。

enum値は大文字スネークケースで統一する（都道府県は `HOKKAIDO`、`KYOTO` など単語1つ）。

### 5.5 スキーマ

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "array",
  "items": {
    "type": "object",
    "required": ["id", "slug", "name", "prefecture", "latitude", "longitude", "radiusMeters", "dwellSeconds"],
    "additionalProperties": false,
    "properties": {
      "id": { "type": "string", "format": "uuid" },
      "slug": { "type": "string", "pattern": "^[A-Z0-9_]+$" },
      "name": { "type": "string", "minLength": 1 },
      "prefecture": { "type": "string", "enum": ["HOKKAIDO", "AOMORI", "..."] },
      "latitude": { "type": "number", "minimum": 20, "maximum": 46 },
      "longitude": { "type": "number", "minimum": 122, "maximum": 154 },
      "radiusMeters": { "type": "number", "exclusiveMinimum": 0, "maximum": 2000 },
      "dwellSeconds": { "type": "integer", "minimum": 0, "maximum": 3600 },
      "retired": { "type": "boolean" },
      "note": { "type": "string" }
    }
  }
}
```

緯度経度の範囲を日本国内に制限することで、**緯度と経度の取り違え**という最も起きやすい入力ミスをエディタ上で検出できる。
`additionalProperties: false` はキーのスペルミスを弾く。

パックのスキーマは以下を持つ。

```json
{
  "slug": "JAPAN_MAINLAND_FOUR_EXTREMES",
  "name": "日本本土四極",
  "description": "民間人がたどり着ける日本の東西南北の極",
  "spotSlugs": ["CAPE_SOYA", "CAPE_NOSAPPU", "CAPE_SATA", "KANZAKIBANA"],
  "trophyImage": "japan-mainland-four-extremes.png",
  "sortOrder": 100
}
```

`description` は一覧行のサブタイトルに表示する。パックの魅力を決める一文であり、データ作成時に丁寧に書く。

### 5.6 生成時の検証

`generate-landmark-catalog.mjs` は以下を検証し、違反があれば生成せずに失敗する。

- JSON Schema への適合
- `id` と `slug` の重複がないこと
- **`spotSlugs` が実在するスポットを指していること**

最後の項目は多対多構造では必須である。`spotSlugs` に1文字のtypoがあると、
実行時には何のエラーも出ないまま**そのパックが永久に完走不能**になる。

生成物の型は `slug` からリテラルユニオン型を作る（`'CAPE_SOYA' | 'CAPE_NOSAPPU' | ...`）。
JSONを直接importする場合は全て `string` になるため、生成を挟む利点がここにある。

## 6. DBスキーマ

### 6.1 `landmark_spot_visits`

```sql
CREATE TABLE IF NOT EXISTS landmark_spot_visits (
  spot_id TEXT PRIMARY KEY,
  visited_at TEXT NOT NULL,
  visited_local_date TEXT NOT NULL,
  location_point_id INTEGER,
  created_at TEXT NOT NULL
);
```

| カラム               | 内容                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| `spot_id`            | マスタの UUIDv7。自動採番のFKにしない                                |
| `visited_at`         | 到達確定時刻（ISO8601）                                              |
| `visited_local_date` | 日別記録詳細への遷移に使うローカル日付                               |
| `location_point_id`  | 到達を確定した根拠GPSポイント。保存されない観測で確定した場合は NULL |

`spot_id` を安定文字列にすることで、マスタの座標・半径を後から調整しても訪問記録が壊れない。
マスタから消えたスポットの行は孤児として無害に残り、再追加すれば復活する
（`getPendingInAppAchievementNotifications` が未知IDを `flatMap` でスキップしているのと同じ扱い）。

### 6.2 滞在の途中状態

「どのスポットの半径内にいつ入ったか」は既存の `location_recording_state` へ列を追加して保持する。

| カラム                          | 内容                                 |
| ------------------------------- | ------------------------------------ |
| `landmark_candidate_spot_id`    | 半径内にいる候補スポットのID         |
| `landmark_candidate_entered_at` | その候補の半径内で最初に観測した時刻 |
| `landmark_outside_count`        | 候補の半径外を連続観測した回数       |

滞在場所の吸着状態と同じテーブルに置くことで、
前景・背景の切替やJSプロセス再生成をまたいでも滞在判定が継続する。

スキーマ変更は `db-schema-change` スキルの手順に従う。

## 7. 到達判定

### 7.1 検知はGPS観測単位で行う

到達判定は `recordLocationObservation`（`src/features/location/locationObservationRecorder.ts`）の中で行う。

**保存されたGPSポイントではなく、保存されない観測も通る層で判定しなければならない。**

`shouldSaveLocationPoint`（`src/features/location/locationSaveFilter.ts`）は、
直前の保存点から20m未満の点と、端末speedが0.5m/s未満かつ20m未満のドリフトを保存しない。
つまり**滝の前で5分立ち止まっている間、保存点はほとんど増えない**。

滞在判定を保存点だけに乗せると、最も達成させたい「立ち止まって眺める」ケースで滞在時間が進まず、
到達が永久に確定しない。

### 7.2 判定アルゴリズム

`resolveLandmarkArrival` を純粋関数として実装する。入出力は以下。

```ts
/** 1観測ぶんのスポット到達判定に渡す状態。 */
export type LandmarkArrivalState = {
  candidateSpotId: string | null;
  candidateEnteredAt: string | null;
  outsideCount: number;
};

export type LandmarkArrivalResult = {
  state: LandmarkArrivalState;
  /** この観測で到達が確定したスポットID。未確定ならnull。 */
  arrivedSpotId: string | null;
};
```

手順。

1. 未到達のスポットのうち、観測地点から `radiusMeters` 以内にあるものを探す。**境界値は範囲内**として扱う（滞在場所の吸着半径と同じ）
2. 複数が該当する場合は最寄りの1件を候補とする。同距離なら `slug` 昇順で安定させる
3. 候補が前回と同じなら `candidateEnteredAt` を維持し、異なれば今回の観測時刻で開始し直す
4. `観測時刻 − candidateEnteredAt >= dwellSeconds` になった観測で**到達を確定**する
5. 候補の半径外を観測した場合、`outsideCount` を進める。**2回連続で外なら状態をリセット**する

手順5で1点の外れ値を許容するのは、GPSノイズで1点だけ半径外へ飛んだときに滞在時間が
ゼロへ戻るのを避けるため。滞在場所の退出判定（3点連続）より緩いのは、
到達は一度確定すれば取り消されない片方向の判定であり、誤って早く確定するリスクのほうが小さいため。

経過時間は端末の現在時刻ではなく**観測の `recordedAt`** で計算する。
時刻の巻き戻りは既存の `isStaleLocationObservation` が先に弾く。

到達済みのスポットは候補から除外し、再判定しない。

### 7.3 Plus無効時

Plusの有効状態は配信バッチごとに取得する（滞在場所の `getActiveStayPlaces` と同じ粒度）。
無効なら `resolveLandmarkArrival` を呼ばず、`LandmarkArrivalState` を初期状態へリセットする。

### 7.4 判定フロー全体

```
recordLocationObservation（観測ごと・排他トランザクション）
  ├ Plus無効 → スキップ + 状態リセット
  ├ resolveStayPlaceSnap          既存
  └ resolveLandmarkArrival        新規
       → 到達確定なら landmark_spot_visits へ INSERT OR IGNORE

processAchievementsForSavedPoint（保存点の後段）
  └ evaluateAndStoreAchievementUnlocks
       → landmarkPackCompletion 条件を評価し、完走実績を解除
```

到達の検知と実績の解除を分ける。検知は観測単位、解除は既存の実績フローに乗せる。

## 8. パック完走実績

### 8.1 実績定義

既存の実績システムへパック完走を追加する。

```ts
// AchievementCategory へ追加
export type AchievementCategory = 'distance' | 'logDays' | 'prefecture' | 'municipality' | 'landmarkPack';

// AchievementCondition へ追加
| { type: 'landmarkPackCompletion'; packId: string; threshold: number }
```

`threshold` はパックの有効スポット数（`retired` を除いた件数）とする。
`AchievementProgress` にはパックIDごとの到達数を持たせ、`getProgressValueForCondition` で解決する。

11パックぶんの完走実績を `ACHIEVEMENT_DEFINITIONS` へ追加する。

### 8.2 既存実績画面グリッドへの影響

`AchievementListScreen` は `categorySections` に列挙したカテゴリだけをグリッド表示する。
`landmarkPack` を `categorySections` へ追加しないことで、**パック完走実績がグリッドへ混ざらない**。

`resolveAchievementDisplayStates` の段階開示（次の1件だけ表示し残りは「？？？」）は
スポットには適用しない。どこへ行けばよいかを見せることが機能の本質であり、隠すと意味が壊れるため。

### 8.3 完走時の扱い

パック完走は通常の実績解除として扱う。既存の `AchievementUnlockModal` によるトロフィー演出とX共有がそのまま動く。
日別記録詳細の「その日の実績」（`getAchievementUnlocksByDate`）にも表示される。

### 8.4 スポット到達の通知

スポット到達は実績ではないため、**トロフィー演出を出さない**。

`landmarkNotificationService` を新設し、「華厳の滝に到達しました」＋「日本三名瀑 2/3」の
控えめなローカル通知のみを出す。

## 9. UI

### 9.1 実績画面のスタック化

実績画面からパック詳細へ遷移するため、単一ファイルの `src/app/achievements.tsx` をディレクトリ化する。

```
src/app/achievements.tsx          削除
src/app/achievements/
  _layout.tsx                     新規。animation: 'slide_from_right', gestureEnabled: true
  index.tsx                       既存の中身を移動（URLは /achievements のまま）
  [packId].tsx                    新規。パック詳細
```

URLが変わらないため既存の `openAchievements()` は改修不要。
`src/ui/pathnameToScreenMode.ts` に `/achievements/[packId]` のSentry画面名マッピングを追加する。

`AGENTS.md` 10.2 の「子画面は右から入り、iOSでは左端スワイプバックを有効にする」を満たす。

### 9.2 実績画面のスポットセクション

既存グリッドの下にリスト形式のセクションを追加する。見出しは「スポット (Strollia Plus)」。

```
◀ 地図                実績

  総移動距離
  [🏆][🏆][🏆]                     ← 既存グリッド

  スポット (Strollia Plus)          ← 新セクション（リスト）

  ┌────────┬──────────────────────────────────┬───┐
  │ トロフィー │ 日本本土四極                      │   │
  │  画像   │ 民間人がたどり着ける日本の東西南北の極 │ › │
  │        │ 3/4 ▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░           │   │
  └────────┴──────────────────────────────────┴───┘
```

パック名は**既存のリストタイトルスタイルをそのまま使う**（`prominent` を指定しない）。
`AGENTS.md` 10.2 の「太字をデフォルトにしない」に従う。

### 9.3 トロフィー画像の3状態

到達率 = `到達数 ÷ (総スポット数 − retired数)` で切り替える。

| 到達率              | 表示       | 実装                                                   |
| ------------------- | ---------- | ------------------------------------------------------ |
| 0〜50%（50%を含む） | シルエット | `Image` の `tintColor`。既存の `hidden` 状態と同じ手法 |
| 50%超〜100%未満     | 白黒       | `Grayscale`。既存の `next` 状態と同じ手法              |
| 100%                | フルカラー | そのまま                                               |

どちらも `AchievementListScreen.tsx` で既に使用している手法であり、新しい依存は不要。
`Grayscale` はネイティブフィルタの制約で数値の画像サイズを要求するため、既存と同じく画面幅から算出する。

### 9.4 進捗表示は分数を使う

パーセントではなく「3/4」の分数で表示する。

3件・4件のパックが多く、パーセントでは 0% / 33% / 67% / 100% と端数が汚いうえ、
**残り何箇所かが読み取れない**。分数なら「あと1つで完走」が一目で分かり、動機づけになる。
プログレスバーは割合をそのまま塗るため、視覚的な情報量は変わらない。

バーの色は固定色ではなくテーマのアクセント色を参照し、ライト／ダークに追従させる。

### 9.5 コンポーネント

画面独自コンポーネントを新設せず、既存の汎用コンポーネントを使う。

| 用途                                 | コンポーネント                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| ヘッダー（進捗を `subtitle` に表示） | `AppScreenHeader`（既存）                                                                            |
| リスト行                             | `AppListItem`（既存。`footer?: ReactNode` スロットを追加拡張）                                       |
| プログレスバー                       | `AppProgressBar`（**新規・汎用**。割合と色を受け取るだけ。月次レポート等でも再利用できる名前にする） |
| セクション見出し                     | `ScreenSection`（既存）                                                                              |
| 戻るボタン                           | `AppBackButton`（既存）                                                                              |

`AppListItem` にはプログレスバーを置くスロットがないため、任意の `footer` スロットを追加する。
特定画面に閉じた拡張にせず、汎用の追加スロットとして実装する。

### 9.6 パック詳細画面

```
◀ 実績
     日本三名瀑
       2/3

  ✓  華厳の滝        栃木県      2026/04/12  ›
  ✓  那智の滝        和歌山県    2025/11/03  ›
  ○  袋田の滝        茨城県                  ›
```

`retired` なスポットは「現存せず」と表示し、完走判定の分母から外す。

同一スポットが他パックにも所属していること（備中松山城が三大山城にも属するなど）は、
ノイズになるため初回は表示しない。

### 9.7 行タップの遷移

| 状態     | 遷移先                                                                    |
| -------- | ------------------------------------------------------------------------- |
| 到達済み | その日の日別記録詳細（`/daily-logs/[date]`）。`visited_local_date` を使う |
| 未到達   | 地図画面へ遷移し、そのスポットを中心に表示する                            |

未到達スポットの位置を地図で確認できることは、「次はどこへ行こう」という体験の中核になる。

### 9.8 Plus未加入時の表示

パック一覧を**表示順の先頭1件だけ**表示する。表示するパックを固定することで、
起動のたびに内容が変わる不安定さを避ける。

```
  スポット (Strollia Plus)

  🔒 日本三名瀑
     日本を代表する3つの名瀑

  Strollia Plus なら、日本本土四極や
  現存天守十二城など全11パックを集められます
```

- トロフィーはシルエット表示、鍵アイコンを添える
- **プログレスバーと進捗は表示しない**。検知していないため、進捗を出すと誤解を招く
- 行のタップで Paywall へ遷移する
- リストの下に、他パックの存在を伝える誘導文を置く

実装は `premium-gate` スキルの手順に従う。

## 10. 初回ラインナップ

11パック、パック所属の延べ数63、スポット実体61件（重複2件を除く）。

| パック           | 件数 |
| ---------------- | ---- |
| 日本三景         | 3    |
| 日本三名瀑       | 3    |
| 日本三名園       | 3    |
| 日本三大鍾乳洞   | 3    |
| 日本本土四極     | 4    |
| 日本三大山城     | 3    |
| 日本三大水城     | 3    |
| 日本三大湖城     | 3    |
| JRA競馬場        | 10   |
| 現存天守十二城   | 12   |
| のぼれる灯台16基 | 16   |

各パックのメンバーは `docs/landmark-spot-packs.md` 第4節を参照する。

### 10.1 データ作成時の注意

- 座標は**自分で地図を確認して手入力する**。外部データセットからの抽出はライセンス継承の問題があるため行わない
- 城系には現存天守ではないものが含まれる（膳所城跡公園、高島城、高松城、今治城、中津城）。判定点が城跡になるため個別に確認する
- 半径と滞在時間はスポットの性質で調整する。目安は以下
  - 岬・碑: 半径100〜200m、滞在2分程度。「車で通り過ぎた」を除外し「降りて歩いた」を拾う
  - 競馬場など広い敷地: 半径500〜600m
  - 滝・展望台: 半径150m前後
- 11パックぶんの `description` も同時に用意する

## 11. テスト方針

| 対象                      | 検証内容                                                                                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolveLandmarkArrival`  | 半径の境界値（境界は範囲内）、滞在時間の到達・未達、候補の切り替え、1点の外れ値を許容すること、2点連続で外ならリセットすること、到達済みスポットを候補から除外すること |
| カタログ生成物            | `id` / `slug` の重複、緯度経度の範囲、`radiusMeters > 0`、`dwellSeconds >= 0`、**`spotSlugs` が実在するスポットを指すこと**                                            |
| `landmarkVisitRepository` | `db` をモックし、重複INSERTが無害なこと、`visited_local_date` が正しく記録されること                                                                                   |
| パック完走判定            | 多対多（備中松山城への1回の到達で2パックの進捗が進むこと）、`retired` を分母から除外すること                                                                           |
| Plus連携                  | Plus無効時に検知を行わず状態がリセットされること、解約後も訪問記録が残ること                                                                                           |
| 画面                      | パック一覧の進捗表示とトロフィー3状態、無料時の1件制限とPaywall遷移、行タップの遷移先分岐（到達済み→日別記録 / 未到達→地図）                                           |

テストの説明文は日本語で書く（`AGENTS.md` §9）。

## 12. 未決定事項

| 項目                     | 内容                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| ヘルパーツール           | 61件の座標・半径を地図上で決めるツールは別途検討する。スキーマがツールとアプリの契約になる |
| パック完走トロフィー画像 | 11枚のデザインが必要。素材の用意方法を決める                                               |
| 個別スポットのトロフィー | 余力が出た段階で、個別スポットにも画像を付けるかを再検討する                               |
| 地図へのスポット表示     | 未到達スポットを地図上に常時表示するかは初回では扱わない                                   |
