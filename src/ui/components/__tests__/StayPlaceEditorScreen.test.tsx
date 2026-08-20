import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import type { StayPlace } from '@/features/stayPlaces/stayPlaceTypes';
import { lightTheme } from '@/theme/theme';
import { StayPlaceEditorScreen } from '@/ui/components/StayPlaceEditorScreen';

jest.mock('@expo/vector-icons', () => ({
  Feather: require('react-native').Text,
  MaterialCommunityIcons: require('react-native').Text,
}));

jest.mock('react-native-maps', () => {
  const { View } = require('react-native');
  return { __esModule: true, Circle: View, default: View, Marker: View };
});

// 画面単体テストではRootLayoutを描画しないため、実機のセーフエリア値を固定する。
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 59, right: 0, bottom: 34, left: 0 }),
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

  test('ドロップダウンのTwemojiアイコンを選び、hexcodeを保存する', async () => {
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
      expect(screen.getByLabelText('家のTwemojiアイコン')).toBeTruthy();
      fireEvent.press(screen.getByLabelText('アイコンを選択'));
    });

    act(() => {
      fireEvent.press(screen.getByLabelText('仕事場'));
    });
    await act(async () => {});
    fireEvent.press(screen.getByLabelText('滞在場所を保存'));

    expect(onSave).toHaveBeenCalledWith({
      name: '自宅',
      iconHexcode: '1F3E2',
      latitude: 35,
      longitude: 139,
      privacyRadiusMeters: null,
    });
  });

  test('保存中は連続タップしても保存処理を1回だけ呼ぶ', async () => {
    let resolveSave: (() => void) | undefined;
    const onSave = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveSave = resolve;
        }),
    );
    render(
      <StayPlaceEditorScreen
        initialCoordinate={{ latitude: 35, longitude: 139 }}
        place={null}
        styles={styles as never}
        theme={lightTheme}
        onBack={jest.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.changeText(screen.getByLabelText('滞在場所名'), '自宅');
    const saveButton = screen.getByLabelText('滞在場所を保存');
    fireEvent.press(saveButton);
    fireEvent.press(saveButton);

    expect(onSave).toHaveBeenCalledTimes(1);
    await act(async () => resolveSave?.());
  });

  test('ドロップダウンから共有時の非表示範囲を選ぶと地図の範囲円と保存値へ反映する', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(
      <StayPlaceEditorScreen
        initialCoordinate={{ latitude: 35, longitude: 139 }}
        place={null}
        styles={styles as never}
        theme={lightTheme}
        onBack={jest.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.changeText(screen.getByLabelText('滞在場所名'), '自宅');
    expect(screen.getByLabelText('共有時の非表示範囲を選択')).toHaveTextContent('共有画像に含める');
    expect(screen.queryByTestId('stay-place-privacy-circle')).toBeNull();
    fireEvent.press(screen.getByLabelText('共有時の非表示範囲を選択'));
    fireEvent.press(screen.getByLabelText('1km'));
    expect(screen.getByTestId('stay-place-privacy-circle')).toBeTruthy();
    expect(screen.getByText('この円内のルートは共有画像・GIF・月次レポートでは隠れます。通常の地図やGPXには影響しません。')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('滞在場所を保存'));
    await act(async () => {});

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ privacyRadiusMeters: 1000 }));
  });

  test('非表示範囲が未設定なら共有画像に場所を含めることを説明する', () => {
    render(
      <StayPlaceEditorScreen
        initialCoordinate={{ latitude: 35, longitude: 139 }}
        place={null}
        styles={styles as never}
        theme={lightTheme}
        onBack={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    expect(screen.getByText('非表示範囲を設定すると、この場所の周辺を共有するルートから隠します。')).toBeTruthy();
  });

  test('地図の固定中心マーカーを表示し、地図操作完了後の中心座標だけを保存する', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(
      <StayPlaceEditorScreen
        initialCoordinate={{ latitude: 35, longitude: 139 }}
        place={null}
        styles={styles as never}
        theme={lightTheme}
        onBack={jest.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.changeText(screen.getByLabelText('滞在場所名'), '自宅');
    expect(screen.getByTestId('stay-place-map-center-marker')).toBeTruthy();

    const map = screen.getByLabelText('滞在場所の中心を選ぶ地図');
    fireEvent(map, 'onRegionChange', { latitude: 35.1, longitude: 139.1, latitudeDelta: 0.005, longitudeDelta: 0.005 });
    fireEvent.press(screen.getByLabelText('滞在場所を保存'));
    await act(async () => {});

    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ latitude: 35, longitude: 139 }));

    fireEvent(map, 'onRegionChangeComplete', {
      latitude: 35.2,
      longitude: 139.2,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    });
    fireEvent.press(screen.getByLabelText('滞在場所を保存'));

    expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ latitude: 35.2, longitude: 139.2 }));
  });

  test('許可リスト外の共有時非表示範囲は保存せず入力エラーを表示する', () => {
    const onSave = jest.fn();
    render(
      <StayPlaceEditorScreen
        initialCoordinate={{ latitude: 35, longitude: 139 }}
        place={{ ...home, privacyRadiusMeters: 999 }}
        styles={styles as never}
        theme={lightTheme}
        onBack={jest.fn()}
        onDelete={jest.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.press(screen.getByLabelText('滞在場所を保存'));

    expect(screen.getByText('入力内容を確認してください')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
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
