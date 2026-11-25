import {
  achievementMessage,
  formatAreaComparison,
  mapPageMessage,
  resolveAreaComparison,
  resolveDistanceComparison,
  resolveDistanceTier,
  resolveNewAreaSquareMeters,
  summaryMessage,
} from '@/features/annualReport/annualReportCopy';

describe('年次レポートの文言 annualReportCopy', () => {
  it('1,642kmは東京〜大阪1.6往復分', () =>
    expect(resolveDistanceComparison(1_642_300)).toEqual({ label: '東京〜大阪', value: 1.6, unit: '往復分', endpoints: ['東京', '大阪'] }));
  it('400kmは東京〜大阪0.4往復分', () => expect(resolveDistanceComparison(400_000).value).toBe(0.4));
  it('6,420kmは日本縦断2.1回分', () =>
    expect(resolveDistanceComparison(6_420_000)).toMatchObject({ label: '日本縦断', value: 2.1, unit: '回分' }));
  it('日本縦断の両端は宗谷岬と佐多岬', () => expect(resolveDistanceComparison(6_420_000).endpoints).toEqual(['宗谷岬', '佐多岬']));
  it('15,230kmは日本1.3周分で両端なし', () =>
    expect(resolveDistanceComparison(15_230_000)).toMatchObject({ label: '日本', value: 1.3, unit: '周分', endpoints: null }));
  it('52,400kmは地球1.3周分で両端なし', () =>
    expect(resolveDistanceComparison(52_400_000)).toMatchObject({ label: '地球', value: 1.3, unit: '周分', endpoints: null }));
  it('地球〜月・火星・太陽は往復分で両端あり', () => {
    expect(resolveDistanceComparison(768_800_000)).toEqual({ label: '地球〜月', value: 1, unit: '往復分', endpoints: ['地球', '月'] });
    expect(resolveDistanceComparison(112_000_000_000)).toMatchObject({ label: '地球〜火星', unit: '往復分', endpoints: ['地球', '火星'] });
    expect(resolveDistanceComparison(299_200_000_000)).toMatchObject({ label: '地球〜太陽', unit: '往復分', endpoints: ['地球', '太陽'] });
  });
  it('1,000km未満や0mでも東京〜大阪になる', () => expect(resolveDistanceComparison(0)).toMatchObject({ label: '東京〜大阪', value: 0 }));

  it('段階の境目', () => {
    expect(resolveDistanceTier(2_999_999)).toBe(1);
    expect(resolveDistanceTier(3_000_000)).toBe(2);
    expect(resolveDistanceTier(9_999_999)).toBe(2);
    expect(resolveDistanceTier(10_000_000)).toBe(3);
    expect(resolveDistanceTier(24_999_999)).toBe(3);
    expect(resolveDistanceTier(25_000_000)).toBe(4);
  });

  it('マップページの段階別文言', () => {
    expect([1, 2, 3, 4].map((t) => mapPageMessage(t as 1 | 2 | 3 | 4))).toEqual([
      'このエリアを移動しました！',
      'いろんなところに行きましたね！',
      '旅行が多い一年でしたね！',
      'めちゃくちゃ移動しましたね！',
    ]);
  });
  it('まとめページの段階別文言', () => {
    expect(summaryMessage(1, 2026)).toBe('いろいろなところに行きましたね！');
    expect(summaryMessage(3, 2026)).toBe('旅行が多い一年でした！');
    expect(summaryMessage(4, 2026)).toBe('フットワークの軽い一年でした！');
  });
  it('段階2のまとめは年を数字で書く', () => expect(summaryMessage(2, 2026)).toBe('2026年もいっぱい移動しましたね！'));

  it('スポットがあれば実績とスポットの文言', () =>
    expect(achievementMessage(12, 3)).toBe('12個の実績解除と、3か所のスポットに到達しました！'));
  it('スポット0なら実績のみの文言', () => expect(achievementMessage(12, 0)).toBe('12個の実績を解除しました！'));
});

