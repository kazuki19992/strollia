import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

export type PickedGpxFile = {
  fileName: string;
  content: string;
};

/** ユーザーにGPXファイルを選んでもらい、内容をUTF-8文字列として読み込む。 */
export async function pickAndReadGpxFile(): Promise<PickedGpxFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/gpx+xml', 'application/octet-stream', 'text/xml', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  const content = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return {
    fileName: asset.name ?? 'import.gpx',
    content,
  };
}
