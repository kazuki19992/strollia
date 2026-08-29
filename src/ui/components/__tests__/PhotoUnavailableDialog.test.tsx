import { fireEvent, render, screen } from '@testing-library/react-native';

import { PHOTO_DELETED_DIALOG_MESSAGE, PHOTO_DELETED_DIALOG_TITLE, PHOTO_LIBRARY_RELOAD_LABEL } from '@/ui/appText';
import { Dialog } from '@/ui/components/Dialog';
import { PhotoUnavailableDialog } from '@/ui/components/PhotoUnavailableDialog';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: require('react-native').Text,
}));

const styles = new Proxy({}, { get: (_target, prop) => prop });

const baseProps = {
  visible: false,
  styles: styles as never,
  onClose: jest.fn(),
  onReloadPhotoLibrary: jest.fn(),
};

describe('削除済み写真の案内 PhotoUnavailableDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('削除済みでないときは表示しない', () => {
    render(<PhotoUnavailableDialog {...baseProps} visible={false} />);

    // Dialog の visible は RTL のセマンティッククエリでは検証できないため UNSAFE_getByType を使う
    expect(screen.UNSAFE_getByType(Dialog).props.visible).toBe(false);
  });

  test('削除済みの場合は削除済み写真として案内する', () => {
    render(<PhotoUnavailableDialog {...baseProps} visible />);

    expect(screen.getByText(PHOTO_DELETED_DIALOG_TITLE)).toBeTruthy();
    expect(screen.getByText(PHOTO_DELETED_DIALOG_MESSAGE)).toBeTruthy();
  });

  test('削除済みの場合はライブラリ再読み込みへ進める', () => {
    const onReloadPhotoLibrary = jest.fn();
    render(<PhotoUnavailableDialog {...baseProps} visible onReloadPhotoLibrary={onReloadPhotoLibrary} />);

    fireEvent.press(screen.getByLabelText(PHOTO_LIBRARY_RELOAD_LABEL));

    expect(onReloadPhotoLibrary).toHaveBeenCalledTimes(1);
  });

  test('閉じられるダイアログとして表示する', () => {
    render(<PhotoUnavailableDialog {...baseProps} visible />);

    expect(screen.UNSAFE_getByType(Dialog).props.dismissible).not.toBe(false);
  });
});
