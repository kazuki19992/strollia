import { useCallback, useEffect, useMemo, useState } from 'react';

import { initializeDatabase } from '@/db/database';
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
  /** 訪問済みスポット数。複数地点スポットは1地点でも到達していれば1と数える。 */
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

  /** 到達済み地点IDから到達日を引くMap。地点行の表示に使う。 */
  const [visitedLocalDateByAreaId, setVisitedLocalDateByAreaId] = useState<ReadonlyMap<string, string>>(() => new Map());

  /**
   * 1地点以上到達した複数地点スポットのID集合。パック進捗(訪問済みスポット数)の算出に使う。
   * コンプリート(全地点到達)でなくても訪問済みと数えるため、`visitedLocalDateBySpotId` とは別に持つ。
   */
  const [areaVisitedSpotIds, setAreaVisitedSpotIds] = useState<ReadonlySet<string>>(() => new Set());

  const reloadLandmarkState = useCallback(async (): Promise<void> => {
    // スポットと地点の到達は別テーブル。片方だけ新しい状態を見せないよう、両方読めてから反映する
    const [spotVisits, areaVisits] = await Promise.all([getLandmarkSpotVisits(), getLandmarkAreaVisits()]);

    setVisitedLocalDateBySpotId(new Map(spotVisits.map((visit) => [visit.spotId, visit.visitedLocalDate])));
    setVisitedLocalDateByAreaId(new Map(areaVisits.map((visit) => [visit.areaId, visit.visitedLocalDate])));
    setAreaVisitedSpotIds(new Set(areaVisits.map((visit) => visit.spotId)));
  }, []);

  useEffect(() => {
    // 初回はDB初期化(テーブル作成)の完了を待ってから読む。マウント直後は起動初期化と並走しており、
    // 新規インストール直後はテーブルがまだ無いため。initializeDatabase はプロセス内1回にメモ化済み。
    // 読み込みに失敗しても実績画面全体を落とさない。進捗0のまま一覧は表示できる
    initializeDatabase()
      .then(reloadLandmarkState)
      .catch((error: unknown) => {
        console.warn('Failed to load landmark visits:', error);
      });
  }, [reloadLandmarkState]);

  const landmarkPackItems = useMemo<LandmarkPackListItem[]>(() => {
    // 訪問済み = スポット到達(円1つ・コンプリート) ∪ 地点到達のあるスポット。複数地点スポットは1地点で数える
    const countedSpotIds = new Set([...visitedLocalDateBySpotId.keys(), ...areaVisitedSpotIds]);
    const progressByPackId = new Map(resolveLandmarkPackProgress(countedSpotIds).map((progress) => [progress.packId, progress]));
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
  }, [isPlusActive, visitedLocalDateBySpotId, areaVisitedSpotIds]);

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
