import { LayoutAnimation } from 'react-native';

import { LIST_EXPANSION_DURATION_MS, animateListExpansion } from '@/ui/components/listExpansionAnimation';

describe('リスト開閉アニメーション animateListExpansion', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('250msで、追加・削除はフェード、位置の変化はeaseInEaseOutで補間する', () => {
    const spy = jest.spyOn(LayoutAnimation, 'configureNext').mockImplementation(() => undefined);

    animateListExpansion();

    expect(LIST_EXPANSION_DURATION_MS).toBe(250);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({
      duration: 250,
      create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
      update: { type: LayoutAnimation.Types.easeInEaseOut },
      delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    });
  });
});
