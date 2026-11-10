import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  LANDMARK_PACKS,
  type LandmarkArea,
  type LandmarkPack,
  type LandmarkSpot,
  getAllSpotsForPack,
  getLandmarkPackById,
} from '@/features/landmarks/landmarkCatalog';
import { resolveLandmarkPackProgress } from '@/features/landmarks/landmarkPackProgress';
import { getLandmarkAreaVisits, getLandmarkSpotVisits } from '@/features/landmarks/landmarkVisitRepository';

/** 実績画面のスポットセクションに表示するパック行。 */
export type LandmarkPackListItem = {
  /** パック定義。 */
  pack: LandmarkPack;
  /** 到達済みスポット数。 */
  visitedCount: number;
  /** 完走に必要なスポット数(retiredを除く)。 */
  totalCount: number;
  /** Plus未加入で施錠されているか。 */
  isLocked: boolean;
};

/** 複数地点スポットの1地点ぶんの行。 */
export type LandmarkAreaListItem = {
  /** 地点定義。 */
  area: LandmarkArea;
  /** 到達した日のローカル日付(YYYY-MM-DD)。未到達はnull。 */
  visitedLocalDate: string | null;
};

/** パック詳細画面に表示するスポット行。 */
export type LandmarkSpotListItem = {
  /** スポット定義。 */
  spot: LandmarkSpot;
  /** 到達した日のローカル日付(YYYY-MM-DD)。未到達はnull。 */
  visitedLocalDate: string | null;
  /** 複数地点スポットだけ地点ごとの行(マスタ順)。円1つのスポットは空配列。 */
  areaItems: LandmarkAreaListItem[];
};

/** パック詳細画面へ渡す1パックぶんの表示データ。 */
export type LandmarkPackDetail = {
  /** パック定義。 */
  pack: LandmarkPack;
  /** パックに属する有効なスポット(order昇順)。 */
  spotItems: LandmarkSpotListItem[];
};

/** `useLandmarkPackState` が返す状態と操作。 */
export type UseLandmarkPackStateResult = {
  /** 実績画面のスポットセクションに並べるパック行。 */
  landmarkPackItems: LandmarkPackListItem[];
  /** パックIDから詳細画面用のデータを取得する。未知のIDはnull。 */
  getLandmarkPackDetail: (packId: string) => LandmarkPackDetail | null;
  /** 到達記録をDBから読み直す。到達検知や実績評価のあとに呼ぶ。 */
  reloadLandmarkState: () => Promise<void>;
};

/**
 * スポットパックの到達状況を読み込み、実績画面と詳細画面向けの表示データへ組み立てるフック。
 *
 * マスタ(`LANDMARK_PACKS`)を起点に数えるため、マスタから消えたスポットの到達記録が
 * DBに残っていても分子が分母を超えない。
 *
 * @param isPlusActive - Strollia Plusが有効かどうか。無料パック(`pack.isFree`)は常に施錠しない。
 *   有料パックは無効時のみ施錠状態・進捗なしで返す
 *   (`docs/superpowers/specs/2026-09-27-stamp-rally-free-paid-packs-design.md` §6.1)。
 */
export function useLandmarkPackState(isPlusActive: boolean): UseLandmarkPackStateResult {
  /** 到達済みスポットIDから到達日を引くMap。詳細画面の日別記録遷移にも使う。 */
  const [visitedLocalDateBySpotId, setVisitedLocalDateBySpotId] = useState<ReadonlyMap<string, string>>(() => new Map());

  /** 到達済み地点IDから到達日を引くMap。パック進捗(スポット単位)には使わず、地点行の表示にだけ使う。 */
  const [visitedLocalDateByAreaId, setVisitedLocalDateByAreaId] = useState<ReadonlyMap<string, string>>(() => new Map());

  const reloadLandmarkState = useCallback(async (): Promise<void> => {
    // スポットと地点の到達は別テーブル。片方だけ新しい状態を見せないよう、両方読めてから反映する
    const [spotVisits, areaVisits] = await Promise.all([getLandmarkSpotVisits(), getLandmarkAreaVisits()]);

    setVisitedLocalDateBySpotId(new Map(spotVisits.map((visit) => [visit.spotId, visit.visitedLocalDate])));
    setVisitedLocalDateByAreaId(new Map(areaVisits.map((visit) => [visit.areaId, visit.visitedLocalDate])));
  }, []);

  useEffect(() => {
    // 読み込みに失敗しても実績画面全体を落とさない。進捗0のまま一覧は表示できる
    reloadLandmarkState().catch((error: unknown) => {
      console.warn('Failed to load landmark spot visits:', error);
    });
  }, [reloadLandmarkState]);

  const landmarkPackItems = useMemo<LandmarkPackListItem[]>(() => {
    const progressByPackId = new Map(
      resolveLandmarkPackProgress(new Set(visitedLocalDateBySpotId.keys())).map((progress) => [progress.packId, progress]),
    );
    return LANDMARK_PACKS.map((pack) => {
      const progress = progressByPackId.get(pack.id);
      const isLocked = !pack.isFree && !isPlusActive;

      return {
        pack,
        visitedCount: isLocked ? 0 : (progress?.visitedCount ?? 0),
        totalCount: progress?.totalCount ?? 0,
        isLocked,
      };
    });
  }, [isPlusActive, visitedLocalDateBySpotId]);

  const getLandmarkPackDetail = useCallback(
    (packId: string): LandmarkPackDetail | null => {
      const pack = getLandmarkPackById(packId);

      if (!pack) {
        return null;
      }

      return {
        pack,
        // retired なスポットも「現存せず」として表示するため含める。
        // 完走判定の分母から外すのは画面側(LandmarkPackScreen)の役目。
        spotItems: getAllSpotsForPack(packId).map((spot) => ({
          spot,
          visitedLocalDate: visitedLocalDateBySpotId.get(spot.id) ?? null,
          // 円1つのスポットは地点行を出さない(スポット行がそのまま地点を表す)
          areaItems: spot.isMultiArea
            ? spot.areas.map((area) => ({ area, visitedLocalDate: visitedLocalDateByAreaId.get(area.id) ?? null }))
            : [],
        })),
      };
    },
    [visitedLocalDateBySpotId, visitedLocalDateByAreaId],
  );

  return { landmarkPackItems, getLandmarkPackDetail, reloadLandmarkState };
}
