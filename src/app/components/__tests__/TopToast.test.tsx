import { Text } from 'react-native';

import { lightTheme } from '@/theme/theme';
import { TopToast } from '@/app/components/TopToast';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

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
    let renderer: any;
    act(() => {
      renderer = ReactTestRenderer.create(<TopToast {...baseProps} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toContain('アプリが起動している場合のみ記録します！');
  });

  test('visible=false のときは要素を一切描画しない(描画されると非表示時もトーストが残り誤表示になる)', () => {
    let renderer: any;
    act(() => {
      renderer = ReactTestRenderer.create(<TopToast {...baseProps} visible={false} />);
    });

    const texts = renderer.root.findAllByType(Text);
    expect(texts).toHaveLength(0);
  });

  test('durationMs(4000ms)経過でちょうど1回onHideを呼ぶ(呼ばないとトーストが閉じず残り続ける)', () => {
    const onHide = jest.fn();
    act(() => {
      ReactTestRenderer.create(<TopToast {...baseProps} durationMs={4000} onHide={onHide} />);
    });

    expect(onHide).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect(onHide).toHaveBeenCalledTimes(1);
  });
});
