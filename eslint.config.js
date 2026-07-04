const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  // eslint-config-expo の flat config を展開
  ...expoConfig,

  // Prettier と競合する整形系ルールを無効化
  prettierConfig,

  // プロジェクト共通カスタムルール
  {
    rules: {
      // AsyncStorage 直接使用を禁止: 設定は settingsRepository (SQLite app_settings) を使う
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@react-native-async-storage/async-storage',
              message: '設定は settingsRepository (SQLite app_settings) を使う',
            },
          ],
        },
      ],

      // react-hooks/exhaustive-deps は依存配列の自動変更=挙動変更になるため warn に留める。
      // 個別に意図的に無効化する場合は eslint-disable-next-line コメントで理由を明記する。
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // ignores: 生成物・ビルド成果物・worktree・外部ネイティブコード
  {
    ignores: ['src/app/generated/**', 'builds/**', 'android/**', 'ios/**', '.worktrees/**', 'coverage/**', 'scripts/**', '.expo/**'],
  },
];
