import { averageFromValues } from './rating-stats';

describe('averageFromValues', () => {
  it('returns a null average and zero count for no ratings', () => {
    expect(averageFromValues([])).toEqual({ average: null, count: 0 });
  });

  it('averages the values and rounds to two decimals', () => {
    expect(
      averageFromValues([{ value: 1 }, { value: 2 }, { value: 2 }]),
    ).toEqual({ average: 1.67, count: 3 });
  });
});
