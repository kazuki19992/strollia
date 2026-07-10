import { render, screen } from '@testing-library/react-native';

import { lightTheme } from '@/theme/theme';
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

  test('visible=true のとき取り込み中メッセージを表示する', () => {
    render(<GpxImportProgressDialog {...baseProps} />);

    expect(screen.getByText('GPXを取り込んでいます…')).toBeTruthy();
  });

  test('visible=false のとき Dialog を非表示にする', () => {
    render(<GpxImportProgressDialog {...baseProps} visible={false} />);

    // Dialog コンポーネントの visible props を検証するために UNSAFE_getByType を使う
    const dialog = screen.UNSAFE_getByType(Dialog);
    expect(dialog.props.visible).toBe(false);
  });
});
