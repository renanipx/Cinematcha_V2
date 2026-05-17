const { validateResponseContract } = require('../ai-validation.service');

describe('AI Response Validation Service Suite', () => {
  test('should validate and parse a clean list of 5 movies', () => {
    const raw = 'Inception, Interstellar, The Matrix, Pulp Fiction, Alien';
    const parsed = validateResponseContract(raw);
    
    expect(parsed).toEqual(['Inception', 'Interstellar', 'The Matrix', 'Pulp Fiction', 'Alien']);
  });

  test('should successfully strip numeric list prefixes', () => {
    const raw = '1. Inception, 2) The Matrix, 3 - Interstellar, 4. Pulp Fiction, 5) Alien';
    const parsed = validateResponseContract(raw);
    
    expect(parsed).toEqual(['Inception', 'The Matrix', 'Interstellar', 'Pulp Fiction', 'Alien']);
  });

  test('should reject conversational prose in English', () => {
    const raw = 'Sure! Here are some movies: Inception, Interstellar, The Matrix, Pulp Fiction, Alien';
    expect(() => validateResponseContract(raw)).toThrow('Response contains conversational prose filler.');
  });

  test('should reject conversational prose in Portuguese', () => {
    const raw = 'Claro! Aqui estão os filmes: O Clone, Matrix, Gladiator, Alien, Titanic';
    expect(() => validateResponseContract(raw)).toThrow('Response contains conversational prose filler.');
  });

  test('should reject if title count is below 5', () => {
    const raw = 'Inception, Interstellar, The Matrix';
    expect(() => validateResponseContract(raw)).toThrow('Response title count out of boundaries');
  });

  test('should reject if title count is above 10', () => {
    const raw = 'M1, M2, M3, M4, M5, M6, M7, M8, M9, M10, M11';
    expect(() => validateResponseContract(raw)).toThrow('Response title count out of boundaries');
  });

  test('should throw error for non-string or empty inputs', () => {
    expect(() => validateResponseContract(null)).toThrow();
    expect(() => validateResponseContract('')).toThrow();
  });
});
