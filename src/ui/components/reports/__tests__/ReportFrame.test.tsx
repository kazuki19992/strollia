import { Text, View } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { ReportFrame } from '@/ui/components/reports/ReportFrame';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Feather: Text };
});

describe('レポート共通枠 ReportFrame', () => {
  it('現在ページまで進捗バーを塗りつぶす', () => {
    render(
      <ReportFrame title="今月の移動距離" label="2026-04" pageCount={3} pageIndex={1} onShare={jest.fn()}>
        <Text>body</Text>
      </ReportFrame>,
    );

    // UNSAFE_getAllByProps を使うのは testID という非セマンティックな props で要素を検索するため
    const widths = [0, 1, 2].map(
      (index) => screen.UNSAFE_getAllByProps({ testID: `report-progress-fill-${index}` })[0].props.style[1].width,
    );
    expect(widths).toEqual(['100%', '100%', '0%']);
    // UNSAFE_getAllByType を使うのはすべての Text の children を JSON化して検証するため
    expect(JSON.stringify(screen.UNSAFE_getAllByType(Text).map((node) => node.props.children))).toContain('レポート ');
  });

  it('共有ボタンを押すとonShareを呼ぶ', () => {
    const onShare = jest.fn();
    render(
      <ReportFrame title="今月の移動距離" label="2026-04" pageCount={1} pageIndex={0} onShare={onShare}>
        <View />
      </ReportFrame>,
    );

    fireEvent.press(screen.getByLabelText('レポートを共有'));

    expect(onShare).toHaveBeenCalledTimes(1);
  });
});
