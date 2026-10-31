import { Text, View } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { ReportFrame } from '@/ui/components/reports/ReportFrame';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Feather: Text };
});

describe('レポート共通枠 ReportFrame', () => {
  it('現在ページまで進捗バーを塗りつぶす', async () => {
    await render(
      <ReportFrame title="今月の移動距離" label="2026-04" pageCount={3} pageIndex={1} onShare={jest.fn()}>
        <Text>body</Text>
      </ReportFrame>,
    );

    const widths = [0, 1, 2].map((index) => screen.getByTestId(`report-progress-fill-${index}`).props.style[1].width);
    expect(widths).toEqual(['100%', '100%', '0%']);
    // すべての Text の children を JSON化して検証するため、container からホスト Text 要素を検索する
    expect(JSON.stringify(screen.container.queryAll((node) => node.type === 'Text').map((node) => node.props.children))).toContain(
      'レポート ',
    );
  });

  it('共有ボタンを押すとonShareを呼ぶ', async () => {
    const onShare = jest.fn();
    await render(
      <ReportFrame title="今月の移動距離" label="2026-04" pageCount={1} pageIndex={0} onShare={onShare}>
        <View />
      </ReportFrame>,
    );

    await fireEvent.press(screen.getByLabelText('レポートを共有'));

    expect(onShare).toHaveBeenCalledTimes(1);
  });
});
