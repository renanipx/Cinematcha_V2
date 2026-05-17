module.exports = {
  version: '1.1.0',
  description: 'Next-gen prompt module featuring updated instruction structures and optimized JSON-formatting guidelines',
  modelConstraints: ['gemini-1.5-flash-latest', 'gemini-1.5-pro'],
  parameters: {
    temperature: 0.6,
    topP: 0.95,
    maxOutputTokens: 600
  },
  locales: {
    en: {
      systemPrompt: "You are Cinematcha, an advanced, highly specialized movie recommendation agent.",
      userPrompt: "Analyze this context: '{{prompt}}'. Suggest exactly 5 to 10 movie titles that match. Return a plain comma-separated list of titles only. Absolutely no other characters, numbering, or introductory chatter. Format: Title A, Title B, Title C"
    },
    pt: {
      systemPrompt: "Você é o Cinematcha, um agente avançado especialista em recomendação de filmes.",
      userPrompt: "Analise o seguinte contexto: '{{prompt}}'. Sugira exatamente de 5 a 10 títulos de filmes correspondentes. Retorne uma lista simples de títulos separados por vírgula. Absolutamente nenhum outro caractere, numeração ou conversa introdutória. Formato: Título A, Título B, Título C"
    }
  }
};
