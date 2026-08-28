import { Dimensions, PixelRatio } from 'react-native';

import { getPhotoPreviewAsync } from '@modules/photo-thumbnail';

/**
 * 画面サイズを取得できなかった場合に使う一辺のピクセル数。
 *
 * 拡大表示が粗いままにならない程度に大きく、かつデコード負荷が現実的な値として選ぶ。
 */
export const PHOTO_PREVIEW_FALLBACK_SIZE = 1024;

/**
 * 拡大表示に必要な一辺のピクセル数を、画面サイズとピクセル密度から求める。
 *
 * **長辺基準にするのは、端末の向きで要求サイズが変わらないようにするため**である。
 * 要求サイズはネイティブ側の書き出しファイル名に入るので、向きを変えるたびに値が変わると
 * 同じ写真を何度も書き出し直すことになる。
 *
 * 上限を設けていないのは、画面が表示できる以上のピクセルを要求していないためである
 * (ハードウェア側で自然に上限が決まる)。逆に画面より小さいサイズを要求すると、
 * まさに今回直したい「拡大表示が粗い」状態になる。
 *
 * @param screenWidth - 画面の幅(dp)。
 * @param screenHeight - 画面の高さ(dp)。
 * @param pixelRatio - 画面のピクセル密度。
 * @returns 要求する一辺のピクセル数。値を取得できない場合はフォールバック値。
 */
export function resolvePhotoPreviewPixelSize(screenWidth: number, screenHeight: number, pixelRatio: number): number {
  const longestEdge = Math.max(screenWidth, screenHeight);

  if (!Number.isFinite(longestEdge) || !Number.isFinite(pixelRatio) || longestEdge <= 0 || pixelRatio <= 0) {
    return PHOTO_PREVIEW_FALLBACK_SIZE;
  }

  return Math.round(longestEdge * pixelRatio);
}

/**
 * 拡大表示で要求する一辺のピクセル数。
 *
 * 端末ごとに固定なのでモジュール読み込み時に1度だけ求める。ネイティブ側はこの値を
 * 書き出しファイル名に含めるため、実行中に揺れない値であることが重要になる。
 */
export const PHOTO_PREVIEW_SIZE = resolvePhotoPreviewPixelSize(
  Dimensions.get('screen').width,
  Dimensions.get('screen').height,
  PixelRatio.get(),
);

/**
 * アセットID → 拡大表示用URI のメモリキャッシュ。
 *
 * `photoDisplayUri` のキャッシュと同じ理由で**永続化してはいけない**。
 * キャッシュディレクトリ上のパスなので、OSが消したあとに参照すると存在しないパスになる。
 */
const previewUriCache = new Map<string, string>();

/**
 * 拡大表示用の高解像度画像を解決する。
 *
 * **この経路だけ iCloud からのダウンロードを許可する**(`getPhotoPreviewAsync` のJSDocを参照)。
 * マーカー用のサムネイル解決(`resolvePhotoDisplayUri`)は従来どおり通信を行わない。
 * 地図描画中に通信が走ると通信量と App Hang の問題が再発するため、
 * 通信は「ユーザーが写真を明示的にタップした」ときだけに限っている。
 *
 * **取得できない場合は例外を投げずnullを返す。** 機内モードやオフラインでは取得できないのが
 * 正常な結果であり、呼び出し側はサムネイル表示のまま据え置ける。失敗はキャッシュしないので、
 * 次に開いたときに再試行される。
 *
 * @param assetId - 写真ライブラリ上のアセットID(iOSでは `PHAsset.localIdentifier`)。
 * @returns 高解像度画像の `file://` パス。取得できない場合はnull。
 */
export async function resolvePhotoPreviewUri(assetId: string): Promise<string | null> {
  const cached = previewUriCache.get(assetId);
  if (cached !== undefined) {
    return cached;
  }

  const previewUri = await getPhotoPreviewAsync(assetId, PHOTO_PREVIEW_SIZE);
  if (previewUri === null) {
    return null;
  }

  previewUriCache.set(assetId, previewUri);

  return previewUri;
}

/**
 * 拡大表示用URIのメモリキャッシュを空にする。
 *
 * 解決結果はセッション内でのみ有効な一時パスなので、テストのケース間分離などで捨てられるようにする。
 *
 * @returns なし。
 */
export function clearPhotoPreviewUriCache(): void {
  previewUriCache.clear();
}
