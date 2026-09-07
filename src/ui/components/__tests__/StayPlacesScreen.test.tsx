import { act, fireEvent, render, screen } from '@testing-library/react-native';

import type { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';
import { lightTheme } from '@/theme/theme';
import { StayPlacesScreen } from '@/ui/components/StayPlacesScreen';

jest.mock('@expo/vector-icons', () => ({
  Feather: require('react-native').Text,
  MaterialCommunityIcons: require('react-native').Text,
}));

const styles = new Proxy({}, { get: () => ({}) });

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

const office: StayPlace = { ...home, id: 2, name: '職場', createdAt: '2026-08-20T00:00:00.000Z' };

describe('滞在場所一覧 StayPlacesScreen', () => {
  test('無料版では最初の場所を現在有効、後の場所をPlusで有効として表示する', () => {
    render(
      <StayPlacesScreen
        isPlusActive={false}
        stayPlaces={[home, office]}
        styles={styles as never}
        theme={lightTheme}
        onBackToSettings={jest.fn()}
        onOpenEditor={jest.fn()}
        onOpenNew={jest.fn()}
        onOpenPremiumPaywall={jest.fn()}
      />,
    );

    expect(screen.getByText('現在有効')).toBeTruthy();
    expect(screen.getByText('Plusで有効')).toBeTruthy();
  });

  test('無料版で登録済みの場合は追加操作から既存のPlus購入導線を開く', () => {
    const onOpenPremiumPaywall = jest.fn();
    render(
      <StayPlacesScreen
        isPlusActive={false}
        stayPlaces={[home]}
        styles={styles as never}
        theme={lightTheme}
        onBackToSettings={jest.fn()}
        onOpenEditor={jest.fn()}
        onOpenNew={jest.fn()}
        onOpenPremiumPaywall={onOpenPremiumPaywall}
      />,
    );

    act(() => {
      fireEvent.press(screen.getByLabelText('滞在場所を追加'));
    });

    expect(onOpenPremiumPaywall).toHaveBeenCalledTimes(1);
  });

  test('場所の行を押すと対象の編集画面を開く', () => {
    const onOpenEditor = jest.fn();
    render(
      <StayPlacesScreen
        isPlusActive
        stayPlaces={[home]}
        styles={styles as never}
        theme={lightTheme}
        onBackToSettings={jest.fn()}
        onOpenEditor={onOpenEditor}
        onOpenNew={jest.fn()}
        onOpenPremiumPaywall={jest.fn()}
      />,
    );

    act(() => {
      fireEvent.press(screen.getByLabelText('自宅を編集'));
    });

    expect(onOpenEditor).toHaveBeenCalledWith(home.id);
  });
});
