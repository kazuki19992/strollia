import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

const GPX_DOCUMENT_TYPES = ['application/gpx+xml', 'application/xml', 'text/xml'];
const ALLOWED_GPXML_MIME_TYPES = new Set(GPX_DOCUMENT_TYPES);

export type PickedGpxFile = {
  fileName: string;
  content: string;
};

/** ユーザーにGPXファイルを選んでもらい、内容をUTF-8文字列として読み込む。 */
export async function pickAndReadGpxFile(): Promise<PickedGpxFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: GPX_DOCUMENT_TYPES,
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

  if (asset.mimeType && !ALLOWED_GPXML_MIME_TYPES.has(asset.mimeType)) {
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

function isGpxFileName(value: string): boolean {
  return /\.gpx(?:$|[?#])/i.test(value);
}

function hasGpxRootElement(content: string): boolean {
  return /<([A-Za-z_][\w.-]*:)?gpx(?:\s|>)/i.test(content);
}
