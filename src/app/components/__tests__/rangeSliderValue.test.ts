import { resolveRangeThumbValues } from '../rangeSliderValue';

const bounds = { minValue: 0, maxValue: 100, stepValue: 5 };

describe('resolveRangeThumbValues', () => {
  it('startつまみは end-step を超えない', () => {
    expect(resolveRangeThumbValues('start', 90, { start: 20, end: 40 }, bounds)).toEqual({ start: 35, end: 40 });
  });
  it('endつまみは start+step を下回らない', () => {
    expect(resolveRangeThumbValues('end', 10, { start: 40, end: 60 }, bounds)).toEqual({ start: 40, end: 45 });
  });
  it('start を範囲内で動かす', () => {
    expect(resolveRangeThumbValues('start', 22, { start: 0, end: 80 }, bounds)).toEqual({ start: 20, end: 80 });
  });
  it('end を範囲内で動かす', () => {
    expect(resolveRangeThumbValues('end', 73, { start: 0, end: 80 }, bounds)).toEqual({ start: 0, end: 75 });
  });
});
