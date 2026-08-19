import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useStayPlaceState, type StayPlaceAccess } from '@/ui/hooks/useStayPlaceState';
import type { SaveStayPlaceInput, StayPlace } from '@/features/stayPlaces/stayPlaceTypes';

jest.mock('@/features/stayPlaces/stayPlaceRepository', () => ({
  getStayPlaces: jest.fn(),
  createStayPlace: jest.fn(),
  updateStayPlace: jest.fn(),
  deleteStayPlace: jest.fn(),
}));

const home: StayPlace = {
  id: 1,
  name: '自宅',
  iconHexcode: '1F3E0',
  latitude: 35,
  longitude: 139,
  privacyRadiusMeters: 100,
  createdAt: '2026-08-19T00:00:00.000Z',
  updatedAt: '2026-08-19T00:00:00.000Z',
};

const office: StayPlace = {
  ...home,
  id: 2,
  name: '職場',
  latitude: 35.01,
  createdAt: '2026-08-20T00:00:00.000Z',
};

const newOffice: SaveStayPlaceInput = {
  name: '職場',
  iconHexcode: '1F3E2',
  latitude: 35.01,
  longitude: 139,
  privacyRadiusMeters: 100,
};

function createAccess(overrides: Partial<StayPlaceAccess> = {}): StayPlaceAccess {
  return {
    getStayPlaces: jest.fn().mockResolvedValue([]),
    createStayPlace: jest.fn().mockResolvedValue(2),
    updateStayPlace: jest.fn().mockResolvedValue(undefined),
    deleteStayPlace: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('滞在場所状態 useStayPlaceState', () => {
  it('読込完了前は有効な滞在場所をnullにして共有をfail-closedにする', () => {
    const access = createAccess();
    const { result } = renderHook(() => useStayPlaceState({ isReady: false, isPlusActive: true, access }));

    expect(result.current.status).toBe('loading');
    expect(result.current.activeStayPlaces).toBeNull();
    expect(access.getStayPlaces).not.toHaveBeenCalled();
  });

  it('読込に失敗した場合は有効な滞在場所をnullのままerror状態にする', async () => {
    const access = createAccess({ getStayPlaces: jest.fn().mockRejectedValue(new Error('読み込み失敗')) });
    const { result } = renderHook(() => useStayPlaceState({ isReady: true, isPlusActive: true, access }));

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    expect(result.current.activeStayPlaces).toBeNull();
  });

  it('作成後に再読込して同一セッションの有効な滞在場所を更新する', async () => {
    const access = createAccess({
      getStayPlaces: jest.fn().mockResolvedValueOnce([home]).mockResolvedValueOnce([home, office]),
    });
    const { result } = renderHook(() => useStayPlaceState({ isReady: true, isPlusActive: true, access }));

    await waitFor(() => {
      expect(result.current.activeStayPlaces).toEqual([home]);
    });

    await act(async () => {
      await result.current.createStayPlace(newOffice);
    });

    expect(access.createStayPlace).toHaveBeenCalledWith(newOffice);
    expect(result.current.status).toBe('ready');
    expect(result.current.activeStayPlaces).toEqual([home, office]);
  });

  it('編集後に再読込して同一セッションの有効な滞在場所を更新する', async () => {
    const updatedHome = { ...home, name: '新しい自宅' };
    const access = createAccess({
      getStayPlaces: jest.fn().mockResolvedValueOnce([home]).mockResolvedValueOnce([updatedHome]),
    });
    const { result } = renderHook(() => useStayPlaceState({ isReady: true, isPlusActive: true, access }));

    await waitFor(() => {
      expect(result.current.activeStayPlaces).toEqual([home]);
    });

    await act(async () => {
      await result.current.updateStayPlace(home.id, newOffice);
    });

    expect(access.updateStayPlace).toHaveBeenCalledWith(home.id, newOffice);
    expect(result.current.activeStayPlaces).toEqual([updatedHome]);
  });

  it('削除後に再読込して同一セッションの有効な滞在場所を更新する', async () => {
    const access = createAccess({
      getStayPlaces: jest.fn().mockResolvedValueOnce([home, office]).mockResolvedValueOnce([home]),
    });
    const { result } = renderHook(() => useStayPlaceState({ isReady: true, isPlusActive: true, access }));

    await waitFor(() => {
      expect(result.current.activeStayPlaces).toEqual([home, office]);
    });

    await act(async () => {
      await result.current.deleteStayPlace(office.id);
    });

    expect(access.deleteStayPlace).toHaveBeenCalledWith(office.id);
    expect(result.current.activeStayPlaces).toEqual([home]);
  });
});
