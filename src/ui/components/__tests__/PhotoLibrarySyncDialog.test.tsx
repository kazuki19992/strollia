import { render, screen } from '@testing-library/react-native';

import { lightTheme } from '@/theme/theme';
import { formatPhotoLibrarySyncProgress, PHOTO_LIBRARY_SYNC_DIALOG_DESCRIPTION, PHOTO_LIBRARY_SYNC_DIALOG_TITLE } from '@/ui/appText';
import { DeterminateProgressBar } from '@/ui/components/DeterminateProgressBar';
import { Dialog } from '@/ui/components/Dialog';
import { IndeterminateProgressBar } from '@/ui/components/IndeterminateProgressBar';
import { PhotoLibrarySyncDialog } from '@/ui/components/PhotoLibrarySyncDialog';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: require('react-native').Text,
}));

const styles = new Proxy({}, { get: (_target, prop) => prop });

const baseProps = {
  visible: true,
  progress: null,
  styles: styles as never,
};

describe('写真ライブラリ再読み込みダイアログ PhotoLibrarySyncDialog', () => {
  test('実行中は閉じる手段を持たないブロッキングダイアログとして表示する', () => {
    render(<PhotoLibrarySyncDialog {...baseProps} />);

    // 走査中に地図を操作されると競合で1.6倍遅くなるため、操作させないことで結果的に早く終わらせる
    // Dialog の props は RTL のセマンティッククエリでは検証できないため UNSAFE_getByType を使う
    const dialog = screen.UNSAFE_getByType(Dialog);
    expect(dialog.props.visible).toBe(true);
    expect(dialog.props.dismissible).toBe(false);
    expect(dialog.props.swipeToClose).toBe(false);
  });

  test('実行中であることを説明する', () => {
    render(<PhotoLibrarySyncDialog {...baseProps} />);

    expect(screen.getByText(PHOTO_LIBRARY_SYNC_DIALOG_TITLE)).toBeTruthy();
    expect(screen.getByText(PHOTO_LIBRARY_SYNC_DIALOG_DESCRIPTION)).toBeTruthy();
  });

  test('総数が分かるまでは不定形の進捗表示にする', () => {
    render(<PhotoLibrarySyncDialog {...baseProps} progress={null} />);

    expect(screen.UNSAFE_queryByType(IndeterminateProgressBar)).not.toBeNull();
    expect(screen.UNSAFE_queryByType(DeterminateProgressBar)).toBeNull();
  });

  test('総数が分かったら「N件中M件」と進捗バーを表示する', () => {
    render(<PhotoLibrarySyncDialog {...baseProps} progress={{ totalAssetCount: 1000, processedAssetCount: 250 }} />);

    expect(screen.getByText('1000件中250件')).toBeTruthy();
    expect(screen.UNSAFE_queryByType(DeterminateProgressBar)).not.toBeNull();
    expect(screen.UNSAFE_queryByType(IndeterminateProgressBar)).toBeNull();
  });

  test('visible=false のとき Dialog を非表示にする', () => {
    render(<PhotoLibrarySyncDialog {...baseProps} visible={false} />);

    const dialog = screen.UNSAFE_getByType(Dialog);
    expect(dialog.props.visible).toBe(false);
  });
});

describe('走査進捗の文言 formatPhotoLibrarySyncProgress', () => {
  test('総数と処理済み件数を「N件中M件」で表す', () => {
    expect(formatPhotoLibrarySyncProgress({ totalAssetCount: 18218, processedAssetCount: 1204 })).toBe('18218件中1204件');
  });
});

describe('確定進捗バー DeterminateProgressBar', () => {
  test('進捗割合を塗りの幅として表す', () => {
    render(<DeterminateProgressBar styles={styles as never} progress={0.25} />);

    expect(screen.getByTestId('determinate-progress-fill').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: '25%' })]),
    );
  });

  test('0〜1の範囲外の進捗は丸めて扱う', () => {
    render(<DeterminateProgressBar styles={styles as never} progress={1.8} />);

    expect(screen.getByTestId('determinate-progress-fill').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: '100%' })]),
    );
  });

  test('進捗が数値として壊れている場合は0%として扱う', () => {
    render(<DeterminateProgressBar styles={styles as never} progress={Number.NaN} />);

    expect(screen.getByTestId('determinate-progress-fill').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: '0%' })]),
    );
  });
});
