import { Text, View } from 'react-native';

import { ReportFrame } from '@/ui/components/reports/ReportFrame';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Feather: Text };
});

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

describe('レポート共通枠 ReportFrame', () => {
  it('現在ページまで進捗バーを塗りつぶす', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ReportFrame title="今月の移動距離" label="2026-04" pageCount={3} pageIndex={1} onShare={jest.fn()}>
          <Text>body</Text>
        </ReportFrame>,
      );
    });

    const widths = [0, 1, 2].map(
      (index) => renderer.root.findAll((node: any) => node.props.testID === `report-progress-fill-${index}`)[0].props.style[1].width,
    );
    expect(widths).toEqual(['100%', '100%', '0%']);
    expect(JSON.stringify(renderer.root.findAllByType(Text).map((node: any) => node.props.children))).toContain('レポート ');
  });

  it('共有ボタンを押すとonShareを呼ぶ', () => {
    const onShare = jest.fn();
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
        <ReportFrame title="今月の移動距離" label="2026-04" pageCount={1} pageIndex={0} onShare={onShare}>
          <View />
        </ReportFrame>,
      );
    });

    const shareButton = renderer.root.findAll((node: any) => node.props.accessibilityLabel === 'レポートを共有')[0];
    act(() => shareButton.props.onPress());

    expect(onShare).toHaveBeenCalledTimes(1);
  });
});
