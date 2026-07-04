import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

/** DocumentPicker に渡す MIME タイプ。GPX は標準 MIME が普及していないため任意ファイルを受け付ける値を使う。 */
const DOCUMENT_PICKER_TYPE = '*/*';

/** ユーザーが選択した GPX ファイルの内容。 */
export type PickedGpxFile = {
  /** 選択したファイルの名前。 */
  fileName: string;
  /** UTF-8 で読み込んだファイル内容。 */
  content: string;
};

/**
 * ユーザーにファイルピッカーを表示し、選択した GPX ファイルを UTF-8 文字列として読み込む。
 *
 * - キャンセルされた場合は null を返す。
 * - 拡張子・URIのどちらも `.gpx` でなければ Error をスローする。
 * - ファイルの内容に `<gpx` ルート要素が含まれなければ Error をスローする。
 *   （誤って非 GPX ファイルを選んだ場合のフィードバック用）
 *
 * DocumentPicker の `copyToCacheDirectory: true` を使うことで、
 * ファイル読み込み中に元ファイルが消えても安全に読み込める。
 */
export async function pickAndReadGpxFile(): Promise<PickedGpxFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: DOCUMENT_PICKER_TYPE,
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  const fileName = asset.name ?? 'import.gpx';

  if (!isGpxFileName(fileName) && !isGpxFileName(asset.uri)) {
    throw new Error('GPXファイルを選択してください。');
  }

  const content = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (!hasGpxRootElement(content)) {
    throw new Error('GPXファイルを読み込めませんでした。');
  }

  return {
    fileName,
    content,
  };
}

/** ファイル名またはURIが `.gpx` 拡張子で終わるかを判定する。クエリ文字列・フラグメントも考慮する。 */
function isGpxFileName(value: string): boolean {
  return /\.gpx(?:$|[?#])/i.test(value);
}

/** XML 文字列に GPX ルート要素（名前空間プレフィックスあり/なし両対応）が含まれるかを判定する。 */
function hasGpxRootElement(content: string): boolean {
  return /<([A-Za-z_][\w.-]*:)?gpx(?:\s|>)/i.test(content);
}
