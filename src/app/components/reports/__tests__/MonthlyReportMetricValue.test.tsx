import { StyleSheet, Text } from 'react-native';

import { NUMERIC_DISPLAY_FONT } from '@/theme/fonts';
import { MonthlyReportMetricValue } from '@/app/components/reports/MonthlyReportMetricValue';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

describe('月次レポート数値表示 MonthlyReportMetricValue', () => {
  let renderer: { unmount: () => void; root: any } | null = null;

  afterEach(() => {
    act(() => {
      renderer?.unmount();
    });
    renderer = null;
  });

  it('整数部と小数部だけDSEGフォントで表示し、単位は通常フォントにする', () => {
    act(() => {
      renderer = ReactTestRenderer.create(<MonthlyReportMetricValue value="256.70" unit="km" color="#333333" />);
    });

    const texts = renderer!.root.findAllByType(Text);
    expect(texts.map((node: any) => node.props.children)).toEqual(['256', '.70', 'km']);
    expect(StyleSheet.flatten(texts[0].props.style).fontFamily).toBe(NUMERIC_DISPLAY_FONT);
    expect(StyleSheet.flatten(texts[1].props.style).fontFamily).toBe(NUMERIC_DISPLAY_FONT);
    expect(StyleSheet.flatten(texts[2].props.style).fontFamily).toBeUndefined();
  });
});
