import { PRIVACY_POLICY_URL, SPECIFIED_COMMERCIAL_TRANSACTION_ACT_URL, TERMS_OF_SERVICE_URL } from '../legalLinks';

describe('法務リンク定数 legalLinks', () => {
  test('利用規約、プライバシーポリシー、特商法表記のURLをGitHub Pagesの短いパスに向ける', () => {
    expect(TERMS_OF_SERVICE_URL).toBe('https://kazuki19992.github.io/strollia-terms/terms');
    expect(PRIVACY_POLICY_URL).toBe('https://kazuki19992.github.io/strollia-terms/privacy-policy');
    expect(SPECIFIED_COMMERCIAL_TRANSACTION_ACT_URL).toBe('https://kazuki19992.github.io/strollia-terms/legal-notice');
  });
});
