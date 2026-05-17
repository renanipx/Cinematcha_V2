const { calculateJaroWinkler } = require('../similarity');

describe('Jaro-Winkler Similarity Utility Suite', () => {
  test('should return 1.0 for exact matches', () => {
    expect(calculateJaroWinkler('Inception', 'Inception')).toBe(1.0);
    expect(calculateJaroWinkler('  Matrix  ', 'matrix')).toBe(1.0);
  });

  test('should return high score for minor spelling variations', () => {
    const score = calculateJaroWinkler('Intersellar', 'Interstellar');
    expect(score).toBeGreaterThanOrEqual(0.9);
  });

  test('should return low score for complete mismatches', () => {
    const score = calculateJaroWinkler('Alien', 'The Martian');
    expect(score).toBeLessThan(0.6);
  });

  test('should handle null, empty, or undefined arguments gracefully by returning 0.0', () => {
    expect(calculateJaroWinkler(null, 'Inception')).toBe(0.0);
    expect(calculateJaroWinkler('Inception', '')).toBe(0.0);
    expect(calculateJaroWinkler(undefined, undefined)).toBe(0.0);
  });
});
