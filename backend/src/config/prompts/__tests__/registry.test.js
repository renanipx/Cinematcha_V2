const { getPrompt, registry } = require('../registry');

describe('Prompt Registry Loader Suite', () => {
  const originalEnv = process.env.PROMPT_VERSION_OVERRIDE;

  beforeEach(() => {
    delete process.env.PROMPT_VERSION_OVERRIDE;
  });

  afterAll(() => {
    process.env.PROMPT_VERSION_OVERRIDE = originalEnv;
  });

  test('should load v1.0.0 successfully and interpolate prompt variables', () => {
    const prompt = getPrompt('1.0.0', 'en', 'space exploration');
    
    expect(prompt.systemPrompt).toBe('You are Cinematcha, an expert movie recommendation engine.');
    expect(prompt.userPrompt).toContain("mood or description: 'space exploration'");
    expect(prompt.parameters).toEqual({
      temperature: 0.7,
      topP: 0.9,
      maxOutputTokens: 500
    });
  });

  test('should load v1.1.0 and interpolate prompt variables in pt locale', () => {
    const prompt = getPrompt('1.1.0', 'pt', 'filmes espaciais');
    
    expect(prompt.systemPrompt).toBe('Você é o Cinematcha, um agente avançado especialista em recomendação de filmes.');
    expect(prompt.userPrompt).toContain("Analise o seguinte contexto: 'filmes espaciais'");
    expect(prompt.parameters).toEqual({
      temperature: 0.6,
      topP: 0.95,
      maxOutputTokens: 600
    });
  });

  test('should fallback to default en locale if unknown locale is provided', () => {
    const prompt = getPrompt('1.0.0', 'fr', 'french query');
    expect(prompt.systemPrompt).toBe('You are Cinematcha, an expert movie recommendation engine.');
  });

  test('should honor PROMPT_VERSION_OVERRIDE environment switch', () => {
    process.env.PROMPT_VERSION_OVERRIDE = '1.1.0';
    const prompt = getPrompt('1.0.0', 'en', 'sci-fi');
    expect(prompt.systemPrompt).toBe('You are Cinematcha, an advanced, highly specialized movie recommendation agent.');
  });

  test('should throw error for non-existent versions', () => {
    expect(() => getPrompt('9.9.9', 'en', 'sci-fi')).toThrow();
  });

  test('should deep copy parameters to prevent global state mutations', () => {
    const prompt1 = getPrompt('1.0.0', 'en', 'test');
    prompt1.parameters.temperature = 0.0;
    
    const prompt2 = getPrompt('1.0.0', 'en', 'test');
    expect(prompt2.parameters.temperature).toBe(0.7); // Remains original
  });
});
