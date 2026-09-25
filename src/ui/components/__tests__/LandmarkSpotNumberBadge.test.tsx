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

  describe('variant="map"(埋め込み地図のマーカー向け)', () => {
    it('到達済みでもprimary色で塗りつぶし、白文字にする(地図タイル色に左右されないコントラスト確保)', () => {
      render(<LandmarkSpotNumberBadge number={1} isVisited styles={styles} theme={lightTheme} variant="map" />);

      const badgeText = screen.getByText('1');
      expect(StyleSheet.flatten(badgeText.props.style)).toMatchObject({ color: '#ffffff' });

      // Text host要素の親は同じ内容のText合成要素を挟むため、Viewコンテナはさらに1段上
      const container = badgeText.parent?.parent;
      expect(StyleSheet.flatten(container?.props.style)).toMatchObject({
        backgroundColor: lightTheme.colors.primary,
        borderColor: '#ffffff',
      });
    });

    it('未到達でも線囲みではなくmutedText色で塗りつぶす(list variantと異なり必ず塗りつぶす)', () => {
      render(<LandmarkSpotNumberBadge number={2} isVisited={false} styles={styles} theme={lightTheme} variant="map" />);

      const badgeText = screen.getByText('2');
      expect(StyleSheet.flatten(badgeText.props.style)).toMatchObject({ color: '#ffffff' });

      // Text host要素の親は同じ内容のText合成要素を挟むため、Viewコンテナはさらに1段上
      const container = badgeText.parent?.parent;
      expect(StyleSheet.flatten(container?.props.style)).toMatchObject({
        backgroundColor: lightTheme.colors.mutedText,
        borderColor: '#ffffff',
      });
    });
  });
});
