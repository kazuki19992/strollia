const { decodeXmlEntities, normalizeNpmLicenses, readPlistStringValue, splitPackageKey } = require('../generate-licenses');

describe('OSSライセンス生成スクリプト', () => {
  test('scope付きnpmパッケージ名とバージョンを分離する', () => {
    expect(splitPackageKey('@expo/vector-icons@15.0.3')).toEqual({
      name: '@expo/vector-icons',
      version: '15.0.3',
    });
  });

  test('npmライセンス情報をアプリ表示用に正規化する', () => {
    const entries = normalizeNpmLicenses({
      'react@19.1.0': {
        licenses: 'MIT',
        repository: 'https://github.com/facebook/react',
      },
      'private-package@1.0.0': {
        private: true,
        licenses: 'UNLICENSED',
      },
    });

    expect(entries).toEqual([
      {
        id: 'npm:react@19.1.0',
        name: 'react',
        version: '19.1.0',
        licenses: 'MIT',
        repository: 'https://github.com/facebook/react',
        source: 'npm',
        licenseText: null,
        noticeText: null,
      },
    ]);
  });

  test('CocoaPods acknowledgements plistの文字列値を読む', () => {
    const dictXml = '<key>Title</key><string>ExamplePod</string><key>FooterText</key><string>MIT &amp; Notice</string>';

    expect(readPlistStringValue(dictXml, 'Title')).toBe('ExamplePod');
    expect(readPlistStringValue(dictXml, 'FooterText')).toBe('MIT & Notice');
  });

  test('plistのXML実体参照を戻す', () => {
    expect(decodeXmlEntities('&lt;MIT&gt; &amp; &quot;notice&quot;')).toBe('<MIT> & "notice"');
  });
});
