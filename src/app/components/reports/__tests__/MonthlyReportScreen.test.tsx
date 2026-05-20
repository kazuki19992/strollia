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
    jest.setSystemTime(new Date('2026-06-15T00:00:00.000Z'));
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

  it('スクロール型の月次レポートを表示する', () => {
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

    expect(texts).toContain('すとろりあ');
    expect(texts).toContain('SCROLL');
    expect(texts).toContain('移動距離');
    expect(texts).toContain('月間移動距離');
    expect(texts).toContain('移動マップ');
    expect(texts).toContain('月間取得した実績');
  });

  it('共有ボタンを常に表示する', () => {
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

    expect(renderer!.root.findAll((node: any) => node.props.accessibilityLabel === 'レポートを共有' && typeof node.props.onPress === 'function')).toHaveLength(1);
  });
});
