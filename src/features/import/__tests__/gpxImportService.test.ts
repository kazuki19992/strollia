import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { pickAndReadGpxFile } from '../gpxImportService';

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: jest.fn(),
  EncodingType: { UTF8: 'utf8' },
}));

describe('GPXファイル選択 gpxImportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('キャンセル時はnullを返す', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: [] });

    await expect(pickAndReadGpxFile()).resolves.toBeNull();
  });

  it('選択したGPXファイルをUTF-8文字列として読む', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://walk.gpx', name: 'walk.gpx' }],
    });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('<gpx />');

    await expect(pickAndReadGpxFile()).resolves.toEqual({ fileName: 'walk.gpx', content: '<gpx />' });
    expect(DocumentPicker.getDocumentAsync).toHaveBeenCalledWith({
      type: ['application/gpx+xml', 'application/xml', 'text/xml'],
      copyToCacheDirectory: true,
      multiple: false,
    });
  });

  it('ファイル名がない場合は既定のGPXファイル名を使う', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://walk.gpx' }],
    });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('<gpx />');

    await expect(pickAndReadGpxFile()).resolves.toEqual({ fileName: 'import.gpx', content: '<gpx />' });
  });

  it('GPXではないファイル名は読み込み前に拒否する', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://walk.txt', name: 'walk.txt', mimeType: 'text/plain' }],
    });

    await expect(pickAndReadGpxFile()).rejects.toThrow('GPXファイルを選択してください。');
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
  });

  it('gpxルートを含まないファイル内容は拒否する', async () => {
    (DocumentPicker.getDocumentAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://walk.gpx', name: 'walk.gpx', mimeType: 'application/gpx+xml' }],
    });
    (FileSystem.readAsStringAsync as jest.Mock).mockResolvedValue('<xml />');

    await expect(pickAndReadGpxFile()).rejects.toThrow('GPXファイルを読み込めませんでした。');
  });
});
