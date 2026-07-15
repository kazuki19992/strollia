import { render, screen, fireEvent } from '@testing-library/react-native';

import { ShareButton } from '@/ui/components/ShareButton';

jest.mock('@expo/vector-icons', () => ({
  Feather: require('react-native').Text,
}));

describe('共有ボタン ShareButton', () => {
  it('ラベル付き共有ボタンを押すとonPressを呼ぶ', () => {
    const onPress = jest.fn();

    render(<ShareButton accessibilityLabel="共有する" iconColor="#ffffff" label="共有" style={{}} textStyle={{}} onPress={onPress} />);

    fireEvent.press(screen.getByLabelText('共有する'));

    expect(screen.getByText('共有')).toBeTruthy();
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ラベルなしのアイコン共有ボタンとしても表示できる', () => {
    render(<ShareButton accessibilityLabel="レポートを共有" iconColor="#777777" style={{}} onPress={jest.fn()} />);

    expect(screen.getByLabelText('レポートを共有')).toBeTruthy();
  });
});