describe('新しいエリアの広さの比較 resolveAreaComparison', () => {
  it('四国ちょうどは四国の約1倍', () => expect(resolveAreaComparison(18_800_000_000)).toEqual({ label: '四国', value: 1, suffix: '倍' }));
  it('四国の直前は東京都の倍数になる', () => expect(resolveAreaComparison(18_799_999_999)).toMatchObject({ label: '東京都', value: 8.6 }));
  it('東京都ちょうどは東京都の約1倍', () => expect(resolveAreaComparison(2_194_000_000)).toMatchObject({ label: '東京都', value: 1 }));
  it('東京都の直前は琵琶湖の倍数になる', () => expect(resolveAreaComparison(2_193_999_999)).toMatchObject({ label: '琵琶湖', value: 3.3 }));
  it('琵琶湖ちょうどは琵琶湖の約1倍', () => expect(resolveAreaComparison(669_000_000)).toMatchObject({ label: '琵琶湖', value: 1 }));
  it('琵琶湖の直前は山手線の内側の倍数になる(東京23区は使わない)', () =>
    expect(resolveAreaComparison(668_999_999)).toMatchObject({ label: '山手線の内側', value: 11 }));
  it('山手線の内側ちょうどは約1倍', () => expect(resolveAreaComparison(63_000_000)).toMatchObject({ label: '山手線の内側', value: 1 }));
  it('山手線の内側の直前は皇居の倍数(10以上は整数)', () =>
    expect(resolveAreaComparison(62_999_999)).toEqual({ label: '皇居', value: 55, suffix: '倍' }));
  it('3,263,000m²は皇居の約2.8倍', () => expect(resolveAreaComparison(3_263_000)).toEqual({ label: '皇居', value: 2.8, suffix: '倍' }));
  it('皇居ちょうどは皇居の約1倍', () => expect(resolveAreaComparison(1_150_000)).toMatchObject({ label: '皇居', value: 1 }));
  it('皇居の直前は東京ドームの個数(10以上は整数)', () =>
    expect(resolveAreaComparison(1_149_999)).toEqual({ label: '東京ドーム', value: 25, suffix: '個分' }));
  it('東京ドームちょうどは約1個分', () => expect(resolveAreaComparison(46_755)).toEqual({ label: '東京ドーム', value: 1, suffix: '個分' }));
  it('東京ドームの直前はサッカーコートの面数', () =>
    expect(resolveAreaComparison(46_754)).toEqual({ label: 'サッカーコート', value: 6.5, suffix: '面分' }));
  it('サッカーコートちょうどは約1面分', () =>
    expect(resolveAreaComparison(7_140)).toEqual({ label: 'サッカーコート', value: 1, suffix: '面分' }));
  it('サッカーコートより狭いときは小数で表す(0.5面)', () =>
    expect(resolveAreaComparison(3_570)).toEqual({ label: 'サッカーコート', value: 0.5, suffix: '面分' }));
  it('0m²でも例外にせずサッカーコート0面分を返す', () =>
    expect(resolveAreaComparison(0)).toEqual({ label: 'サッカーコート', value: 0, suffix: '面分' }));
});

describe('広さの比較の表記 formatAreaComparison', () => {
  it('地域・皇居は「〇〇の約X倍」', () => expect(formatAreaComparison({ label: '皇居', value: 2.8, suffix: '倍' })).toBe('皇居の約2.8倍'));
  it('東京ドームは「〇〇 約X個分」', () =>
    expect(formatAreaComparison({ label: '東京ドーム', value: 12, suffix: '個分' })).toBe('東京ドーム 約12個分'));
  it('サッカーコートは「〇〇 約X面分」', () =>
    expect(formatAreaComparison({ label: 'サッカーコート', value: 0.3, suffix: '面分' })).toBe('サッカーコート 約0.3面分'));
});

describe('新しいエリアの面積 resolveNewAreaSquareMeters', () => {
  it('保存済みの実面積があればそれを使う', () =>
    expect(resolveNewAreaSquareMeters({ newCellCount: 487, newAreaSquareMeters: 3_263_000 })).toBe(3_263_000));
  it('古い保存データ(実面積なし)は緯度35°の1マス6,700m²で概算する', () =>
    expect(resolveNewAreaSquareMeters({ newCellCount: 487 })).toBe(487 * 6_700));
});
