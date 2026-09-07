import type { ScannedAsset } from '@/features/photos/photoScanWindow';
import { getStringSetting, setSetting } from '@/features/settings/settingsRepository';

/**
 * 差分走査の基準時刻(前回の走査で確認できた最新の撮影日時)の設定キー。
 *
 * 値は `new Date(ms).toISOString()` のISO 8601文字列で保存する。数値のUnixミリ秒ではなく文字列に
 * するのは、`photo_assets.taken_at` と同じ表記にして DB の値と目視で突き合わせられるようにするため。
 */
export const PHOTO_SCAN_BASELINE_SETTING_KEY = 'photoLibraryLastScannedTakenAt';

/**
 * 走査結果から次回の差分走査の基準時刻を求める。
 *
 * 走査したアセットの中で最も新しい撮影日時を基準にする。差分走査は
 * `Query.gte(CREATION_TIME, 基準時刻)` で「基準時刻以降の写真」を対象にするため、
 * ここで返す値が次回に走査する範囲の下限(**包含**)になる。境界を包含にしているのは、
 * 同じ撮影日時の新規写真を取りこぼさないためである(理由は `loadGeotaggedPhotos` を参照)。
 *
 * **前回の基準時刻より古い値へ巻き戻さない。** 差分走査で新しい写真が1枚も見つからなかった場合や、
 * 走査結果に古い写真しか含まれなかった場合に巻き戻すと、走査済みの範囲を毎回走り直すことになる。
 *
 * 撮影日時を持たないアセット(iOSに実在する)や0以下・非有限の値は、時刻として信用できないため
 * 算出から除外する(`resolveScannedWindowOldestTakenAt` と同じ方針)。
 *
 * @param assets - 今回走査したアセット。ジオタグの有無は問わない(「見た範囲」が基準になるため)。
 * @param previousBaselineMs - 前回の基準時刻(Unixミリ秒)。初回はnull。
 * @returns 次回の基準時刻(Unixミリ秒)。算出できず前回の値も無い場合はnull。
 */
export function resolveNextPhotoScanBaselineMs(assets: readonly ScannedAsset[], previousBaselineMs: number | null): number | null {
  let newestCreationTime =
    previousBaselineMs !== null && Number.isFinite(previousBaselineMs) && previousBaselineMs > 0 ? previousBaselineMs : null;

  for (const asset of assets) {
    const creationTime = asset.creationTime;

    if (typeof creationTime !== 'number' || !Number.isFinite(creationTime) || creationTime <= 0) {
      continue;
    }

    if (newestCreationTime === null || creationTime > newestCreationTime) {
      newestCreationTime = creationTime;
    }
  }

  return newestCreationTime;
}

/**
 * 保存済みの差分走査の基準時刻を読み込む。
 *
 * **読めない場合はすべてnullを返す。** 呼び出し側は基準時刻が無いときに全件走査へフォールバックする
 * ため、null は「差分走査できない」という安全側の結果になる(壊れた基準時刻で差分走査すると、
 * 取りこぼしに気づけないまま走査済み扱いになってしまう)。
 *
 * **`Date.parse` が解釈できることだけでは採用しない。** `Date.parse` は ISO 8601 以外の形式を
 * 実装依存で受け入れ、`'2026-08-29'` のような値をローカル時刻ともUTCとも解釈しうる。ずれた
 * ミリ秒をそのまま差分走査の下限に使うと、有効な写真を静かに除外してしまう。保存形式
 * (`new Date(ms).toISOString()`)へ書き戻して一致する値だけを採用し、それ以外は全件走査へ倒す。
 *
 * @returns 前回の基準時刻(Unixミリ秒)。未保存・保存形式と異なる値・読み込み失敗の場合はnull。
 */
export async function getPhotoScanBaselineMs(): Promise<number | null> {
  const storedValue = await getStringSetting(PHOTO_SCAN_BASELINE_SETTING_KEY, '').catch((error: unknown) => {
    console.warn('Failed to read photo scan baseline:', error);

    return '';
  });

  if (storedValue === '') {
    return null;
  }

  const parsed = Date.parse(storedValue);

  if (Number.isNaN(parsed)) {
    return null;
  }

  // 書き戻して一致しない値は、この関数が書いたものではない(または壊れている)
  return new Date(parsed).toISOString() === storedValue ? parsed : null;
}

/**
 * 差分走査の基準時刻を保存する。
 *
 * 0以下や非有限の値は時刻として信用できないため保存しない。エポック時刻(0)を基準にすると
 * 「すべての写真が新しい」と判定され、差分走査が実質的な全件走査になってしまう。
 *
 * @param baselineMs - 保存する基準時刻(Unixミリ秒)。
 * @returns なし。
 */
export async function savePhotoScanBaselineMs(baselineMs: number): Promise<void> {
  if (!Number.isFinite(baselineMs) || baselineMs <= 0) {
    return;
  }

  await setSetting(PHOTO_SCAN_BASELINE_SETTING_KEY, new Date(baselineMs).toISOString());
}
