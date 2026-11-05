import { StyleSheet, Text } from 'react-native';
import { render, screen, within } from '@testing-library/react-native';

import { createStyles } from '@/ui/appStyles';
import { lightTheme } from '@/theme/theme';
import { TwoPaneLayout } from '@/ui/components/TwoPaneLayout';

describe('2段レイアウト TwoPaneLayout', () => {
  const styles = createStyles(lightTheme);

  test('左右のペインにそれぞれの内容を描画する', async () => {
    await render(<TwoPaneLayout primary={<Text>左</Text>} secondary={<Text>右</Text>} styles={styles} />);

    expect(within(screen.getByTestId('two-pane-primary')).getByText('左')).toBeTruthy();
    expect(within(screen.getByTestId('two-pane-secondary')).getByText('右')).toBeTruthy();
  });

  test('左右のペインは同じ幅(flex 1)で横に並ぶ', async () => {
    await render(<TwoPaneLayout primary={<Text>左</Text>} secondary={<Text>右</Text>} styles={styles} testID="two-pane-root" />);

    expect(StyleSheet.flatten(screen.getByTestId('two-pane-root').props.style).flexDirection).toBe('row');
    expect(StyleSheet.flatten(screen.getByTestId('two-pane-primary').props.style).flex).toBe(1);
    expect(StyleSheet.flatten(screen.getByTestId('two-pane-secondary').props.style).flex).toBe(1);
  });
});
