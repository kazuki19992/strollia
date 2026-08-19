import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable as MockPressable, Text as MockText, View as MockView } from 'react-native';

import EditStayPlaceRoute from '@/app/settings/stay-places/[id]';
import NewStayPlaceRoute from '@/app/settings/stay-places/new';
import StayPlacesRoute from '@/app/settings/stay-places';
import type { StayPlacesStatus } from '@/features/stayPlaces/stayPlaceAccess';
import type { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockState = {
  styles: {},
  theme: { name: 'light', colors: {} },
  stayPlaces: [] as StayPlace[],
  stayPlacesStatus: 'ready' as StayPlacesStatus,
  userCoordinate: null,
  premiumAccessState: { isPlusActive: false },
  openPremiumPaywall: jest.fn(),
  createStayPlace: jest.fn().mockResolvedValue(undefined),
  updateStayPlace: jest.fn().mockResolvedValue(undefined),
  deleteStayPlace: jest.fn().mockResolvedValue(undefined),
};

jest.mock('expo-router', () => ({
  Redirect: () => null,
  useLocalSearchParams: () => ({ id: '1' }),
  useRouter: () => ({ back: mockBack, push: mockPush }),
}));

let latestEditorProps: Record<string, unknown> | null = null;

jest.mock('@/ui/components/StayPlaceEditorScreen', () => {
  return {
    StayPlaceEditorScreen: (props: Record<string, unknown>) => {
      latestEditorProps = props;
      return <MockView testID="stay-place-editor" />;
    },
  };
});

jest.mock('@/ui/state/AppStateProvider', () => ({
  useAppState: () => mockState,
}));

jest.mock('@/ui/components/StayPlacesScreen', () => {
  return {
    StayPlacesScreen: (props: { onOpenNew: () => void }) => (
      <MockPressable accessibilityLabel="滞在場所を追加" onPress={props.onOpenNew}>
        <MockText>追加</MockText>
      </MockPressable>
    ),
  };
});

describe('滞在場所設定ルート', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    latestEditorProps = null;
    mockState.stayPlaces = [];
    mockState.stayPlacesStatus = 'ready';
  });

  test('一覧から新規作成画面へ遷移する', () => {
    render(<StayPlacesRoute />);

    fireEvent.press(screen.getByLabelText('滞在場所を追加'));

    expect(mockPush).toHaveBeenCalledWith('/settings/stay-places/new');
  });

  test('新規作成画面はProviderのcreateStayPlace完了後に一覧へ戻る', async () => {
    render(<NewStayPlaceRoute />);

    await (latestEditorProps?.onSave as (input: Record<string, unknown>) => Promise<void>)({
      name: '自宅',
      iconHexcode: '1F3E0',
      latitude: 35,
      longitude: 139,
      privacyRadiusMeters: null,
    });

    expect(mockState.createStayPlace).toHaveBeenCalledWith({
      name: '自宅',
      iconHexcode: '1F3E0',
      latitude: 35,
      longitude: 139,
      privacyRadiusMeters: null,
    });
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  test('無料版の読込中に直接新規作成へ到達しても保存せずPlus購入導線を開く', async () => {
    mockState.stayPlacesStatus = 'loading';
    render(<NewStayPlaceRoute />);

    await (latestEditorProps?.onSave as (input: Record<string, unknown>) => Promise<void>)({
      name: '自宅',
      iconHexcode: '1F3E0',
      latitude: 35,
      longitude: 139,
      privacyRadiusMeters: null,
    });

    expect(mockState.createStayPlace).not.toHaveBeenCalled();
    expect(mockState.openPremiumPaywall).toHaveBeenCalledTimes(1);
    expect(mockBack).not.toHaveBeenCalled();
  });

  test('編集画面はProviderの更新・削除操作を呼び、各完了後に一覧へ戻る', async () => {
    mockState.stayPlaces = [
      {
        id: 1,
        name: '自宅',
        iconHexcode: '1F3E0',
        latitude: 35,
        longitude: 139,
        privacyRadiusMeters: 100,
        createdAt: '2026-08-19T00:00:00.000Z',
        updatedAt: '2026-08-19T00:00:00.000Z',
      },
    ];
    render(<EditStayPlaceRoute />);

    await (latestEditorProps?.onSave as (input: Record<string, unknown>) => Promise<void>)({
      name: '新しい自宅',
      iconHexcode: '1F3E0',
      latitude: 35,
      longitude: 139,
      privacyRadiusMeters: 100,
    });
    await (latestEditorProps?.onDelete as () => Promise<void>)();

    expect(mockState.updateStayPlace).toHaveBeenCalledWith(1, expect.objectContaining({ name: '新しい自宅' }));
    expect(mockState.deleteStayPlace).toHaveBeenCalledWith(1);
    expect(mockBack).toHaveBeenCalledTimes(2);
  });
});
