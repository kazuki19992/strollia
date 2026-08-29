import type { MapPhoto } from '@/features/photos/photoLibrary';
import { filterFallbackPhotosInBounds, selectLatestFallbackPhotos } from '@/features/photos/photoScanFallback';
import { PHOTO_VIEWPORT_SAFETY_LIMIT, type PhotoViewportBounds } from '@/features/photos/photoViewportBounds';

/**
 * テスト用のジオタグ付き写真を作る。
 *
 * @param id - アセットID。
 * @param overrides - 上書きするプロパティ。
 * @returns 地図表示用写真。
 */
function createPhoto(id: string, overrides: Partial<MapPhoto> = {}): MapPhoto {
  return { id, uri: null, storedUri: `ph://${id}`, latitude: 35, longitude: 139, creationTime: 1000, width: 10, height: 10, ...overrides };
}

/** テスト用の表示範囲(東京周辺)。 */
const bounds: PhotoViewportBounds = {
  minLatitude: 34,
  maxLatitude: 36,
  westLongitude: 138,
  eastLongitude: 140,
  crossesAntimeridian: false,
};

describe('走査結果フォールバックの絞り込み selectLatestFallbackPhotos', () => {
  it('撮影日時の降順へ並べ替える', () => {
    const older = createPhoto('older', { creationTime: 1000 });
    const newer = createPhoto('newer', { creationTime: 3000 });

    expect(selectLatestFallbackPhotos([older, newer], null).map((photo) => photo.id)).toEqual(['newer', 'older']);
  });

  it('表示上限まで新しい順に絞る', () => {
    const photos = [
      createPhoto('oldest', { creationTime: 1000 }),
      createPhoto('newest', { creationTime: 3000 }),
      createPhoto('middle', { creationTime: 2000 }),
    ];

    expect(selectLatestFallbackPhotos(photos, 2).map((photo) => photo.id)).toEqual(['newest', 'middle']);
  });

  it('上限なしの場合はすべて返す', () => {
    const photos = [createPhoto('photo-1'), createPhoto('photo-2')];

    expect(selectLatestFallbackPhotos(photos, null)).toHaveLength(2);
  });

  it('入力配列を破壊しない', () => {
    const photos = [createPhoto('older', { creationTime: 1000 }), createPhoto('newer', { creationTime: 3000 })];

    selectLatestFallbackPhotos(photos, null);

    expect(photos.map((photo) => photo.id)).toEqual(['older', 'newer']);
  });

  it('撮影日時を持たない(0へ倒れた)写真はDBのNULLと同じく末尾へ回す', () => {
    const unknown = createPhoto('unknown', { creationTime: 0 });
    const known = createPhoto('known', { creationTime: 1000 });

    expect(selectLatestFallbackPhotos([unknown, known], null).map((photo) => photo.id)).toEqual(['known', 'unknown']);
  });
});

describe('走査結果フォールバックの範囲絞り込み filterFallbackPhotosInBounds', () => {
  it('表示範囲の外にある写真を除外する', () => {
    const inside = createPhoto('inside', { latitude: 35, longitude: 139 });
    const outside = createPhoto('outside', { latitude: 10, longitude: 100 });

    expect(filterFallbackPhotosInBounds([inside, outside], bounds).map((photo) => photo.id)).toEqual(['inside']);
  });

  it('安全上限を超える件数はDB経路と同じく切り詰める', () => {
    const photos = Array.from({ length: PHOTO_VIEWPORT_SAFETY_LIMIT + 10 }, (_value, index) => createPhoto(`photo-${index}`));

    expect(filterFallbackPhotosInBounds(photos, bounds)).toHaveLength(PHOTO_VIEWPORT_SAFETY_LIMIT);
  });

  it('入力の並び順を保つ', () => {
    const first = createPhoto('first', { creationTime: 3000 });
    const second = createPhoto('second', { creationTime: 2000 });

    expect(filterFallbackPhotosInBounds([first, second], bounds).map((photo) => photo.id)).toEqual(['first', 'second']);
  });
});
