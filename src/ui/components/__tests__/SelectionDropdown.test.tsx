import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { lightTheme } from '@/theme/theme';
import { SelectionDropdown } from '@/ui/components/SelectionDropdown';

const mockUseWindowDimensions = jest.fn();

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: mockUseWindowDimensions,
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: require('react-native').Text,
}));

const styles = new Proxy({}, { get: () => ({}) });

describe('選択ドロップダウン SelectionDropdown', () => {
  afterEach(() => {
    mockUseWindowDimensions.mockReset();
  });

  test('選択肢が画面高を超える場合は高さ制限付きのスクロール領域へ収める', () => {
    mockUseWindowDimensions.mockReturnValue({ fontScale: 1, height: 844, scale: 3, width: 390 });

    render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 59, right: 0, bottom: 34, left: 0 },
        }}
      >
        <SelectionDropdown
          accessibilityLabel="候補を選択"
          getKey={(option) => option}
          getLabel={(option) => option}
          options={Array.from({ length: 20 }, (_, index) => `候補 ${index + 1}`)}
          selectedValue="候補 1"
          styles={styles as never}
          theme={lightTheme}
          onSelect={jest.fn()}
        />
      </SafeAreaProvider>,
    );

    fireEvent.press(screen.getByLabelText('候補を選択'));

    const sheet = screen.getByTestId('selection-dropdown-sheet');
    expect(StyleSheet.flatten(sheet.props.style).maxHeight).toBe(769);
    expect(screen.getByTestId('selection-dropdown-options')).toBeTruthy();
  });
});
