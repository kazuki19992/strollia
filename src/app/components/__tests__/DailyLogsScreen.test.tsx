import { Text } from 'react-native';

import { lightTheme } from '../../../theme/theme';
jest.mock('../DailyLogCard', () => ({
  DailyLogCard: () => null,
}));

import { DailyLogsScreen } from '../DailyLogsScreen';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

const styles = {
  dailyContainer: {},
  dailyHeader: {},
  backButton: {},
  backButtonText: {},
  dailyTitle: {},
  headerSpacer: {},
  dailyEmptyCard: {},
  emptyTitle: {},
  emptyText: {},
  dailyList: {},
};

describe('日別ログ画面 DailyLogsScreen', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('日別ログがない場合は空状態を表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<DailyLogsScreen dailyLogs={[]} styles={styles as never} theme={lightTheme} onBackToMap={jest.fn()} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);

    expect(texts).toContain('日別ログはまだありません');
  });
});
