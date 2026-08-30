import type { ReactElement } from 'react';
import { G, Rect, Text } from 'react-native-svg';

import { getAppUpdateNoticeText, type AppUpdateNotice } from '@/features/app-update/updateNotices';
import { ScalableSvgCanvas } from '@/ui/components/ScalableSvgCanvas';

/** 工事看板のSVG viewBoxにおける固定幅。 */
const SIGN_WIDTH = 329;
/** 更新項目が1件のときの工事看板の固定高さ。 */
const BASE_SIGN_HEIGHT = 261;
/** 2件目の更新項目を表示するために追加する高さ。 */
const SECOND_ITEM_EXTENSION = 21;
/** 「など……」を表示するために追加する高さ。 */
const SHOW_MORE_EXTENSION = 16;
/** 工事看板の基準青。 */
const SIGN_BLUE = '#0077CC';
/** 工事看板面と青帯上の文字に使う白。 */
const SIGN_WHITE = '#FFFFFF';
/** リリースノート案内に使う濃いグレー。 */
const SIGN_FOOTER = '#303030';

/** 工事看板へ描画する更新通知のプロパティ。 */
export type AppUpdateNoticeSignProps = {
  /** 表示する版番号・種別・更新内容。 */
  notice: AppUpdateNotice;
  /** 看板を収める最大幅。 */
  maxWidth?: number;
  /** 看板を収める最大高。 */
  maxHeight?: number;
};

/** SVGアートワークだけに必要な、算出済みの縦方向レイアウト値。 */
type AppUpdateNoticeSignArtworkProps = {
  /** 表示する版番号・種別・更新内容。 */
  notice: AppUpdateNotice;
  /** 重要順の更新項目から看板へ描画する先頭2件。 */
  displayedItems: readonly string[];
  /** 更新項目数と「など……」に対応する内容欄以降の下方向オフセット。 */
  lowerContentOffset: number;
  /** オフセットを含む看板全体の高さ。 */
  signHeight: number;
};

/** 種別ごとに固定された上帯の短い案内文を返す。 */
function getTopCopy(kind: AppUpdateNotice['kind']): string {
  return kind === 'feature' ? 'アプリを新しくしました' : 'ご迷惑をおかけしました';
}

/** 改行で固定された見出しをSVGの2行へ分割する。 */
function getHeadingLines(heading: string): readonly [string, string] {
  const [firstLine, secondLine] = heading.split('\n');
  return [firstLine, secondLine];
}

/** 読み上げ時に看板の内容を重複なく伝えるラベルを組み立てる。 */
function getAccessibilityLabel(notice: AppUpdateNotice): string {
  const { heading, sectionTitle } = getAppUpdateNoticeText(notice.kind);
  const displayedItems = notice.items.slice(0, 2);
  return [
    getTopCopy(notice.kind),
    heading.replace('\n', '、'),
    sectionTitle,
    ...displayedItems,
    notice.items.length > displayedItems.length ? 'など' : null,
    `Ver ${notice.version}`,
    '詳しくはリリースノートをご確認ください',
  ]
    .filter((value): value is string => value !== null)
    .join('、');
}

/**
 * 更新通知用の工事看板SVGを、親幅に応じて同じ倍率で描画する。
 *
 * SVG内の固定座標を維持して文字・線・余白を同時に拡大縮小するため、個別の端末幅調整は行わない。
 */
export function AppUpdateNoticeSign({ notice, maxWidth, maxHeight }: AppUpdateNoticeSignProps): ReactElement {
  const displayedItems = notice.items.slice(0, 2);
  const secondItemOffset = displayedItems.length === 2 ? SECOND_ITEM_EXTENSION : 0;
  const moreItemsOffset = notice.items.length > displayedItems.length ? SHOW_MORE_EXTENSION : 0;
  const lowerContentOffset = secondItemOffset + moreItemsOffset;
  const signHeight = BASE_SIGN_HEIGHT + lowerContentOffset;

  return (
    <ScalableSvgCanvas
      viewBoxWidth={SIGN_WIDTH}
      viewBoxHeight={signHeight}
      maxWidth={maxWidth}
      maxHeight={maxHeight}
      accessibilityLabel={getAccessibilityLabel(notice)}
      testID="app-update-notice-sign-canvas"
    >
      <AppUpdateNoticeSignArtwork
        notice={notice}
        displayedItems={displayedItems}
        lowerContentOffset={lowerContentOffset}
        signHeight={signHeight}
      />
    </ScalableSvgCanvas>
  );
}

