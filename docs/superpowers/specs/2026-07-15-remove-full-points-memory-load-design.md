# 全GPSポイントのメモリロード廃止 設計書

作成日: 2026-07-15
ステータス: レビュー待ち

## 背景

2026-07-14 の Sentry ログで、起動直後の地図画面(`index`)で
`RangeError: Maximum call stack size exceeded (native stack depth)` が発生し、直後に
`WatchdogTermination`(OSによるRAM過剰使用の強制終了)でアプリが落ちる事象を確認した。

調査の結果、根本原因は以下の通り。

- 直接原因: `createInitialRegion()`(`src/features/map/routeMapper.ts`)の
  `Math.min(...latitudes)` / `Math.max(...)` が、全GPSポイント分の配列をスプレッド展開している。
  アプリと同じ Hermes 0.81.5 での実測により、**約104.8万要素(2^20)** を超えるとこの
  RangeError(接尾辞 `(native stack depth)` 含め完全一致)が発生することを確認した。
  純粋なJS再帰では接尾辞なしのメッセージになるため、他の仮説は除外できる。
- 背景要因: `refreshData` が `getAllLocationPoints()`(LIMITなし)で**全期間の全ポイントを
  JSメモリへロード**しており、100万件規模では数百MBのメモリ消費と数秒のJSスレッド
  フリーズを起こす。これが WatchdogTermination の原因。
- 到達性: 通常記録(10秒間隔)でも数カ月で到達し得るほか、GPXインポート機能により
  他サービスの長期ログを取り込めば一度に到達し得る。

## 目的

1. GPSポイント件数に依存しない起動・地図表示にする(クラッシュとフリーズの根本解決)
2. `createInitialRegion` 系のスプレッド展開を除去する(月次レポート・日別詳細など
   月/日スコープの呼び出し元にも効く防御)
3. GPXエクスポートのメモリ使用を日別チャンクに有界化する

## 非目的(スコープ外)

- Zipエクスポート(将来ファイルサイズの不満が出たら「Zipエクスポート+Zipインポート」を
  セットで別issueとして検討する)
- 地図の見た目・描画方式の変更
- DBスキーマの変更(テーブル・カラム・インデックスの追加は行わない)
- 実績判定ロジックの変更(既に日付スコープの独自SQLで動作しており影響なし)

## 現状の全期間 `points` 配列の消費箇所と置き換え方針

| 消費箇所                                                                                                                          | 実際に必要なもの                              | 置き換え                                     |
| --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------- |
| `useMapRouteState` → `initialRegion`                                                                                              | 緯度経度の min/max                            | SQLの `MIN/MAX/COUNT` 境界クエリ             |
| `useMapRouteState` → `renderRouteCoordinates`(消費者は `useAutoFitInitialRoute` のみ。メイン地図はルートPolylineを描画していない) | ルート全体の外接範囲                          | `initialRegion` へのアニメーションに置き換え |
| `useMapRouteState` → `distance`(総距離)                                                                                           | 日別サマリー合計 + 距離欠落日のフォールバック | 欠落日だけ日付スコープでポイント取得して計算 |
| `MapScreen` の `points.length === 0`(空状態表示)                                                                                  | 記録の有無                                    | 境界クエリの件数から導出した boolean         |
| 月次レポート(ゲート判定 + 画面)                                                                                                   | 先月分のポイントのみ                          | 月スコープのSQLクエリ                        |
| GPXエクスポート(全件)                                                                                                             | 全件(ただしオンデマンド)                      | エクスポート実行時に日別チャンクで取得・追記 |

## 設計

### 1. リポジトリ層(`src/features/logs/logRepository.ts`)

新規関数を追加する。既存関数のシグネチャは変えない。

```typescript
/** 有効な緯度経度を持つ全ポイントの外接境界と件数。 */
export type LocationPointsBounds = {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
  /** 境界計算に使った有効ポイント件数。 */
  pointCount: number;
};

/** 全ポイントの境界と件数をSQLで集計する。有効ポイントが0件ならnull。 */
export async function getLocationPointsBounds(): Promise<LocationPointsBounds | null>;

/** 指定月(YYYY-MM形式の文字列)のポイントを時系列で取得する。 */
export async function getLocationPointsByMonth(yearMonth: string): Promise<LocationPoint[]>;
```

- 境界クエリは `SELECT MIN(latitude), MAX(latitude), MIN(longitude), MAX(longitude), COUNT(*)`。
  `WHERE latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180` で、現行
  `isValidRouteCoordinate` と同じ有効性フィルタをSQL側で適用する(NULLも自然に除外される)。
