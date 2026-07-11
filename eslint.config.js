const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

// no-restricted-syntax の共通セレクタ。
// flat config の override は同ルールを「上書き」するため、全 override に同じセレクタを含める必要がある。
const COMMON_RESTRICTED_SYNTAX = [
  {
    // jest.mock / jest.requireActual 等のパス文字列は no-restricted-imports の対象外のため、
    // no-restricted-syntax で ../ 始まりのパスを検出して @/ エイリアスへ誘導する
    selector:
      "CallExpression[callee.object.name='jest'][callee.property.name=/^(mock|doMock|unmock|requireActual|requireMock)$/] > Literal[value=/^\\.\\.\\//]",
    message: 'jest.mock / jest.requireActual などのパスも @/ エイリアスを使う',
  },
  {
    // require('react-test-renderer') 形式の直接参照を禁止する。
    // import 文は no-restricted-imports で捕捉するが、require 呼び出しはこちらで検出する。
    selector: "CallExpression[callee.name='require'] > Literal[value='react-test-renderer']",
    message: 'react-test-renderer の直接 require は禁止。@testing-library/react-native または expo-router/testing-library を使う',
  },
];

module.exports = [
  // eslint-config-expo の flat config を展開
  ...expoConfig,

  // Prettier と競合する整形系ルールを無効化
  prettierConfig,

  // プロジェクト共通カスタムルール
  {
    rules: {
      // AsyncStorage 直接使用を禁止 / ディレクトリを跨ぐ相対 import 禁止
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@react-native-async-storage/async-storage',
              message: '設定は settingsRepository (SQLite app_settings) を使う',
            },
            {
              name: 'react-test-renderer',
              message: 'react-test-renderer の直接 import は禁止。@testing-library/react-native または expo-router/testing-library を使う',
            },
          ],
          patterns: [
            {
              // ../  を含むパスはディレクトリ跨ぎとみなし @/ エイリアスを使う
              // 同一ディレクトリ内の ./xxx はこのルールの対象外
              group: ['../*'],
              message: 'ディレクトリを跨ぐimportは @/ エイリアスを使う',
            },
          ],
        },
      ],

      'no-restricted-syntax': ['error', ...COMMON_RESTRICTED_SYNTAX],

      // react-hooks/exhaustive-deps は依存配列の自動変更=挙動変更になるため warn に留める。
      // 個別に意図的に無効化する場合は eslint-disable-next-line コメントで理由を明記する。
      'react-hooks/exhaustive-deps': 'warn',

      // react-hooks/refs: useRef(new Animated.Value(0)).current をコンポーネントトップレベルで使う
      // React Native のアニメーションパターンとして意図的な書き方。warn に留める。
      'react-hooks/refs': 'warn',

      // react-hooks/set-state-in-effect: useEffect 内で setState を同期的に呼ぶパターン。
      // 既存の挙動を維持するため warn に留める。依存配列と合わせて後続リファクタで対処する。
      'react-hooks/set-state-in-effect': 'warn',
    },
  },

  // src/ui/components/ 配下では StyleSheet.create を禁止する。
  // スタイルは src/ui/appStyles.ts の createStyles(theme) に集約すること。
  // src/ui/appStyles.ts と reports/reportStyles.ts は集約先のため対象外。
  // COMMON_RESTRICTED_SYNTAX を展開して全共通禁止セレクタを維持する。
  {
    files: ['src/ui/components/**/*.{ts,tsx}'],
    ignores: ['src/ui/components/reports/reportStyles.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...COMMON_RESTRICTED_SYNTAX,
        {
          selector: "CallExpression[callee.object.name='StyleSheet'][callee.property.name='create']",
          message: 'components配下でStyleSheet.createは使用禁止。スタイルはsrc/ui/appStyles.tsのcreateStyles(theme)に集約してください。',
        },
      ],
    },
  },

  // ignores: 生成物・ビルド成果物・worktree・外部ネイティブコード
  {
    ignores: [
      'src/ui/generated/**',
      'builds/**',
      'android/**',
      'ios/**',
      '.worktrees/**',
      '.claude/worktrees/**',
      'coverage/**',
      'scripts/**',
      '.expo/**',
    ],
  },
];
