import { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';

/** 作成日時、同時刻ならIDで滞在場所を安定して並べる。 */
function compareStayPlacesByCreation(a: StayPlace, b: StayPlace): number {
  const createdAtComparison = a.createdAt.localeCompare(b.createdAt);

  return createdAtComparison !== 0 ? createdAtComparison : a.id - b.id;
}

/**
 * 現在の契約状態で吸着・共有範囲に使える滞在場所を登録順で返す。
 *
 * 無料版・解約中でも保存済みの場所は削除せず、最初に登録した1件だけを
 * 有効にするため、入力配列は変更せずに並べ替えたコピーから導出する。
 */
export function resolveActiveStayPlaces(stayPlaces: StayPlace[], isPlusActive: boolean): StayPlace[] {
  const orderedStayPlaces = [...stayPlaces].sort(compareStayPlacesByCreation);

  return isPlusActive ? orderedStayPlaces : orderedStayPlaces.slice(0, 1);
}
