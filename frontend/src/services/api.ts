const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface Movie {
  id: number;
  title: string;
  originalTitle?: string;
  poster?: string;
  overview?: string;
  year?: number;
  releaseDate?: string;
  rating?: number;
  voteCount?: number;
  popularity?: number;
  hasVideo?: boolean;
  trailer?: string;
  providers?: Array<{
    name: string;
    type: string; // 'flatrate', 'rent', 'buy'
    url: string;
    icon?: string;
  }>;
}

export const api = {
  /**
   * Performs the chunked streaming suggestions request
   */
  async suggestMovies(
    prompt: string,
    locale: string,
    onTitles: (titles: string[]) => void,
    onMovie: (movie: Movie) => void,
    onDone: () => void,
    onError: (err: any) => void
  ) {
    try {
      const response = await fetch(`${API_URL}/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, locale }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('ReadableStream not supported by response');
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        // Keep the last partial line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line);
            if (chunk.type === 'titles') {
              onTitles(chunk.data);
            } else if (chunk.type === 'movie') {
              onMovie(chunk.data);
            } else if (chunk.type === 'done') {
              onDone();
            } else if (chunk.type === 'error') {
              throw new Error(chunk.message || 'Stream processing error');
            }
          } catch (e) {
            console.error('Failed to parse NDJSON line:', line, e);
          }
        }
      }
    } catch (err: any) {
      onError(err);
    }
  },

  async getTrending(locale: string): Promise<Movie[]> {
    const response = await fetch(`${API_URL}/trending?locale=${locale}`);
    const result = await response.json();
    return result.success ? result.data : result;
  },

  async getPopular(locale: string): Promise<Movie[]> {
    const response = await fetch(`${API_URL}/popular?locale=${locale}`);
    const result = await response.json();
    return result.success ? result.data : result;
  },

  async getProviders(movieId: number, locale: string): Promise<any[]> {
    try {
      const response = await fetch(`${API_URL}/api/suggest/tmdb/providers/${movieId}?locale=${locale}`);
      if (!response.ok) return [];
      const result = await response.json();
      return result.success ? result.data : [];
    } catch (e) {
      console.error('Failed to fetch providers on-demand:', e);
      return [];
    }
  }
};
