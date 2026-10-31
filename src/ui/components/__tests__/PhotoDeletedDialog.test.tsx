import { fireEvent, render, screen } from '@testing-library/react-native';

import { PHOTO_DELETED_DIALOG_MESSAGE, PHOTO_DELETED_DIALOG_TITLE, PHOTO_LIBRARY_RELOAD_LABEL } from '@/ui/appText';
import { PhotoDeletedDialog } from '@/ui/components/PhotoDeletedDialog';

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

describe('削除済み写真の案内 PhotoDeletedDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('削除済みでないときは表示しない', async () => {
    await render(<PhotoDeletedDialog {...baseProps} visible={false} />);

    // 非表示の Dialog(Modal)は中身を描画しないため、案内文言が存在しないことで検証する
    expect(screen.queryByText(PHOTO_DELETED_DIALOG_TITLE)).toBeNull();
    expect(screen.queryByText(PHOTO_DELETED_DIALOG_MESSAGE)).toBeNull();
  });

  test('削除済みの場合は削除済み写真として案内する', async () => {
    await render(<PhotoDeletedDialog {...baseProps} visible />);

    expect(screen.getByText(PHOTO_DELETED_DIALOG_TITLE)).toBeTruthy();
    expect(screen.getByText(PHOTO_DELETED_DIALOG_MESSAGE)).toBeTruthy();
  });

  test('削除済みの場合はライブラリ再読み込みへ進める', async () => {
    const onReloadPhotoLibrary = jest.fn();
    await render(<PhotoDeletedDialog {...baseProps} visible onReloadPhotoLibrary={onReloadPhotoLibrary} />);

    await fireEvent.press(screen.getByLabelText(PHOTO_LIBRARY_RELOAD_LABEL));

    expect(onReloadPhotoLibrary).toHaveBeenCalledTimes(1);
  });

  test('閉じられるダイアログとして表示する', async () => {
    await render(<PhotoDeletedDialog {...baseProps} visible />);

    // dismissible な Dialog だけが「閉じる」ボタンを描画する
    expect(screen.getByLabelText('閉じる')).toBeTruthy();
  });
});
