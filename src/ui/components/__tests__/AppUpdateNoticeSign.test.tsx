import { render, screen } from '@testing-library/react-native';

import type { AppUpdateNotice } from '@/features/app-update/updateNotices';
import { AppUpdateNoticeSign } from '@/ui/components/AppUpdateNoticeSign';

jest.mock('react-native-svg', () => {
  const { Text, View } = require('react-native');

  return {
    __esModule: true,
    default: View,
    G: View,
    Rect: View,
    Text,
  };
});

/** 看板の標準的なfeature通知を作る。 */
function createFeatureNotice(): AppUpdateNotice {
  return {
    version: '1.3.0',
    kind: 'feature',
    heading: '新機能を\n追加しました',
    sectionTitle: '主な新機能',
    items: ['地図を改善'],
    showMore: false,
  };
}

describe('アプリ更新通知の工事看板 AppUpdateNoticeSign', () => {
  test('feature通知を固定座標の看板と共通のリリースノート案内で描画する', () => {
    render(<AppUpdateNoticeSign notice={createFeatureNotice()} />);

    expect(screen.getByTestId('app-update-notice-sign-canvas')).toHaveProp('viewBox', '0 0 329 261');
    expect(screen.getByTestId('app-update-notice-sign-background')).toHaveProp('height', 261);
    expect(screen.getByTestId('app-update-notice-sign-top-band')).toHaveProp('height', 31);
    expect(screen.getByTestId('app-update-notice-sign-outer-border')).toHaveProp('rx', 0);
    expect(screen.getByTestId('app-update-notice-sign-outer-border')).toHaveProp('height', 257);
    expect(screen.getByTestId('app-update-notice-sign-content-box')).toHaveProp('height', 54);
    expect(screen.getByTestId('app-update-notice-sign-version-pill')).toHaveProp('rx', 12.5);
    expect(screen.getByTestId('app-update-notice-sign-version-pill')).toHaveProp('y', 207);
    expect(screen.getByTestId('app-update-notice-sign-top-copy').props.children).toBe('アプリを新しくしました');
    expect(screen.getByTestId('app-update-notice-sign-heading-first-line')).toHaveProp('y', 79);
    expect(screen.getByTestId('app-update-notice-sign-heading-second-line')).toHaveProp('y', 119);
    expect(screen.getByTestId('app-update-notice-sign-version')).toHaveProp('y', 226);
    expect(screen.getByText('詳しくはリリースノートをご確認ください')).toBeTruthy();
    expect(screen.getByTestId('app-update-notice-sign-footer')).toHaveProp('y', 252);
  });

  test('fix通知の上帯を改行しない単一のSVG Textで描画する', () => {
    const notice: AppUpdateNotice = {
      ...createFeatureNotice(),
      kind: 'fix',
      heading: '不具合を\nなおしました',
      sectionTitle: '修正した不具合',
    };

    render(<AppUpdateNoticeSign notice={notice} />);

    expect(screen.getByTestId('app-update-notice-sign-top-copy').props.children).toBe('ご迷惑をおかけしました');
    expect(screen.getByText('詳しくはリリースノートをご確認ください')).toBeTruthy();
  });

  test('更新項目が2件の場合は内容欄以降だけ21単位伸ばす', () => {
    const notice: AppUpdateNotice = {
      ...createFeatureNotice(),
      items: ['地図を改善', '検索を追加'],
    };

    render(<AppUpdateNoticeSign notice={notice} />);

    expect(screen.getByTestId('app-update-notice-sign-canvas')).toHaveProp('viewBox', '0 0 329 282');
    expect(screen.getByTestId('app-update-notice-sign-content-box')).toHaveProp('height', 75);
    expect(screen.getByTestId('app-update-notice-sign-version-pill')).toHaveProp('y', 228);
    expect(screen.getByTestId('app-update-notice-sign-version')).toHaveProp('y', 247);
    expect(screen.getByTestId('app-update-notice-sign-footer')).toHaveProp('y', 273);
  });

  test('2件かつshowMoreの場合はさらに16単位伸ばし、小さい補足を描画する', () => {
    const notice: AppUpdateNotice = {
      ...createFeatureNotice(),
      items: ['地図を改善', '検索を追加'],
      showMore: true,
    };

    render(<AppUpdateNoticeSign notice={notice} />);

    expect(screen.getByTestId('app-update-notice-sign-canvas')).toHaveProp('viewBox', '0 0 329 298');
    expect(screen.getByTestId('app-update-notice-sign-content-box')).toHaveProp('height', 91);
    expect(screen.getByTestId('app-update-notice-sign-show-more')).toHaveProp('fontSize', 11);
    expect(screen.getByTestId('app-update-notice-sign-show-more').props.children).toBe('など……');
    expect(screen.getByTestId('app-update-notice-sign-version-pill')).toHaveProp('y', 244);
    expect(screen.getByTestId('app-update-notice-sign-footer')).toHaveProp('y', 289);
  });
});
