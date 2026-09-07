import { getPhotoPreviewAsync } from '@modules/photo-thumbnail';

import {
  clearPhotoPreviewUriCache,
  PHOTO_PREVIEW_FALLBACK_SIZE,
  PHOTO_PREVIEW_SIZE,
  resolvePhotoPreviewPixelSize,
  resolvePhotoPreviewUri,
} from '@/features/photos/photoPreviewUri';

// ネイティブモジュールは jest では解決できないため、公開APIごとモックする。
jest.mock('@modules/photo-thumbnail', () => ({
  getPhotoPreviewAsync: jest.fn(),
}));

describe('拡大表示用サイズ resolvePhotoPreviewPixelSize', () => {
  it('画面の長辺をピクセル数へ換算して返す', () => {
    // iPhone 15 Pro Max 相当(430×932pt, 3倍密度)。全画面表示に必要なのは長辺ぶんのピクセル数。
    expect(resolvePhotoPreviewPixelSize(430, 932, 3)).toBe(2796);
  });

  it('横向きで幅と高さが入れ替わっても同じ値になる(向きで再取得しないため)', () => {
    expect(resolvePhotoPreviewPixelSize(932, 430, 3)).toBe(resolvePhotoPreviewPixelSize(430, 932, 3));
  });

  it('画面サイズを取得できない場合はフォールバック値を使う', () => {
    expect(resolvePhotoPreviewPixelSize(0, 0, 3)).toBe(PHOTO_PREVIEW_FALLBACK_SIZE);
    expect(resolvePhotoPreviewPixelSize(Number.NaN, 932, 3)).toBe(PHOTO_PREVIEW_FALLBACK_SIZE);
    expect(resolvePhotoPreviewPixelSize(430, 932, 0)).toBe(PHOTO_PREVIEW_FALLBACK_SIZE);
  });

  it('サムネイル用サイズより明確に大きい(拡大表示が粗くならない)', () => {
    expect(PHOTO_PREVIEW_SIZE).toBeGreaterThan(512);
  });
});

describe('拡大表示用URIの解決 resolvePhotoPreviewUri', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearPhotoPreviewUriCache();
  });

  it('拡大表示用サイズでネイティブへ問い合わせ、返ったパスを返す', async () => {
    (getPhotoPreviewAsync as jest.Mock).mockResolvedValue('file:///caches/asset-1-preview.jpg');

    await expect(resolvePhotoPreviewUri('asset-1')).resolves.toBe('file:///caches/asset-1-preview.jpg');
    expect(getPhotoPreviewAsync).toHaveBeenCalledWith('asset-1', PHOTO_PREVIEW_SIZE);
  });

  it('取得できない場合(オフライン・Android・モジュール未解決)は例外を投げずnullを返す', async () => {
    (getPhotoPreviewAsync as jest.Mock).mockResolvedValue(null);

    await expect(resolvePhotoPreviewUri('asset-1')).resolves.toBeNull();
  });

  it('同じ写真を再度開いてもネイティブ問い合わせは1回で済む', async () => {
    (getPhotoPreviewAsync as jest.Mock).mockResolvedValue('file:///caches/asset-1-preview.jpg');

    await resolvePhotoPreviewUri('asset-1');
    await resolvePhotoPreviewUri('asset-1');

    expect(getPhotoPreviewAsync).toHaveBeenCalledTimes(1);
  });

  it('取得できなかった結果はキャッシュせず、次に開いたときに再試行する', async () => {
    (getPhotoPreviewAsync as jest.Mock).mockResolvedValue(null);
    await expect(resolvePhotoPreviewUri('asset-1')).resolves.toBeNull();

    (getPhotoPreviewAsync as jest.Mock).mockResolvedValue('file:///caches/asset-1-preview.jpg');

    await expect(resolvePhotoPreviewUri('asset-1')).resolves.toBe('file:///caches/asset-1-preview.jpg');
    expect(getPhotoPreviewAsync).toHaveBeenCalledTimes(2);
  });

  it('キャッシュを消すと再びネイティブへ問い合わせる', async () => {
    (getPhotoPreviewAsync as jest.Mock).mockResolvedValue('file:///caches/asset-1-preview.jpg');

    await resolvePhotoPreviewUri('asset-1');
    clearPhotoPreviewUriCache();
    await resolvePhotoPreviewUri('asset-1');

    expect(getPhotoPreviewAsync).toHaveBeenCalledTimes(2);
  });
});
