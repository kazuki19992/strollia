import { db, withExclusiveTransaction, type ExclusiveTransaction } from '@/db/database';
import type { PhotoAssetReconciliation } from '@/features/photos/photoScanWindow';
import type { PhotoViewportBounds } from '@/features/photos/photoViewportBounds';

/**
 * `photo_assets` に保存するジオタグ付き写真のメタデータ。
 *
 * 保存するのはメタデータのみで、写真本体は複製しない(`AGENTS.md` §5)。
 * `uri` には `getAssetsAsync` が返す**安定したURI**(iOS: `ph://…`)を入れる。
 * `getAssetInfoAsync` の `localUri` は一時パスで再起動をまたいで有効である保証がないため、
 * このテーブルには保存しない。
 */
export type PhotoAssetRecord = {
  /** 写真ライブラリ上のアセットID。 */
  assetId: string;
  /** 撮影位置の緯度。 */
  latitude: number;
  /** 撮影位置の経度。 */
  longitude: number;
  /** 撮影日時(ISO 8601)。取得できない場合はnull。 */
  takenAt: string | null;
  /** 再起動をまたいで安定した表示用URI。 */
  uri: string;
  /** 写真の横幅。 */
  width: number;
  /** 写真の高さ。 */
  height: number;
};

/** DB列名をアプリ内のcamelCaseプロパティへ揃えるSELECT句。 */
const photoAssetColumns = `
  asset_id as assetId,
  latitude,
  longitude,
  taken_at as takenAt,
  uri,
  width,
  height
`;

/**
 * 走査済み時間窓と突き合わせて、今回の走査で確認できなかった行を削除する。
 *
 * 窓の中にありながら `retainedAssetIds` に含まれない行は、写真ライブラリから削除されたか
 * ジオタグを失ったかのどちらかである。残しておくと画像の読み込みに失敗し、地図上に空のバブルが出る。
 *
 * 窓の下限は**排他**(`taken_at > ?`)である。境界時刻ちょうどの行を消さないことで、同一撮影日時の
 * 写真がページ境界をまたいだときに実在する写真を削除してしまう事故を防ぐ。
 *
 * `taken_at` はすべて `new Date(ms).toISOString()` 由来のUTC固定長表記なので、辞書順比較が時刻順比較と一致する。
 *
 * **SQLパラメータ数について**: `NOT IN` のプレースホルダはアセット1件につき1つ増える。現状は1ページ
 * (最大200件)ぶんしか渡らないためSQLiteの上限(SQLITE_MAX_VARIABLE_NUMBER)に対して十分小さい。
 * ページング走査を入れる 2-c でも1ページ単位で突き合わせる限りは同じ規模に収まるが、**複数ページ分の
 * IDをまとめて渡す設計にするなら分割が必要**になる。その際に `NOT IN` をチャンクへ素朴に分割すると
 * 「チャンクAに無い行」を消してチャンクBの行まで削除してしまうため、分割するなら一時テーブルへ
 * 残すIDを入れて `NOT IN (SELECT …)` で1文にすること。
 *
 * @param txn - 保存と同じトランザクションのランナー。
 * @param reconciliation - 突き合わせ条件。
 * @returns なし。
 */
async function deleteUnconfirmedPhotoAssets(txn: ExclusiveTransaction, reconciliation: PhotoAssetReconciliation): Promise<void> {
  const conditions: string[] = [];
  const params: string[] = [];

  if (!reconciliation.scannedEntireLibrary) {
    // 撮影日時が不明な行は窓の内外を判定できないため、明示的に対象から外す(安全側)
    conditions.push('taken_at IS NOT NULL');
    // 下限は排他。境界時刻ちょうどの行は「未走査の次ページに実在する写真」でありうるため消さない
    // (理由は `resolveScannedWindowOldestTakenAt` のJSDocを参照)
    conditions.push('taken_at > ?');
    params.push(reconciliation.exclusiveOldestTakenAt);
  }

  if (reconciliation.retainedAssetIds.length > 0) {
    conditions.push(`asset_id NOT IN (${reconciliation.retainedAssetIds.map(() => '?').join(', ')})`);
    params.push(...reconciliation.retainedAssetIds);
  }

  // 残す対象が無く全期間が対象の場合はWHERE句自体を付けない(NOT IN () は構文エラーになるため)
  const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

  await txn.runAsync(`DELETE FROM photo_assets${whereClause}`, ...params);
}

/**
 * ジオタグ付き写真のメタデータを保存し、必要なら走査済み時間窓と突き合わせる。
 *
 * `asset_id` を主キーとしたUPSERTのため、同じ写真を再走査しても行は増えない。
 * `created_at` は初回保存時の値を保ち(`visited_cells` のUPSERTと同じ方針)、
 * `updated_at` / `last_seen_at` は毎回更新する。
 *
 * ジオタグの無い写真の除外は呼び出し側の責務とし、ここでは受け取った行をそのまま保存する。
 *
 * 保存と削除は**同一トランザクション**で行う。別々に実行すると、片方だけ成功したときに
 * 「削除だけ走って保存されていない」中途半端な状態が残るため。
 *
 * @param records - 保存対象のメタデータ。空配列でも突き合わせがある場合はトランザクションを開く。
 * @param reconciliation - 走査済み時間窓との突き合わせ条件。nullの場合は削除を行わない。
 * @returns なし。
 */