/** 固定座標で工事看板のSVG要素を描画する。 */
function AppUpdateNoticeSignArtwork({
  notice,
  displayedItems,
  lowerContentOffset,
  signHeight,
}: AppUpdateNoticeSignArtworkProps): ReactElement {
  const { heading, sectionTitle } = getAppUpdateNoticeText(notice.kind);
  const [headingFirstLine, headingSecondLine] = getHeadingLines(heading);
  const hasMoreItems = notice.items.length > displayedItems.length;

  return (
    <G>
      <Rect testID="app-update-notice-sign-background" x={0} y={0} width={SIGN_WIDTH} height={signHeight} fill={SIGN_WHITE} rx={0} ry={0} />
      <Rect testID="app-update-notice-sign-top-band" x={0} y={0} width={SIGN_WIDTH} height={31} fill={SIGN_BLUE} rx={0} ry={0} />
      <Rect
        testID="app-update-notice-sign-outer-border"
        x={2}
        y={2}
        width={325}
        height={signHeight - 4}
        fill="none"
        stroke={SIGN_BLUE}
        strokeWidth={4}
        rx={0}
        ry={0}
      />
      <Text testID="app-update-notice-sign-top-copy" x={164.5} y={26} fill={SIGN_WHITE} textAnchor="middle" fontSize={24} fontWeight="900">
        {getTopCopy(notice.kind)}
      </Text>
      <Text
        testID="app-update-notice-sign-heading-first-line"
        x={164.5}
        y={79}
        fill={SIGN_BLUE}
        textAnchor="middle"
        fontSize={40}
        fontWeight="900"
      >
        {headingFirstLine}
      </Text>
      <Text
        testID="app-update-notice-sign-heading-second-line"
        x={164.5}
        y={119}
        fill={SIGN_BLUE}
        textAnchor="middle"
        fontSize={40}
        fontWeight="900"
      >
        {headingSecondLine}
      </Text>
      <Rect
        testID="app-update-notice-sign-content-box"
        x={10}
        y={146}
        width={310}
        height={54 + lowerContentOffset}
        fill={SIGN_WHITE}
        stroke={SIGN_BLUE}
        strokeWidth={2}
        rx={0}
        ry={0}
      />
      <Text x={21} y={168} fill={SIGN_BLUE} fontSize={14} fontWeight="900">
        {sectionTitle}
      </Text>
      <Text x={21} y={189} fill={SIGN_BLUE} fontSize={14} fontWeight="900">
        {displayedItems[0]}
      </Text>
      {displayedItems[1] ? (
        <Text x={21} y={210} fill={SIGN_BLUE} fontSize={14} fontWeight="900">
          {displayedItems[1]}
        </Text>
      ) : null}
      {hasMoreItems ? (
        <Text testID="app-update-notice-sign-show-more" x={21} y={226} fill={SIGN_BLUE} fontSize={11} fontWeight="900">
          など……
        </Text>
      ) : null}
      <Rect
        testID="app-update-notice-sign-version-pill"
        x={9}
        y={207 + lowerContentOffset}
        width={312}
        height={25}
        fill={SIGN_BLUE}
        rx={12.5}
        ry={12.5}
      />
      <Text
        testID="app-update-notice-sign-version"
        x={164.5}
        y={226 + lowerContentOffset}
        fill={SIGN_WHITE}
        textAnchor="middle"
        fontSize={18}
        fontWeight="900"
      >
        {`Ver ${notice.version}`}
      </Text>
      <Text
        testID="app-update-notice-sign-footer"
        x={318}
        y={252 + lowerContentOffset}
        fill={SIGN_FOOTER}
        textAnchor="end"
        fontSize={10}
        fontWeight="900"
      >
        詳しくはリリースノートをご確認ください
      </Text>
    </G>
  );
}
