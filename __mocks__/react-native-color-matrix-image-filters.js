// テスト環境ではネイティブフィルタを子要素そのまま描画するスタブに置き換える。
const React = require('react');

/** Grayscale フィルタのスタブ。子要素をそのまま返す。 */
function Grayscale({ children }) {
  return React.createElement(React.Fragment, null, children);
}

module.exports = {
  Grayscale,
};
