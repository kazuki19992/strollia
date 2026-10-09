/**
 * Jestでの `.svg` import 用モック。
 *
 * react-native-svg-transformer公式READMEは `module.exports = "SvgMock"`(文字列)を示すが、
 * 文字列は有効なReact Native組み込みコンポーネント名として登録されていないため、
 * @testing-library/react-native 経由でレンダーすると失敗する。
 * 既存のモック方針(@expo/vector-icons を react-native の Text で代替する等)に合わせ、
 * 実在するコンポーネント(View)を返す。
 */
module.exports = require('react-native').View;
