import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { lightTheme } from '@/theme/theme';
import { createStyles } from '@/ui/appStyles';
import { LandmarkSpotNumberBadge } from '@/ui/components/LandmarkSpotNumberBadge';

const styles = createStyles(lightTheme);

describe('スポット番号バッジ LandmarkSpotNumberBadge', () => {
  it('指定した番号をそのまま表示する', () => {
    render(<LandmarkSpotNumberBadge number={3} isVisited={false} styles={styles} theme={lightTheme} />);

    expect(screen.getByText('3')).toBeTruthy();
  });

  it('到達済みの場合は塗りつぶし円+primaryText色の文字にする', () => {
    render(<LandmarkSpotNumberBadge number={1} isVisited styles={styles} theme={lightTheme} />);

    const badgeText = screen.getByText('1');
    expect(StyleSheet.flatten(badgeText.props.style)).toMatchObject({
      color: lightTheme.colors.primaryText,
    });
  });

  it('未到達の場合は線囲み円+mutedText色の文字にする', () => {
    render(<LandmarkSpotNumberBadge number={2} isVisited={false} styles={styles} theme={lightTheme} />);

    const badgeText = screen.getByText('2');
    expect(StyleSheet.flatten(badgeText.props.style)).toMatchObject({
      color: lightTheme.colors.mutedText,
    });
  });
});
