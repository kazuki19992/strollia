import { Text } from 'react-native';

import { DescriptionText } from '@/app/components/DescriptionText';

const ReactTestRenderer = require('react-test-renderer');
const { act } = ReactTestRenderer;

const styles = new Proxy({}, { get: (_target, prop) => prop });

describe('説明テキスト DescriptionText', () => {
  it('テキストを formItemDescription スタイルで表示する', () => {
    let renderer: any;

    act(() => {
      renderer = ReactTestRenderer.create(
        <DescriptionText styles={styles as never}>移動距離はGPSのブレにより本来の距離より多く記録される場合があります。</DescriptionText>,
      );
    });

    const textNode = renderer.root.findByType(Text);
    expect(textNode.props.children).toBe('移動距離はGPSのブレにより本来の距離より多く記録される場合があります。');
    expect(textNode.props.style).toBe('formItemDescription');
  });
});
