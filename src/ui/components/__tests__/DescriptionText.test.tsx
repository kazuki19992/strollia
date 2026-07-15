import { render, screen } from '@testing-library/react-native';

import { DescriptionText } from '@/ui/components/DescriptionText';

const styles = new Proxy({}, { get: (_target, prop) => prop });

describe('説明テキスト DescriptionText', () => {
  it('テキストを formItemDescription スタイルで表示する', () => {
    render(
      <DescriptionText styles={styles as never}>移動距離はGPSのブレにより本来の距離より多く記録される場合があります。</DescriptionText>,
    );

    const textNode = screen.getByText('移動距離はGPSのブレにより本来の距離より多く記録される場合があります。');
    expect(textNode.props.style).toBe('formItemDescription');
  });
});
