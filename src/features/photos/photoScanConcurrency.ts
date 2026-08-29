/**
 * 写真ライブラリへの問い合わせ(位置情報の取得 / 表示用URIの解決)の同時実行数。
 *
 * 旧APIの `getAssetInfoAsync` はネイティブ実装(iOS)が完了ブロック内でフル解像度画像をメインキュー上で
 * デコードするため、一斉並列で発行するとメインスレッドが長時間ブロックされ App Hang を引き起こしていた
 * (2026-08-08 Sentry 観測: 200並列でメインスレッドが2秒以上停止)。
 * 同時実行数を絞ることでメインキューへ一度に積まれるデコード量を抑える。
 *
 * 新APIの `Asset.getLocation()` は `phAsset.location` を直接読むだけでデコードを伴わないため、
 * この上限は緩められる余地がある。ただし**実測してから**変えるべきなので、新API移行では値を据え置く
 * (設計書 `docs/superpowers/specs/2026-08-28-media-library-next-api-design.md` §4.1)。
 *
 * 表示用URIの解決(`resolvePhotoDisplayUri`)はフル解像度デコードを伴わないが、
 * `PHImageManager.requestImage` はサムネイルのデコードとJPEGの書き出しを行う。
 * 一斉に走ると同じ轍を踏みうるため、別の値を持つ理由もなく同じ上限を共有する。
 *
 * **走査(`photoLibrary`)と表示用URIの解決(`photoDisplayUri`)の両方から参照するため、
 * どちらにも依存しない独立モジュールへ置いている。** `photoLibrary` は `photo_assets` を通じて
 * SQLite接続を開くので、そこへ定数を置くと純粋な表示側モジュールまでDBへ依存してしまう。
 */
export const PHOTO_INFO_CONCURRENCY = 4;