- 100万行のフルスキャンでもSQLiteネイティブなら数十ms程度。従来の全件ロード
  (同じフルスキャン+全行転送+JSオブジェクト化)より常に軽い。
- 月スコープは `WHERE local_date LIKE '<YYYY-MM>-%'`(`local_date` は `YYYY-MM-DD` 形式)。

### 2. 総距離のフォールバック計算(サービス層)

`calculateDisplayDistance`(`useMapRouteState.ts` 内の純関数)は「距離欠落ログが1件でも
あれば全ポイントから再計算」する設計だった。これを日付スコープ版に置き換える。

- 新規: `src/features/logs/dailyLogsService.ts` に
  `calculateTotalDistanceMeters(dailyLogs): Promise<number>` を追加。
  - `distanceMeters != null` のログは保存値を合計する。
  - 欠落している日だけ `getLocationPointsByDate(localDate)` でポイントを取得し
    `totalDistanceMeters` で計算する(実績リポジトリの既存フォールバックと同じ方式。
    実績側の実装は今回触らない)。
- 呼び出しは `refreshData` 内(非同期)。UI へは計算済みの数値だけを渡す。

### 3. `routeMapper.ts` のスプレッド除去と境界→Region変換の共通化

- 新規純関数 `createRegionFromBounds(bounds: LocationPointsBounds | null): Region` を追加。
  マージン1.4倍・最小デルタ0.01・0件時 `DEFAULT_REGION` という現行 `createInitialRegion` の
  仕様をそのまま移す。
- `createInitialRegion(points)` は「ループで境界を計算 → `createRegionFromBounds`」に
  書き換える。**スプレッド展開と中間配列(`latitudes`/`longitudes`)を全廃**する。
  シグネチャ・返り値仕様は不変のため、月次レポート・日別詳細・`RouteMapPanel` 等の
  既存呼び出し元はそのまま動く。
- `toRenderRouteCoordinates` / `simplifyRouteCoordinates`(Douglas-Peucker)自体は変更しない。
  メインマップ経路での呼び出しがなくなるため、残る利用は日/月スコープに限られる。

### 4. `useLocationRecordingSync` と `AppStateProvider`

- `points` state を廃止し、`pointsBounds: LocationPointsBounds | null` と
  `totalDistanceMeters: number` を state として持つ。
  `refreshData` は `getAllLocationPoints()` の代わりに `getLocationPointsBounds()` と
  `calculateTotalDistanceMeters(dailyLogs)` を呼ぶ。
- `useMapRouteState` フックは廃止する。`AppStateProvider` 内で
  `initialRegion = useMemo(() => createRegionFromBounds(pointsBounds), [pointsBounds])` とする。
- `AppStateContextValue` の変更:
  - 削除: `points`, `renderRouteCoordinates`
  - 追加: `hasAnyLocationPoints: boolean`(`pointsBounds != null`)
  - 維持(導出元のみ変更): `initialRegion`, `distance`
- `useAutoFitInitialRoute` は「ルート座標列へのフィット」から「`initialRegion` への
  `animateToRegion`」に変更する。発火条件は現行の
  `screenMode === 'map' && 座標が2点以上 && 現在地未取得` を
  `screenMode === 'map' && pointsBounds.pointCount >= 2 && 現在地未取得` に対応させる。
  `initialRegion` は現行フィットと同じ外接範囲(+マージン)のため、見た目はほぼ同等。
- `MapScreen` の props から `points: LocationPoint[]` を外し、
  `hasAnyLocationPoints: boolean` に置き換える(空状態表示のみが用途のため)。

### 5. 月次レポート

- `openMonthlyReport` のゲート判定(Plus確認後)で `getLocationPointsByMonth(先月)` を
  取得し、`createMonthlyReport(dailyLogs, monthPoints, 先月)` を構築して
  `hasMonthlyReportData` を判定する(現在も RevenueCat 確認で非同期のため、導線のUXは
  変わらない。取得失敗時は既存の `catch` と同様に Alert で通知する)。
- 取得した先月分ポイントを `monthlyReportPoints: LocationPoint[]` として Context に保持し、
  `src/app/monthly-report.tsx` 経由で `MonthlyReportScreen` へ渡す。画面側の
  `createMonthlyReport` 呼び出しはそのまま(月スコープ済みポイントに対する月フィルタは
  無害な恒等操作になる)。
- `createMonthlyReport` のシグネチャは変更しない。

### 6. GPXエクスポートの日別チャンク追記化(`src/features/export/`)

- `buildGpx` を分解し、純関数としてテスト可能にする:
  - `buildGpxHeader(name: string): string`
  - `buildGpxDayTrack(localDate: string, points: LocationPoint[]): string`(1日 = 1 `<trk>`)
  - `buildGpxFooter(): string`
