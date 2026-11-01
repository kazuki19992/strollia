import { render, screen } from '@testing-library/react-native';

import { lightTheme } from '@/theme/theme';
import { NUMERIC_DISPLAY_FONT } from '@/theme/fonts';
import { createStyles } from '@/ui/appStyles';
import { Dialog } from '@/ui/components/Dialog';
import { GpxImportProgressDialog } from '@/ui/components/GpxImportProgressDialog';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: require('react-native').Text,
}));

// v14 で UNSAFE_getByType が削除されたため、Dialog を実体を描画するスパイへ差し替えて渡された props を検証する
jest.mock('@/ui/components/Dialog', () => {
  const actual = jest.requireActual('@/ui/components/Dialog');
  return { ...actual, Dialog: jest.fn((props) => actual.Dialog(props)) };
});

/** 直近の描画で Dialog に渡された props を返す。 */
const getLastDialogProps = () => {
  const calls = (Dialog as unknown as jest.Mock).mock.calls;
  return calls[calls.length - 1][0];
};

const styles = new Proxy({}, { get: (_target, prop) => prop });

const baseProps = {
  visible: true,
  styles: styles as never,
  theme: lightTheme,
  odometerDistanceMeters: 123_450,
  stage: 'saving' as const,
};

describe('GpxImportProgressDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('visible=true のとき閉じられないダイアログとして表示する', async () => {
    await render(<GpxImportProgressDialog {...baseProps} />);

    // RTL のセマンティッククエリでは Modal/Dialog の props 検証が困難なため、スパイが受け取った props を検証する
    const dialogProps = getLastDialogProps();
    expect(dialogProps.visible).toBe(true);
    expect(dialogProps.dismissible).toBe(false);
    expect(dialogProps.swipeToClose).toBe(false);
  });

  test('処理段階に応じたメッセージを表示する', async () => {
    await render(<GpxImportProgressDialog {...baseProps} />);

    expect(screen.getByText('GPXを保存しています…')).toBeTruthy();
  });

  test('プログレスバーの下に中央揃えのODOをDSEG数値で表示する', async () => {
    await render(<GpxImportProgressDialog {...baseProps} />);
    const actualStyles = createStyles(lightTheme);

    expect(screen.getByText('ODO')).toBeTruthy();
    expect(actualStyles.gpxImportOdometerInteger).toMatchObject({ fontFamily: NUMERIC_DISPLAY_FONT });
    expect(actualStyles.gpxImportOdometerDecimal).toMatchObject({ fontFamily: NUMERIC_DISPLAY_FONT });
    expect(screen.getByText('km')).toBeTruthy();
    expect(actualStyles.gpxImportOdometer).toMatchObject({ justifyContent: 'center' });
  });

  test('ODO全体を自然な通算距離として読み上げる', async () => {
    await render(<GpxImportProgressDialog {...baseProps} />);

    const odometer = screen.getByLabelText('通算距離 123.45キロメートル');

    expect(odometer.props.accessible).toBe(true);
  });

  test('visible=false のとき Dialog を非表示にする', async () => {
    await render(<GpxImportProgressDialog {...baseProps} visible={false} />);

    // Dialog コンポーネントの visible props をスパイ経由で検証する
    expect(getLastDialogProps().visible).toBe(false);
  });
});
