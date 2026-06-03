import { SafeAreaView, Text } from 'react-native';

import { createStyles } from '../../appStyles';
import { lightTheme } from '../../../theme/theme';
import { AchievementListScreen } from '../AchievementListScreen';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: () => null,
  Feather: require('react-native').Text,
}));

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

const styles = createStyles(lightTheme);

describe('実績画面 AchievementListScreen の画面共通UI', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('設定画面と同じ背景と共通ヘッダーで表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(<AchievementListScreen items={[]} styles={styles} theme={lightTheme} onBackToMap={jest.fn()} />);
    });

    const container = renderer.root.findByType(SafeAreaView);
    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    const backButton = renderer.root.findByProps({ accessibilityLabel: '地図へ戻る' });

    expect(container.props.style).toBe(styles.appScreen);
    expect(texts).toContain('実績');
    expect(backButton.props.style).toBe(styles.appHeaderBackButton);
  });
});