export async function savePhotoAssets(records: PhotoAssetRecord[], reconciliation: PhotoAssetReconciliation | null = null): Promise<void> {
  if (records.length === 0 && reconciliation === null) {
    return;
  }

  const now = new Date().toISOString();

  await withExclusiveTransaction(async (txn) => {
    for (const record of records) {
      await txn.runAsync(
        `INSERT INTO photo_assets (
          asset_id,
          latitude,
          longitude,
          taken_at,
          uri,
          width,
          height,
          last_seen_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(asset_id) DO UPDATE SET
          latitude = excluded.latitude,
          longitude = excluded.longitude,
          taken_at = excluded.taken_at,
          uri = excluded.uri,
          width = excluded.width,
          height = excluded.height,
          last_seen_at = excluded.last_seen_at,
          updated_at = excluded.updated_at`,
        record.assetId,
        record.latitude,
        record.longitude,
        record.takenAt,
        record.uri,
        record.width,
        record.height,
        now,
        now,
        now,
      );
    }

    // 再保存した行の last_seen_at を先に更新してから突き合わせる(削除順序の取り違えを防ぐ)
    if (reconciliation !== null) {
      await deleteUnconfirmedPhotoAssets(txn, reconciliation);
    }
  });
}

/**
 * ビューポート検索で一度にJSへ載せる件数の内部上限。
 *
 * 表示上限の設定が「すべて」でも効く**ユーザーからは見えない保険**である(設計書 §4.7)。
 * クラスタリングは空間ハッシュにより O(N) で動くため数千件でも問題ないが、全写真にジオタグを付ける
 * ユーザーが広域を表示したときに、際限なく行を読み込んでメモリと描画を圧迫することを防ぐ。
 *
 * 実測(設計書 §2)では18,000枚のライブラリでジオタグ付きは1,400件だった。この規模なら上限に届かず、
 * 通常利用では存在しないのと同じ挙動になる。
 */
export const PHOTO_VIEWPORT_SAFETY_LIMIT = 5000;

/** `getPhotoAssetsInBounds` の絞り込み条件。 */
export type GetPhotoAssetsInBoundsOptions = {
  /**
   * 地図に表示する写真の上限(全体の最新N件)。nullは上限なし。
   *
   * **表示範囲ごとのN件ではない。** 設定のラベル(「最新200件」)と挙動を一致させるため、
   * 先に全体を新しい順でN件に絞り、そのうち表示範囲に入るものだけを返す。
   */
  displayLimit?: number | null;
};

/**
 * 表示範囲に含まれるジオタグ付き写真のメタデータを取得する。
 *
 * 日付変更線をまたぐ範囲では西端 > 東端になり、`BETWEEN` が空集合を返してしまう。
 * そのためまたぐ場合だけ OR 条件へ分岐する(`getGridBoundsForRegion` と同じ考え方)。
 *
 * 上限は2種類あり、役割が異なる。
 *
 * - **表示上限**(`displayLimit`): ユーザー設定。全体の最新N件へ先に絞ってから範囲で絞り込む
 * - **安全上限**(`PHOTO_VIEWPORT_SAFETY_LIMIT`): 内部固定。設定が「すべて」でも常に掛ける
 *
 * `taken_at` は `new Date(ms).toISOString()` 由来のUTC固定長表記なので辞書順=時刻順であり、
 * NULL(撮影日時不明)は `DESC` で末尾に来る。最新N件の絞り込みで撮影日時不明の写真が
 * 先頭に紛れ込むことはない。
 *
 * @param bounds - 検索対象の緯度経度境界。
 * @param options - 表示上限などの絞り込み条件。
 * @returns 範囲内の写真メタデータ。新しい撮影日時が先頭に来る。
 */
export async function getPhotoAssetsInBounds(
  bounds: PhotoViewportBounds,
  { displayLimit = null }: GetPhotoAssetsInBoundsOptions = {},
): Promise<PhotoAssetRecord[]> {
  const longitudeCondition = bounds.crossesAntimeridian ? '(longitude >= ? OR longitude <= ?)' : 'longitude BETWEEN ? AND ?';
  // 表示上限は範囲で絞る**前**に掛ける。後に掛けると「表示範囲ごとの最新N件」になり設定の意味が変わる
  const source =
    displayLimit === null
      ? 'photo_assets'
      : `(
       SELECT * FROM photo_assets
       ORDER BY taken_at DESC
       LIMIT ?
     )`;
  const displayLimitParams = displayLimit === null ? [] : [displayLimit];

  return db.getAllAsync<PhotoAssetRecord>(
    `SELECT ${photoAssetColumns}
     FROM ${source}
     WHERE latitude BETWEEN ? AND ?
       AND ${longitudeCondition}
     ORDER BY taken_at DESC
     LIMIT ?`,
    ...displayLimitParams,
    bounds.minLatitude,
    bounds.maxLatitude,
    bounds.westLongitude,
    bounds.eastLongitude,
    PHOTO_VIEWPORT_SAFETY_LIMIT,
  );
}
