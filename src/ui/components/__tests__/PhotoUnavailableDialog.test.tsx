import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  PHOTO_DELETED_DIALOG_MESSAGE,
  PHOTO_DELETED_DIALOG_TITLE,
  PHOTO_LIBRARY_RELOAD_LABEL,
  PHOTO_UNAVAILABLE_DIALOG_MESSAGE,
  PHOTO_UNAVAILABLE_DIALOG_TITLE,
} from '@/ui/appText';
import { Dialog } from '@/ui/components/Dialog';
import { PhotoUnavailableDialog } from '@/ui/components/PhotoUnavailableDialog';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: require('react-native').Text,
}));

const styles = new Proxy({}, { get: (_target, prop) => prop });

const baseProps = {
  reason: null,
  styles: styles as never,
  onClose: jest.fn(),
  onReloadPhotoLibrary: jest.fn(),
};

describe('写真を表示できないときの案内 PhotoUnavailableDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('理由が無いときは表示しない', () => {
    render(<PhotoUnavailableDialog {...baseProps} reason={null} />);

    // Dialog の visible は RTL のセマンティッククエリでは検証できないため UNSAFE_getByType を使う
    expect(screen.UNSAFE_getByType(Dialog).props.visible).toBe(false);
  });

  test('削除済みの場合は削除済み写真として案内する', () => {
    render(<PhotoUnavailableDialog {...baseProps} reason="deleted" />);

    expect(screen.getByText(PHOTO_DELETED_DIALOG_TITLE)).toBeTruthy();
    expect(screen.getByText(PHOTO_DELETED_DIALOG_MESSAGE)).toBeTruthy();
  });

  test('削除済みの場合はライブラリ再読み込みへ進める', () => {
    const onReloadPhotoLibrary = jest.fn();
    render(<PhotoUnavailableDialog {...baseProps} reason="deleted" onReloadPhotoLibrary={onReloadPhotoLibrary} />);

    fireEvent.press(screen.getByLabelText(PHOTO_LIBRARY_RELOAD_LABEL));

    expect(onReloadPhotoLibrary).toHaveBeenCalledTimes(1);
  });

  test('取得不可の場合は端末に本体が無いことを案内する', () => {
    render(<PhotoUnavailableDialog {...baseProps} reason="unavailable" />);

    expect(screen.getByText(PHOTO_UNAVAILABLE_DIALOG_TITLE)).toBeTruthy();
    expect(screen.getByText(PHOTO_UNAVAILABLE_DIALOG_MESSAGE)).toBeTruthy();
  });

  test('取得不可の場合は再読み込みボタンを置かない', () => {
    render(<PhotoUnavailableDialog {...baseProps} reason="unavailable" />);

    // 再読み込みでは解決しないため、押しても無駄な導線を出さない(設計書 §4.5)
    expect(screen.queryByLabelText(PHOTO_LIBRARY_RELOAD_LABEL)).toBeNull();
  });

  test('閉じられるダイアログとして表示する', () => {
    render(<PhotoUnavailableDialog {...baseProps} reason="unavailable" />);

    expect(screen.UNSAFE_getByType(Dialog).props.dismissible).not.toBe(false);
  });
});
