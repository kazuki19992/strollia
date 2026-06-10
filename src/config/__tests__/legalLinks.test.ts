import {
  PRIVACY_POLICY_URL,
  SPECIFIED_COMMERCIAL_TRANSACTION_ACT_URL,
  TERMS_OF_SERVICE_URL,
} from '../legalLinks';

describe('法務リンク定数 legalLinks', () => {
  test('利用規約、プライバシーポリシー、特商法表記のURLをGitHub上のMarkdownに向ける', () => {
    expect(TERMS_OF_SERVICE_URL).toBe('https://github.com/kazuki19992/strollia-terms/blob/master/%E5%88%A9%E7%94%A8%E8%A6%8F%E7%B4%84.md');
    expect(PRIVACY_POLICY_URL).toBe('https://github.com/kazuki19992/strollia-terms/blob/master/%E3%83%97%E3%83%A9%E3%82%A4%E3%83%90%E3%82%B7%E3%83%BC.md');
    expect(SPECIFIED_COMMERCIAL_TRANSACTION_ACT_URL).toBe('https://github.com/kazuki19992/strollia-terms/blob/master/%E7%89%B9%E5%95%86%E6%B3%95%E3%81%AB%E5%9F%BA%E3%81%A5%E3%81%8F%E8%A1%A8%E8%A8%98.md');
  });
});

