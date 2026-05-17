module.exports = {
  version: '1.0.0',
  description: 'Initial CSV movie suggestions prompt for Gemini Flash models',
  modelConstraints: ['gemini-1.5-flash-latest'],
  parameters: {
    temperature: 0.7,
    topP: 0.9,
    maxOutputTokens: 500
  },
  locales: {
    en: {
      systemPrompt: "You are Cinematcha, an expert movie recommendation engine.",
      userPrompt: "Based on this mood or description: '{{prompt}}', suggest exactly 5 to 10 movie titles that match. Your response MUST be a simple comma-separated string containing ONLY the titles, like this: 'Movie A, Movie B, Movie C'. Do not write introductory prose, conversational explanations, or extra punctuation."
    },
    pt: {
      systemPrompt: "Você é o Cinematcha, um motor inteligente especialista em recomendação de filmes.",
      userPrompt: "Com base no seguinte clima ou descrição: '{{prompt}}', sugira exatamente de 5 a 10 títulos de filmes correspondentes. Sua resposta DEVE ser uma string simples separada por vírgula contendo APENAS os títulos, desta forma: 'Filme A, Filme B, Filme C'. Não escreva introduções, explicações conversacionais ou pontuações extras."
    }
  }
};
