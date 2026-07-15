import { StyleSheet, Text } from 'react-native';
import { render, screen, act } from '@testing-library/react-native';

import { NUMERIC_DISPLAY_FONT } from '@/theme/fonts';
import { MonthlyReportMetricValue } from '@/ui/components/reports/MonthlyReportMetricValue';

describe('月次レポート数値表示 MonthlyReportMetricValue', () => {
  it('整数部と小数部だけDSEGフォントで表示し、単位は通常フォントにする', () => {
    render(<MonthlyReportMetricValue value="256.70" unit="km" color="#333333" />);

    // UNSAFE_getAllByType を使うのは fontFamily という非セマンティックな props を検証するため
    const texts = screen.UNSAFE_getAllByType(Text);
    expect(texts.map((node) => node.props.children)).toEqual(['256', '.70', 'km']);
    expect(StyleSheet.flatten(texts[0].props.style).fontFamily).toBe(NUMERIC_DISPLAY_FONT);
    expect(StyleSheet.flatten(texts[1].props.style).fontFamily).toBe(NUMERIC_DISPLAY_FONT);
    expect(StyleSheet.flatten(texts[2].props.style).fontFamily).toBeUndefined();
  });
});
