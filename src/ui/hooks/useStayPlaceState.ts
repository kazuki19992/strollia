import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { resolveActiveStayPlaces, type StayPlacesStatus } from '@/features/stayPlaces/stayPlaceAccess';
import {
  createStayPlace as createStayPlaceInRepository,
  deleteStayPlace as deleteStayPlaceInRepository,
  getStayPlaces as getStayPlacesInRepository,
  updateStayPlace as updateStayPlaceInRepository,
} from '@/features/stayPlaces/stayPlaceRepository';
import type { SaveStayPlaceInput, StayPlace } from '@/features/stayPlaces/stayPlaceTypes';

/** 滞在場所の永続化を差し替える最小境界。hook単体テストでSQLiteを使わないために注入する。 */
export type StayPlaceAccess = {
  getStayPlaces: () => Promise<StayPlace[]>;
  createStayPlace: (input: SaveStayPlaceInput) => Promise<number>;
  updateStayPlace: (id: number, input: SaveStayPlaceInput) => Promise<void>;
  deleteStayPlace: (id: number) => Promise<void>;
};

const repositoryAccess: StayPlaceAccess = {
  getStayPlaces: getStayPlacesInRepository,
  createStayPlace: createStayPlaceInRepository,
  updateStayPlace: updateStayPlaceInRepository,
  deleteStayPlace: deleteStayPlaceInRepository,
};

/** AppStateProviderが公開する、現在の滞在場所と共有可否に必要な操作群。 */
export type StayPlaceState = {
  stayPlaces: StayPlace[];
  /** 読込完了前・失敗時はnull。共有側は生ルートへフォールバックしてはいけない。 */
  activeStayPlaces: StayPlace[] | null;
  status: StayPlacesStatus;
  reloadStayPlaces: () => Promise<void>;
  createStayPlace: (input: SaveStayPlaceInput) => Promise<void>;
  updateStayPlace: (id: number, input: SaveStayPlaceInput) => Promise<void>;
  deleteStayPlace: (id: number) => Promise<void>;
};

/**
 * 滞在場所を読み込み、契約状態に応じた有効リストを管理する。
 *
 * 設定の読込・再読込中は共有をfail-closedにするため、activeStayPlacesをnullにする。
 */
export function useStayPlaceState(input: {
  isReady: boolean;
  isPlusActive: boolean;
  access?: StayPlaceAccess;
  /** 無料版の2件目追加時に既存のPlus購入導線を開く。 */
  onFreeStayPlaceLimitReached?: () => void;
}): StayPlaceState {
  const { isReady, isPlusActive, access = repositoryAccess, onFreeStayPlaceLimitReached } = input;
  const [stayPlaces, setStayPlaces] = useState<StayPlace[]>([]);
  const [status, setStatus] = useState<StayPlacesStatus>('loading');
  /** 無料版の同時作成で2件目をすり抜けないよう、作成判定と永続化を直列化する。 */
  const freeCreationQueueRef = useRef<Promise<void>>(Promise.resolve());

  const reloadStayPlaces = useCallback(async (): Promise<void> => {
    if (!isReady) {
      setStatus('loading');
      return;
    }

    setStatus('loading');
    try {
      const places = await access.getStayPlaces();
      setStayPlaces(places);
      setStatus('ready');
    } catch {
      setStayPlaces([]);
      setStatus('error');
    }
  }, [access, isReady]);

  useEffect(() => {
    reloadStayPlaces().catch(() => undefined);
  }, [reloadStayPlaces]);

  const activeStayPlaces = useMemo(
    () => (status === 'ready' ? resolveActiveStayPlaces(stayPlaces, isPlusActive) : null),
    [isPlusActive, status, stayPlaces],
  );

  const createStayPlace = useCallback(
    async (newStayPlace: SaveStayPlaceInput): Promise<void> => {
      if (!isPlusActive && (status !== 'ready' || stayPlaces.length >= 1)) {
        onFreeStayPlaceLimitReached?.();
        return;
      }

      const persist = async (): Promise<void> => {
        // 直列化後にDBを読み直す。呼び出し時のReact stateだけでは、同時タップや別画面の
        // 保存による無料版の2件目作成を判定できない。
        if (!isPlusActive && (await access.getStayPlaces()).length >= 1) {
          onFreeStayPlaceLimitReached?.();
          await reloadStayPlaces();
          return;
        }

        setStatus('loading');
        try {
          await access.createStayPlace(newStayPlace);
          await reloadStayPlaces();
        } catch (error) {
          // 保存に失敗しても、共有・記録で使うリストをDBの実状態に戻す。
          await reloadStayPlaces();
          throw error;
        }
      };

      if (isPlusActive) {
        await persist();
        return;
      }

      const queued = freeCreationQueueRef.current.catch(() => undefined).then(persist);
      freeCreationQueueRef.current = queued;
      await queued;
    },
    [access, isPlusActive, onFreeStayPlaceLimitReached, reloadStayPlaces, status, stayPlaces.length],
  );
  const updateStayPlace = useCallback(
    async (id: number, updatedStayPlace: SaveStayPlaceInput): Promise<void> => {
      setStatus('loading');
      try {
        await access.updateStayPlace(id, updatedStayPlace);
        await reloadStayPlaces();
      } catch (error) {
        // 保存失敗時にも、古い共有対象をDBから再読込して表示と実体を一致させる。
        await reloadStayPlaces();
        throw error;
      }
    },
    [access, reloadStayPlaces],
  );
  const deleteStayPlace = useCallback(
    async (id: number): Promise<void> => {
      setStatus('loading');
      try {
        await access.deleteStayPlace(id);
        await reloadStayPlaces();
      } catch (error) {
        // 削除失敗時も同様に再読込し、成功していない見かけの変更を残さない。
        await reloadStayPlaces();
        throw error;
      }
    },
    [access, reloadStayPlaces],
  );

  return { stayPlaces, activeStayPlaces, status, reloadStayPlaces, createStayPlace, updateStayPlace, deleteStayPlace };
}