- 新規サービス `shareAllLogsAsGpx(): Promise<void>`:
  1. `getDailyLogs()` で日付一覧を取得(0件なら現行と同じエラーメッセージ)
  2. expo-file-system の新API(`File` / `FileHandle.writeBytes`)でヘッダを書き込み、
     日付ごとに `getLocationPointsByDate(date)` → `buildGpxDayTrack` → 追記、最後にフッタ
  3. 現行同様 `expo-sharing` で共有シートを開く
  - メモリ使用は最大でも「1日分のポイント + その文字列チャンク」に有界化される。
  - 文字列→ `Uint8Array` 変換はUTF-8エンコードのヘルパー関数を純関数として用意する
    (グローバル `TextEncoder` が利用できる場合はそれを使う)。
- `AppStateProvider.exportAllLogs` は `shareGpx(points, 'all')` の代わりに
  `shareAllLogsAsGpx()` を呼ぶ(引数なし)。
- 既存 `shareGpx(points, localDate)` と `buildGpx` の呼び出し元は `AppStateProvider` のみの
  ため、全件エクスポート経路の置き換え後に旧実装は削除する。
- **出力ファイル構造の変更**: 単一 `<trk>` → 日別 `<trk>`(名前は日付)。GPX 1.1 として正規で、
  自アプリのインポータは全 `<trkpt>` を構造非依存で収集する実装
  (`gpxImporter.ts` の `findNodesByName(parsed, 'trkpt')`)のため往復互換は維持される。
  ファイル名 `strollia-all.gpx` は変更しない。

### 7. テスト方針

`AGENTS.md` §2/§9 と `.ai/context/testing.md` に従う。説明文は日本語。

- `routeMapper`: **110万要素の座標配列で `createInitialRegion` が例外を出さず正しい境界を
  返す**回帰テスト(ループ実装なら高速に完走する)。`createRegionFromBounds` の
  マージン・最小デルタ・null時デフォルトのテスト。既存テストの維持。
- `logRepository`: `getLocationPointsBounds`(通常・0件・無効座標のみ)と
  `getLocationPointsByMonth` を、既存パターン通り `db` モジュールモックで検証。
- `dailyLogsService`: `calculateTotalDistanceMeters` の「全日保存値あり」「一部欠落」
  「全欠落」ケース。
- `gpxExporter`: ヘッダ/日別trk/フッタの文字列生成、複数日の組み立て順、
  **生成したGPXを `parseGpxToLocationPoints` に通して全点が戻る往復テスト**。
  ファイル書き込みは `File`/`Sharing` をモックし、日別追記の呼び出し順を検証。
- 既存テストの更新: `AppStateProvider` / `MapScreen` / `MonthlyReportScreen` /
  `useLocationRecordingSync` / ルーター統合テストの props・モック差し替え。
  `useMapRouteState` のテストは `createRegionFromBounds` 等の移設先へ引き継ぐ。

### 8. ドキュメント更新

- `docs/data-storage.md`: 境界クエリ・月スコープクエリの追記
- `docs/architecture.md` と `.ai/context/architecture.md`: `useMapRouteState` 廃止、
  Context から `points` 削除
- `docs/map-rendering.md`: 初期表示範囲の導出方法の変更
- `docs/import-export.md`: エクスポートGPXの日別 `<trk>` 構造と往復互換の説明

## ユーザーへの影響

- 起動時のフリーズ・クラッシュが解消される(データ量に依存しない)
- 月次レポートを開く際に先月分のDBクエリが走る(現在も課金状態確認で非同期のため
  体感の変化はほぼない)
- エクスポートされるGPXの内部構造が日別 `<trk>` になる(再インポート・他ツール互換は維持)
- 上記以外(地図の初期表示範囲、空状態表示、総距離、日別・月次の各画面)は同じ見た目・同じ値

## リスクと対応

| リスク                                                                     | 対応                                                                               |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 距離フォールバックの計算結果が旧実装とずれる                               | 同一入力での新旧一致をテストで担保する                                             |
| `initialRegion` へのアニメーションが旧 `fitToCoordinates` と見え方が異なる | マージン仕様が同じRegionを使うため差は軽微。実機確認をレビュー項目に含める         |
| expo-file-system 新APIの挙動差(旧 `legacy` API から移行)                   | エクスポートのE2E相当の手動確認(実機でエクスポート→再インポート)を検証手順に含める |
| Context/props 変更の波及漏れ                                               | `npm run typecheck` で網羅的に検出できる(型が消えるため)                           |
