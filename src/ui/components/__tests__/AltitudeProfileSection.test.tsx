import { render, screen } from '@testing-library/react-native';

import { darkTheme, lightTheme } from '@/theme/theme';
import type { LocationPoint } from '@/types/gps';
import { AltitudeProfileSection } from '@/ui/components/AltitudeProfileSection';

const styles = new Proxy({}, { get: (_target, prop) => prop });

/** 指定したローカル時刻と高度を持つテスト用GPSポイントを作る。 */
function point(id: number, hour: number, minute: number, altitude: number | null): LocationPoint {
  return {
    id,
    recordedAt: new Date(2026, 8, 21, hour, minute).toISOString(),
    localDate: '2026-09-21',
    latitude: 35,
    longitude: 139,
    altitude,
    speed: null,
    heading: null,
    accuracy: 5,
    altitudeAccuracy: null,
  };
}

describe('高度プロファイルセクション', () => {
  test('最低・最高高度と開始・中間・終了時刻を表示する', () => {
    render(
      <AltitudeProfileSection
        points={[point(1, 9, 0, 10), point(2, 9, 30, 10), point(3, 10, 0, 20), point(4, 10, 30, 30), point(5, 11, 0, 30)]}
        styles={styles as never}
        theme={lightTheme}
        showUnavailableMessage
      />,
    );

    expect(screen.getByText('高度')).toBeTruthy();
    expect(screen.getByText('30m')).toBeTruthy();
    expect(screen.getByText('10m')).toBeTruthy();
    expect(screen.getByText('9:00')).toBeTruthy();
    expect(screen.getByText('10:00')).toBeTruthy();
    expect(screen.getByText('11:00')).toBeTruthy();
    expect(screen.getByLabelText('最低高度10メートル、最高高度30メートル')).toBeTruthy();
  });

  test('データ不足は画面で説明し共有用ではセクションを表示しない', () => {
    const { rerender } = render(
      <AltitudeProfileSection points={[point(1, 9, 0, null)]} styles={styles as never} theme={lightTheme} showUnavailableMessage />,
    );

    expect(screen.getByText('高度')).toBeTruthy();
    expect(screen.getByText('高度データを表示できません')).toBeTruthy();

    rerender(
      <AltitudeProfileSection points={[point(1, 9, 0, null)]} styles={styles as never} theme={lightTheme} showUnavailableMessage={false} />,
    );

    expect(screen.queryByText('高度')).toBeNull();
    expect(screen.queryByText('高度データを表示できません')).toBeNull();
  });

  test('高度差が10m未満なら現在テーマのprimary単色で描く', () => {
    const { rerender } = render(
      <AltitudeProfileSection
        points={[point(1, 9, 0, 10), point(2, 9, 15, 10), point(3, 9, 30, 14), point(4, 9, 45, 19), point(5, 10, 0, 19)]}
        styles={styles as never}
        theme={lightTheme}
        showUnavailableMessage
      />,
    );

    expect(screen.UNSAFE_getAllByProps({ stroke: lightTheme.colors.primary }).length).toBeGreaterThan(0);

    rerender(
      <AltitudeProfileSection
        points={[point(1, 9, 0, 10), point(2, 9, 15, 10), point(3, 9, 30, 14), point(4, 9, 45, 19), point(5, 10, 0, 19)]}
        styles={styles as never}
        theme={darkTheme}
        showUnavailableMessage
      />,
    );

    expect(screen.UNSAFE_getAllByProps({ stroke: darkTheme.colors.primary }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('最低高度10メートル、最高高度19メートル')).toBeTruthy();
  });

  test('欠測区間を別々の折れ線パスとして描く', () => {
    render(
      <AltitudeProfileSection
        points={[point(1, 9, 0, 10), point(2, 9, 10, 12), point(3, 9, 20, null), point(4, 9, 30, 20), point(5, 9, 40, 22)]}
        styles={styles as never}
        theme={lightTheme}
        showUnavailableMessage
      />,
    );

    const paths = screen.UNSAFE_getAllByProps({ fill: 'none' }).filter((node) => typeof node.props.d === 'string');
    expect(paths).toHaveLength(2);
  });
});
