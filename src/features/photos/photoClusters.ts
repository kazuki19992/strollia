import { Region } from 'react-native-maps';

import { MapPhoto } from './photoLibrary';

/** 地図上で近接写真をまとめた表示単位。 */
export type MapPhotoCluster = {
  /** クラスタを安定して描画するためのID。 */
  id: string;
  /** クラスタ内写真の代表緯度。 */
  latitude: number;
  /** クラスタ内写真の代表経度。 */
  longitude: number;
  /** この吹き出しに含まれる写真。新しい写真が先頭に来る。 */
  photos: MapPhoto[];
};

const FALLBACK_LATITUDE_DELTA = 0.01;
const FALLBACK_LONGITUDE_DELTA = 0.01;
const LATITUDE_GRID_DIVISIONS = 18;
const LONGITUDE_GRID_DIVISIONS = 10;

/**
 * 表示範囲に応じて、画面上で重なりやすい写真をグリッド単位にまとめる。
 *
 * @param photos - 地図上に表示するジオタグ付き写真一覧。
 * @param region - 現在の地図表示範囲。未取得の場合は近距離用の既定値を使う。
 * @returns 近接写真をまとめたクラスタ一覧。
 */
export function clusterMapPhotos(photos: MapPhoto[], region: Region | null): MapPhotoCluster[] {
  const latitudeCellSize = Math.max(Math.abs(region?.latitudeDelta ?? FALLBACK_LATITUDE_DELTA) / LATITUDE_GRID_DIVISIONS, 0.00001);
  const longitudeCellSize = Math.max(
    Math.abs(region?.longitudeDelta ?? FALLBACK_LONGITUDE_DELTA) / LONGITUDE_GRID_DIVISIONS,
    0.00001,
  );
  const clustersByCell = new Map<string, MapPhoto[]>();

  for (const photo of photos) {
    const latitudeCell = Math.floor(photo.latitude / latitudeCellSize);
    const longitudeCell = Math.floor(photo.longitude / longitudeCellSize);
    const key = `${latitudeCell}:${longitudeCell}`;
    const clusterPhotos = clustersByCell.get(key) ?? [];
    clusterPhotos.push(photo);
    clustersByCell.set(key, clusterPhotos);
  }

  return [...clustersByCell.entries()].map(([cellKey, clusterPhotos]) => {
    const photosByNewest = [...clusterPhotos].sort((a, b) => b.creationTime - a.creationTime);
    const representative = photosByNewest[0];

    return {
      id: `${cellKey}:${photosByNewest.map((photo) => photo.id).join('-')}`,
      latitude: average(photosByNewest.map((photo) => photo.latitude)),
      longitude: average(photosByNewest.map((photo) => photo.longitude)),
      photos: representative ? photosByNewest : [],
    };
  });
}

/**
 * 数値配列の平均値を返す。
 *
 * @param values - 平均したい数値配列。
 * @returns 数値がない場合は0、ある場合は平均値。
 */
function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
