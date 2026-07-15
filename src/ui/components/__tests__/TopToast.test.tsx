import { render, screen, act } from '@testing-library/react-native';

import { lightTheme } from '@/theme/theme';
import { TopToast } from '@/ui/components/TopToast';

const baseProps = {
  visible: true,
  message: 'アプリが起動している場合のみ記録します！',
  theme: lightTheme,
  durationMs: 4000,
  onHide: jest.fn(),
};

describe('TopToast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('visible=true のとき指定メッセージを表示する(出ないと起動中のみ記録モードをユーザーへ通知できない)', () => {
    render(<TopToast {...baseProps} />);

    expect(screen.getByText('アプリが起動している場合のみ記録します！')).toBeTruthy();
  });

  test('visible=false のときは要素を一切描画しない(描画されると非表示時もトーストが残り誤表示になる)', () => {
    render(<TopToast {...baseProps} visible={false} />);

    // UNSAFE_getAllByType を使うのは Text 要素が0件であることを確認するため
    // セマンティッククエリでは「要素が存在しない」ことを表現しにくいため
    const { Text } = require('react-native');
    const textNodes = screen.UNSAFE_queryAllByType(Text);
    expect(textNodes).toHaveLength(0);
  });

  test('durationMs(4000ms)経過でちょうど1回onHideを呼ぶ(呼ばないとトーストが閉じず残り続ける)', () => {
    const onHide = jest.fn();
    render(<TopToast {...baseProps} durationMs={4000} onHide={onHide} />);

    expect(onHide).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect(onHide).toHaveBeenCalledTimes(1);
  });
});
