import { render, screen } from '@testing-library/react-native';

import { lightTheme } from '@/theme/theme';
import { NUMERIC_DISPLAY_FONT } from '@/theme/fonts';
import { createStyles } from '@/ui/appStyles';
import { Dialog } from '@/ui/components/Dialog';
import { GpxImportProgressDialog } from '@/ui/components/GpxImportProgressDialog';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: require('react-native').Text,
}));

const styles = new Proxy({}, { get: (_target, prop) => prop });

const baseProps = {
  visible: true,
  styles: styles as never,
  theme: lightTheme,
  odometerDistanceMeters: 123_450,
  stage: 'saving' as const,
};

describe('GpxImportProgressDialog', () => {
  test('visible=true のとき閉じられないダイアログとして表示する', () => {
    render(<GpxImportProgressDialog {...baseProps} />);

    // Dialog コンポーネントの props を直接検証するために UNSAFE_getByType を使う
    // RTL のセマンティッククエリでは Modal/Dialog の props 検証が困難なため
    const dialog = screen.UNSAFE_getByType(Dialog);
    expect(dialog.props.visible).toBe(true);
    expect(dialog.props.dismissible).toBe(false);
    expect(dialog.props.swipeToClose).toBe(false);
  });

  test('処理段階に応じたメッセージを表示する', () => {
    render(<GpxImportProgressDialog {...baseProps} />);

    expect(screen.getByText('GPXを保存しています…')).toBeTruthy();
  });

  test('プログレスバーの下に中央揃えのODOをDSEG数値で表示する', () => {
    render(<GpxImportProgressDialog {...baseProps} />);
    const actualStyles = createStyles(lightTheme);

    expect(screen.getByText('ODO')).toBeTruthy();
    expect(actualStyles.gpxImportOdometerInteger).toMatchObject({ fontFamily: NUMERIC_DISPLAY_FONT });
    expect(actualStyles.gpxImportOdometerDecimal).toMatchObject({ fontFamily: NUMERIC_DISPLAY_FONT });
    expect(screen.getByText('km')).toBeTruthy();
    expect(actualStyles.gpxImportOdometer).toMatchObject({ justifyContent: 'center' });
  });

  test('ODO全体を自然な通算距離として読み上げる', () => {
    render(<GpxImportProgressDialog {...baseProps} />);

    const odometer = screen.getByLabelText('通算距離 123.45キロメートル');

    expect(odometer.props.accessible).toBe(true);
  });

  test('visible=false のとき Dialog を非表示にする', () => {
    render(<GpxImportProgressDialog {...baseProps} visible={false} />);

    // Dialog コンポーネントの visible props を検証するために UNSAFE_getByType を使う
    const dialog = screen.UNSAFE_getByType(Dialog);
    expect(dialog.props.visible).toBe(false);
  });
});
