/**
 * 走査済みの時間窓に基づく突き合わせ条件を組み立てる純粋関数群。
 *
 * 写真ライブラリの走査は `creationTime` の降順(新しい → 古い)で進むため、1ページ走査し終えた時点で
 * **「そのページ内で最も古い撮影日時以降は全部見た」**と言える。この時間窓の中にありながら今回の走査で
 * 確認できなかった `photo_assets` の行は、写真ライブラリから削除されたかジオタグを失ったかのどちらかであり、
 * 残しておくと画像の読み込みに失敗して地図上に空のバブルが出てしまう。
 *
 * 判定の副作用(DB削除)は破壊的なので、ここでは**安全側へ倒す**ことを最優先にしている。
 * 少しでも「消してよいと言い切れない」状況では突き合わせ自体を行わない、または対象から外す。
 */

/**
 * 窓の下限計算に必要な、走査したアセットの最小情報。
 *
 * `MediaLibrary.Asset` そのものではなく構造的な型で受けることで、この判定ロジックを
 * expo-media-library から切り離して単体テストできるようにしている。
 */
export type ScannedAsset = {
  /** 撮影日時のUnixミリ秒。iOSの `PHAsset.creationDate` は optional なため未設定になりうる。 */
  creationTime?: number | null;
};

/** 走査した1アセットの結果。 */
export type ScannedAssetOutcome = {
  /** 写真ライブラリ上のアセットID。 */
  assetId: string;
  /** `getAssetInfoAsync` が解決したかどうか。rejectされた場合はfalse。 */
  isInfoResolved: boolean;
  /** ジオタグ付きとして `photo_assets` へ保存したかどうか。 */
  isSaved: boolean;
};

/**
 * `photo_assets` の行を走査結果と突き合わせるための条件。
 *
 * `scannedEntireLibrary` で分岐する判別可能ユニオンにしているのは、
 * 「窓の下限が無いのに全期間ではない」という危険な中間状態を型として表現できなくするため。
 */
export type PhotoAssetReconciliation = {
  /**
   * 走査で存在を確認できたため削除してはいけないアセットID。
   *
   * 「再保存した(ジオタグあり)」と「`getAssetInfoAsync` がrejectされた(判断不能)」の和集合。
   */
  retainedAssetIds: string[];
} & (
  | {
      /** ライブラリ全体を走査し終えたか。trueなら `taken_at` がNULLの行も突き合わせ対象になる。 */
      scannedEntireLibrary: true;
    }
  | {
      /** ライブラリ全体を走査し終えたか。 */
      scannedEntireLibrary: false;
      /** 走査済み時間窓の下限(ISO 8601)。この日時以降の `taken_at` を持つ行だけが対象。 */
      oldestTakenAt: string;
    }
);

/** `createPhotoAssetReconciliation` の引数。 */
export type CreatePhotoAssetReconciliationParams = {
  /** `getAssetsAsync` が返したページ内の全アセット。ジオタグの有無を問わない。 */
  assets: readonly ScannedAsset[];
  /** ページ内アセットの走査結果。 */
  outcomes: readonly ScannedAssetOutcome[];
  /** さらに古いページが残っているかどうか。 */
  hasNextPage: boolean;
};

/**
 * 走査済み時間窓の下限(ページ内で最も古い撮影日時)を求める。
 *
 * **ジオタグ付きのアセットだけで計算してはいけない。** 実際に「見た」のはページ全体であり、
 * ジオタグ付きだけに絞ると窓が実際より新しい側へ狭まり、消すべき行を消し損ねる
 * (逆に広げてしまうと消してはいけない行を消すため、狭める方向が安全側ではあるが不正確)。
 *
 * 撮影日時を持たないアセット(iOSに実在する)や0以下・非有限の値は、時刻として信用できないため除外する。
 *
 * @param assets - `getAssetsAsync` が返したページ内の全アセット。
 * @returns 最も古い撮影日時のISO 8601文字列。ひとつも算出できない場合はnull。
 */
export function resolveScannedWindowOldestTakenAt(assets: readonly ScannedAsset[]): string | null {
  let oldestCreationTime: number | null = null;

  for (const asset of assets) {
    const creationTime = asset.creationTime;

    // 0 や負値をエポック時刻として窓の下限にすると全期間が対象になってしまうため弾く
    if (typeof creationTime !== 'number' || !Number.isFinite(creationTime) || creationTime <= 0) {
      continue;
    }

    if (oldestCreationTime === null || creationTime < oldestCreationTime) {
      oldestCreationTime = creationTime;
    }
  }

  return oldestCreationTime === null ? null : new Date(oldestCreationTime).toISOString();
}

/**
 * 窓の中で削除してはいけないアセットIDを求める。
 *
 * 「消してよい行」ではなく「残す行」を列挙するのが要点である。`getAssetInfoAsync` が一部失敗しただけの
 * 走査で実在する写真の行を消してしまわないよう、**判断できないものは残す側へ倒す**。
 *
 * | 状況                                            | 判定             |
 * | ----------------------------------------------- | ---------------- |
 * | 再保存された(ジオタグあり)                      | 残す             |
 * | 詳細取得は成功したがジオタグが無かった          | 残さない(削除)   |
 * | 詳細取得がrejectされた                          | 残す(判断不能)   |
 *
 * @param outcomes - ページ内アセットの走査結果。
 * @returns 残すアセットIDの一覧。入力順を保つ。
 */
export function resolveRetainedAssetIds(outcomes: readonly ScannedAssetOutcome[]): string[] {
  return outcomes.filter((outcome) => outcome.isSaved || !outcome.isInfoResolved).map((outcome) => outcome.assetId);
}

/**
 * 走査結果から `photo_assets` の突き合わせ条件を組み立てる。
 *
 * 端の扱いは以下のとおり。
 *
 * - `hasNextPage === false`: ライブラリ全体を見終わったので窓は全期間になる。
 *   撮影日時が取れなくても突き合わせできる(`taken_at` がNULLの行も対象)。
 *   ページが空のままここへ来た場合は「ライブラリが空」を意味し、保存済みの行はすべて削除対象になる
 * - `hasNextPage === true`: 窓は下限付きになる。下限を計算できない場合は窓の内外を判定できないため、
 *   **突き合わせ自体を行わない**(nullを返す)
 * - `hasNextPage` が真偽値として得られない想定外の場合も、`=== false` でのみ全期間と判定することで
 *   「全部見た」と誤認した削除を防ぐ
 *
 * @param params - ページ内アセット・走査結果・次ページの有無。
 * @returns 突き合わせ条件。安全に判定できない場合はnull。
 */
export function createPhotoAssetReconciliation({
  assets,
  outcomes,
  hasNextPage,
}: CreatePhotoAssetReconciliationParams): PhotoAssetReconciliation | null {
  const retainedAssetIds = resolveRetainedAssetIds(outcomes);

  if (hasNextPage === false) {
    return { scannedEntireLibrary: true, retainedAssetIds };
  }

  const oldestTakenAt = resolveScannedWindowOldestTakenAt(assets);

  if (oldestTakenAt === null) {
    return null;
  }

  return { scannedEntireLibrary: false, oldestTakenAt, retainedAssetIds };
}
