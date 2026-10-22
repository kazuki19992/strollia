/**
 * react-native-svg-transformer(Metro)経由で `.svg` をReactコンポーネントとしてimportできるようにする型宣言。
 * 実体は無く、変換後の形(SvgPropsを受け取るコンポーネント)を型として示すだけ。
 */
declare module '*.svg' {
  import { ComponentType } from 'react';
  import { SvgProps } from 'react-native-svg';

  const content: ComponentType<SvgProps>;
  export default content;
}
