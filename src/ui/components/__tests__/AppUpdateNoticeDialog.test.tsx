import { fireEvent, render, screen } from '@testing-library/react-native';
import { ScrollView } from 'react-native';

import type { AppUpdateNotice } from '@/features/app-update/updateNotices';
import { AppUpdateNoticeDialog } from '@/ui/components/AppUpdateNoticeDialog';
import { Dialog } from '@/ui/components/Dialog';

const mockUseWindowDimensions = jest.fn();

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: mockUseWindowDimensions,
}));

jest.mock('@expo/vector-icons', () => ({
  // Jest のモックファクトリはモジュール外の変数を参照できないため、既存のテストと同じ遅延requireを使う。
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Jestのモック巻き上げ制約を満たすため
  MaterialCommunityIcons: require('react-native').Text,
}));

/** コンポーネントが参照するスタイルキーを文字列として返すテスト用スタイル。 */
const styles = new Proxy({}, { get: (_target, property) => property }) as never;

/** 更新通知ダイアログの表示内容を検証するための有効な通知定義。 */
const featureNotice: AppUpdateNotice = {
  version: '1.2.0',
  kind: 'feature',
  heading: '新機能を\n追加しました',
  sectionTitle: '主な新機能',
  items: ['新機能を追加'],
  showMore: false,
};

const baseProps = {
  visible: true,
  source: 'automatic' as const,
  notice: featureNotice,
  styles,
  onClose: jest.fn(),
  onOpenStorePage: jest.fn(),
};

describe('AppUpdateNoticeDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWindowDimensions.mockReturnValue({ width: 390, height: 800, scale: 3, fontScale: 1 });
  });

  test('自動表示ではスワイプで閉じられ、ストアページ導線を表示しない', () => {
    render(<AppUpdateNoticeDialog {...baseProps} />);

    // Dialog の設定値は利用者がスワイプで閉じられる契約を検証するために直接確認する。
    const dialog = screen.UNSAFE_getByType(Dialog);
    expect(dialog.props.visible).toBe(true);
    expect(dialog.props.swipeToClose).toBe(true);
    expect(dialog.props.autoClose).toBe(false);
    expect(screen.UNSAFE_queryAllByType(ScrollView)).toHaveLength(0);
    expect(screen.queryByLabelText('ストアページへ')).toBeNull();
  });

  test('看板をモーダル内の利用可能な幅と高さへcontain表示する', () => {
    mockUseWindowDimensions.mockReturnValue({ width: 390, height: 320, scale: 3, fontScale: 1 });
    render(<AppUpdateNoticeDialog {...baseProps} />);

    const contentStyle = screen.getByTestId('app-update-notice-dialog-content').props.style;
    const signStyle = screen.getByTestId('app-update-notice-sign-canvas-container').props.style;
    expect(contentStyle[0]).toBe('appUpdateNoticeDialogContent');
    expect(contentStyle[1].maxHeight).toBeCloseTo(200);
    expect(signStyle.alignSelf).toBe('center');
    expect(signStyle.height).toBeCloseTo(178);
    expect(signStyle.width).toBeCloseTo((178 * 329) / 261);
  });

  test('設定起点ではストアボタンの領域を除いた高さへ看板を縮小する', () => {
    mockUseWindowDimensions.mockReturnValue({ width: 390, height: 320, scale: 3, fontScale: 1 });
    render(<AppUpdateNoticeDialog {...baseProps} source="settings" />);

    expect(screen.getByTestId('app-update-notice-sign-canvas-container').props.style.height).toBeCloseTo(126);
  });

  test('設定画面から開くとストアページへのボタンを押せる', () => {
    const onOpenStorePage = jest.fn();
    render(<AppUpdateNoticeDialog {...baseProps} source="settings" onOpenStorePage={onOpenStorePage} />);

    fireEvent.press(screen.getByLabelText('ストアページへ'));

    expect(onOpenStorePage).toHaveBeenCalledTimes(1);
  });

  test('通知定義がないときはDialogを非表示にする', () => {
    render(<AppUpdateNoticeDialog {...baseProps} notice={null} />);

    // Dialog の visible は Modal の内部アニメーションを介さずに非表示条件を検証するために確認する。
    expect(screen.UNSAFE_getByType(Dialog).props.visible).toBe(false);
  });

  test('visible=falseのときはDialogを非表示にする', () => {
    render(<AppUpdateNoticeDialog {...baseProps} visible={false} />);

    expect(screen.UNSAFE_getByType(Dialog).props.visible).toBe(false);
  });
});
