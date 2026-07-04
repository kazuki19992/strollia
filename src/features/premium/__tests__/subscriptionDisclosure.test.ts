import { SUBSCRIPTION_DISCLOSURE_TEXT } from '@/features/premium/subscriptionDisclosure';

describe('subscriptionDisclosure サブスクリプション開示文', () => {
  it('SUBSCRIPTION_DISCLOSURE_TEXT が空でない文字列である', () => {
    expect(typeof SUBSCRIPTION_DISCLOSURE_TEXT).toBe('string');
    expect(SUBSCRIPTION_DISCLOSURE_TEXT.length).toBeGreaterThan(0);
  });

  it('月額プランの価格（300円）が記載されている', () => {
    expect(SUBSCRIPTION_DISCLOSURE_TEXT).toContain('300円');
  });

  it('年額プランの価格（3,300円）が記載されている', () => {
    expect(SUBSCRIPTION_DISCLOSURE_TEXT).toContain('3,300円');
  });

  it('自動更新に関する説明が含まれている', () => {
    expect(SUBSCRIPTION_DISCLOSURE_TEXT).toContain('自動更新');
  });

  it('App Store での管理・解約方法に関する説明が含まれている', () => {
    expect(SUBSCRIPTION_DISCLOSURE_TEXT).toContain('App Store');
  });
});
