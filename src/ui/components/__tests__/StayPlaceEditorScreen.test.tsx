import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import type { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';
import { lightTheme } from '@/theme/theme';
import { StayPlaceEditorScreen } from '@/ui/components/StayPlaceEditorScreen';

jest.mock('@expo/vector-icons', () => ({
  Feather: require('react-native').Text,
}));

jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: View, Marker: View };
});

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

describe('滞在場所編集 StayPlaceEditorScreen', () => {
  test('名称が空のまま保存しようとすると保存せず入力エラーを表示する', () => {
    const onSave = jest.fn();
    render(
      <StayPlaceEditorScreen
        initialCoordinate={{ latitude: 35, longitude: 139 }}
        place={null}
        styles={styles as never}
        theme={lightTheme}
        onBack={jest.fn()}
        onDelete={jest.fn()}
        onSave={onSave}
      />,
    );

    act(() => {
      fireEvent.press(screen.getByLabelText('滞在場所を保存'));
    });

    expect(screen.getByText('滞在場所名を入力してください')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });

  test('固定カタログから家アイコンを選び、入力した場所を保存する', () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(
      <StayPlaceEditorScreen
        initialCoordinate={{ latitude: 35, longitude: 139 }}
        place={null}
        styles={styles as never}
        theme={lightTheme}
        onBack={jest.fn()}
        onDelete={jest.fn()}
        onSave={onSave}
      />,
    );

    act(() => {
      fireEvent.changeText(screen.getByLabelText('滞在場所名'), '自宅');
      fireEvent.press(screen.getByLabelText('アイコンを選択'));
    });

    act(() => {
      fireEvent.press(screen.getByLabelText('家のアイコンを選択'));
      fireEvent.press(screen.getByLabelText('滞在場所を保存'));
    });

    expect(onSave).toHaveBeenCalledWith({
      name: '自宅',
      iconHexcode: '1F3E0',
      latitude: 35,
      longitude: 139,
      privacyRadiusMeters: null,
    });
  });

  test('既存の場所は削除確認後に削除コールバックを呼ぶ', () => {
    const onDelete = jest.fn().mockResolvedValue(undefined);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });
    render(
      <StayPlaceEditorScreen
        initialCoordinate={{ latitude: 35, longitude: 139 }}
        place={home}
        styles={styles as never}
        theme={lightTheme}
        onBack={jest.fn()}
        onDelete={onDelete}
        onSave={jest.fn()}
      />,
    );

    act(() => {
      fireEvent.press(screen.getByLabelText('滞在場所を削除'));
    });

    expect(onDelete).toHaveBeenCalledTimes(1);
    alertSpy.mockRestore();
  });
});
