import { render, screen } from '@testing-library/react-native';

import { DescriptionText } from '@/ui/components/DescriptionText';

const styles = new Proxy({}, { get: (_target, prop) => prop });

describe('説明テキスト DescriptionText', () => {
  it('テキストを formItemDescription スタイルで表示する', async () => {
    await render(
      <DescriptionText styles={styles as never}>移動距離はGPSのブレにより本来の距離より多く記録される場合があります。</DescriptionText>,
    );

    const textNode = screen.getByText('移動距離はGPSのブレにより本来の距離より多く記録される場合があります。');
    expect(textNode.props.style).toBe('formItemDescription');
  });

  it('centered を指定すると中央揃えのスタイルを重ねる', async () => {
    await render(
      <DescriptionText centered styles={styles as never}>
        中央に置く補足
      </DescriptionText>,
    );

    expect(screen.getByText('中央に置く補足').props.style).toEqual(['formItemDescription', 'descriptionTextCentered']);
  });
});
