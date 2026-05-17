import { ref } from 'vue';

export const translations = {
  en: {
    title: 'Cinematcha',
    subtitle: 'Smart AI-Powered Movie Recommendations',
    searchPlaceholder: 'e.g., A Mind-bending sci-fi with time travel like Interstellar...',
    searchBtn: 'Match Movies',
    loading: 'Orchestrating Gemini & TMDB...',
    trendingTab: 'Trending',
    popularTab: 'Popular',
    watchlistTab: 'My Watchlist',
    historyTitle: 'Recent Searches',
    clearHistory: 'Clear History',
    watchlistEmpty: 'Your Watchlist is empty',
    watchlistGuide: 'Browse popular or search for films to compile your personal watchlist.',
    backToSearch: 'Start Searching',
    noSuggestions: 'No suggestions yet. Enter a prompt above to match movies!',
    rating: 'Rating',
    votes: 'votes',
    providersTitle: 'Where to Watch',
    trailerBtn: 'Watch Trailer',
    closeBtn: 'Close',
    addToWatchlist: 'Add to Watchlist',
    removeFromWatchlist: 'In Watchlist',
    warningLimit: 'Watchlist is capped at 100 movies. Evict some entries to add new ones!',
    errorFallback: 'We hit a snag connecting to our AI cascade. Please retry in a bit.'
  },
  pt: {
    title: 'Cinematcha',
    subtitle: 'Recomendações Inteligentes de Filmes por IA',
    searchPlaceholder: 'ex: Um sci-fi intrigante com viagem no tempo como Interestelar...',
    searchBtn: 'Encontrar Filmes',
    loading: 'Orquestrando Gemini & TMDB...',
    trendingTab: 'Em Alta',
    popularTab: 'Populares',
    watchlistTab: 'Minha Lista',
    historyTitle: 'Buscas Recentes',
    clearHistory: 'Limpar Histórico',
    watchlistEmpty: 'Sua lista está vazia',
    watchlistGuide: 'Navegue pelos populares ou busque filmes para montar sua lista personalizada.',
    backToSearch: 'Começar Busca',
    noSuggestions: 'Nenhuma sugestão ainda. Digite algo acima para encontrar filmes!',
    rating: 'Nota',
    votes: 'votos',
    providersTitle: 'Onde Assistir',
    trailerBtn: 'Ver Trailer',
    closeBtn: 'Fechar',
    addToWatchlist: 'Adicionar à Lista',
    removeFromWatchlist: 'Na Minha Lista',
    warningLimit: 'Sua lista está limitada a 100 filmes. Remova alguns para adicionar novos!',
    errorFallback: 'Houve um problema de conexão com a IA. Tente novamente em breve.'
  }
};

type Locale = 'en' | 'pt';

const currentLocale = ref<Locale>('en');

export function useLanguage() {
  function setLanguage(lang: Locale) {
    currentLocale.value = lang;
    try {
      localStorage.setItem('cinematcha_locale_v1', lang);
    } catch (e) {
      console.warn('LocalStorage not available for saving locale preference');
    }
  }

  // Load from local storage if available
  try {
    const savedLocale = localStorage.getItem('cinematcha_locale_v1') as Locale;
    if (savedLocale === 'en' || savedLocale === 'pt') {
      currentLocale.value = savedLocale;
    }
  } catch (e) {
    console.warn('LocalStorage not available for loading locale preference');
  }

  const t = (key: keyof typeof translations.en) => {
    return translations[currentLocale.value][key] || translations.en[key] || String(key);
  };

  return {
    locale: currentLocale,
    setLanguage,
    t
  };
}
