import { Text } from 'react-native';

import { lightTheme } from '../../../../theme/theme';
import { createStyles } from '../../../appStyles';
import { MonthlyReportScreen } from '../MonthlyReportScreen';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Feather: Text };
});

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

describe('月次レポート画面 MonthlyReportScreen', () => {
  let renderer: { unmount: () => void; root: any } | null = null;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    renderer = null;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('月間総移動距離ページを表示する', () => {
    act(() => {
      renderer = ReactTestRenderer.create(
        <MonthlyReportScreen
          dailyLogs={[{ localDate: '2026-05-01', pointCount: 2, startedAt: null, endedAt: null, distanceMeters: 1234 }]}
          points={[]}
          achievements={[]}
          styles={createStyles(lightTheme)}
          onBackToMap={jest.fn()}
        />,
      );
    });

    const texts = renderer!.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('今月の総移動距離');
    expect(texts).toContain('あなたは今月');
  });

  it('最後のページの次操作で地図へ戻る', () => {
    const onBackToMap = jest.fn();

    act(() => {
      renderer = ReactTestRenderer.create(
        <MonthlyReportScreen
          dailyLogs={[{ localDate: '2026-05-01', pointCount: 2, startedAt: null, endedAt: null, distanceMeters: 1234 }]}
          points={[]}
          achievements={[]}
          styles={createStyles(lightTheme)}
          onBackToMap={onBackToMap}
        />,
      );
    });

    const nextZone = () => renderer!.root.findAll((node: any) => node.props.accessibilityLabel === '次のレポートページ')[0];

    act(() => nextZone()?.props.onPress());
    act(() => nextZone()?.props.onPress());
    act(() => nextZone()?.props.onPress());

    expect(renderer!.root.findAllByType(Text).map((node: any) => node.props.children)).toContain('今月達成した実績');

    act(() => nextZone()?.props.onPress());

    expect(onBackToMap).toHaveBeenCalledTimes(1);
  });
});
