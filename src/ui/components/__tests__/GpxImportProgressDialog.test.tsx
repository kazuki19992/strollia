import { Text } from 'react-native';

import { lightTheme } from '@/theme/theme';
import { Dialog } from '@/ui/components/Dialog';
import { GpxImportProgressDialog } from '@/ui/components/GpxImportProgressDialog';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: require('react-native').Text,
}));

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

const styles = new Proxy({}, { get: (_target, prop) => prop });

const baseProps = {
  visible: true,
  styles: styles as never,
  theme: lightTheme,
};

describe('GpxImportProgressDialog', () => {
  test('visible=true のとき閉じられないダイアログとして表示する', () => {
    let renderer: any;
    act(() => {
      renderer = ReactTestRenderer.create(<GpxImportProgressDialog {...baseProps} />);
    });

    const dialog = renderer.root.findByType(Dialog);
    expect(dialog.props.visible).toBe(true);
    expect(dialog.props.dismissible).toBe(false);
    expect(dialog.props.swipeToClose).toBe(false);
  });

  test('visible=true のとき取り込み中メッセージを表示する', () => {
    let renderer: any;
    act(() => {
      renderer = ReactTestRenderer.create(<GpxImportProgressDialog {...baseProps} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node: any) => node.props.children);
    expect(texts).toContain('GPXを取り込んでいます…');
  });

  test('visible=false のとき Dialog を非表示にする', () => {
    let renderer: any;
    act(() => {
      renderer = ReactTestRenderer.create(<GpxImportProgressDialog {...baseProps} visible={false} />);
    });

    const dialog = renderer.root.findByType(Dialog);
    expect(dialog.props.visible).toBe(false);
  });
});
