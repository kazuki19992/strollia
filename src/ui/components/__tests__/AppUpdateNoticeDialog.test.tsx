import { fireEvent, render, screen } from '@testing-library/react-native';

import type { AppUpdateNotice } from '@/features/app-update/updateNotices';
import { AppUpdateNoticeDialog } from '@/ui/components/AppUpdateNoticeDialog';

const mockUseWindowDimensions = jest.fn();

/** Dialog へ渡された props を記録するモック。RNTL v14 で型検索が廃止されたため、props 契約はこの記録から検証する。 */
const mockDialogProps = jest.fn();

jest.mock('@/ui/components/Dialog', () => {
  const actual = jest.requireActual('@/ui/components/Dialog');
  const { createElement } = jest.requireActual('react');
  return {
    ...actual,
    // 実際の Dialog を描画したまま、渡された props だけを記録する
    Dialog: (props: { visible: boolean }) => {
      mockDialogProps(props);
      return createElement(actual.Dialog, props);
    },
  };
});

/** 直近の描画で Dialog へ渡された props を返す。 */
const getLastDialogProps = () => mockDialogProps.mock.calls[mockDialogProps.mock.calls.length - 1][0];

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
  items: ['新機能を追加'],
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

  test('自動表示ではスワイプで閉じられ、ストアページ導線を表示しない', async () => {
    await render(<AppUpdateNoticeDialog {...baseProps} />);

    // Dialog の設定値は利用者がスワイプで閉じられる契約を検証するために直接確認する。
    const dialogProps = getLastDialogProps();
    expect(dialogProps.visible).toBe(true);
    expect(dialogProps.swipeToClose).toBe(true);
    expect(dialogProps.autoClose).toBe(false);
    expect(screen.container.queryAll((node) => node.type === 'RCTScrollView')).toHaveLength(0);
    expect(screen.queryByLabelText('ストアページへ')).toBeNull();
  });

  test('看板をモーダル内の利用可能な幅と高さへcontain表示する', async () => {
    mockUseWindowDimensions.mockReturnValue({ width: 390, height: 320, scale: 3, fontScale: 1 });
    await render(<AppUpdateNoticeDialog {...baseProps} />);

    const contentStyle = screen.getByTestId('app-update-notice-dialog-content').props.style;
    const signStyle = screen.getByTestId('app-update-notice-sign-canvas-container').props.style;
    expect(contentStyle[0]).toBe('appUpdateNoticeDialogContent');
    expect(contentStyle[1].maxHeight).toBeCloseTo(200);
    expect(signStyle.alignSelf).toBe('center');
    expect(signStyle.height).toBeCloseTo(178);
    expect(signStyle.width).toBeCloseTo((178 * 329) / 261);
  });

  test('設定起点ではストアボタンの領域を除いた高さへ看板を縮小する', async () => {
    mockUseWindowDimensions.mockReturnValue({ width: 390, height: 320, scale: 3, fontScale: 1 });
    await render(<AppUpdateNoticeDialog {...baseProps} source="settings" />);

    expect(screen.getByTestId('app-update-notice-sign-canvas-container').props.style.height).toBeCloseTo(126);
  });

  test('設定画面から開くとストアページへのボタンを押せる', async () => {
    const onOpenStorePage = jest.fn();
    await render(<AppUpdateNoticeDialog {...baseProps} source="settings" onOpenStorePage={onOpenStorePage} />);

    await fireEvent.press(screen.getByLabelText('ストアページへ'));

    expect(onOpenStorePage).toHaveBeenCalledTimes(1);
  });

  test('通知定義がないときはDialogを非表示にする', async () => {
    await render(<AppUpdateNoticeDialog {...baseProps} notice={null} />);

    // Dialog の visible は Modal の内部アニメーションを介さずに非表示条件を検証するために確認する。
    expect(getLastDialogProps().visible).toBe(false);
  });

  test('visible=falseのときはDialogを非表示にする', async () => {
    await render(<AppUpdateNoticeDialog {...baseProps} visible={false} />);

    expect(getLastDialogProps().visible).toBe(false);
  });
});
