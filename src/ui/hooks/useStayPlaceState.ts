import { useCallback, useEffect, useMemo, useState } from 'react';

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
export function useStayPlaceState(input: { isReady: boolean; isPlusActive: boolean; access?: StayPlaceAccess }): StayPlaceState {
  const { isReady, isPlusActive, access = repositoryAccess } = input;
  const [stayPlaces, setStayPlaces] = useState<StayPlace[]>([]);
  const [status, setStatus] = useState<StayPlacesStatus>('loading');

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
      setStatus('loading');
      try {
        await access.createStayPlace(newStayPlace);
        await reloadStayPlaces();
      } catch (error) {
        setStatus('error');
        throw error;
      }
    },
    [access, reloadStayPlaces],
  );
  const updateStayPlace = useCallback(
    async (id: number, updatedStayPlace: SaveStayPlaceInput): Promise<void> => {
      setStatus('loading');
      try {
        await access.updateStayPlace(id, updatedStayPlace);
        await reloadStayPlaces();
      } catch (error) {
        setStatus('error');
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
        setStatus('error');
        throw error;
      }
    },
    [access, reloadStayPlaces],
  );

  return { stayPlaces, activeStayPlaces, status, reloadStayPlaces, createStayPlace, updateStayPlace, deleteStayPlace };
}
