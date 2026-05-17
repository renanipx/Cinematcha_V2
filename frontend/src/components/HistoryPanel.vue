<script setup lang="ts">
import { useMovies } from '../composables/useMovies';
import { useLanguage } from '../composables/useLanguage';

const { searchHistory, suggestMovie, clearHistory } = useMovies();
const { t } = useLanguage();

const emit = defineEmits<{
  (e: 'select-query', query: string): void
}>();

function clickPill(query: string, locale: string) {
  emit('select-query', query);
  suggestMovie(query, locale);
}
</script>

<template>
  <div v-if="searchHistory.length > 0" class="history-container glass-panel animate-fade-in">
    <div class="history-header">
      <h3>{{ t('historyTitle') }}</h3>
      <button class="btn-clear" @click="clearHistory">{{ t('clearHistory') }}</button>
    </div>
    <div class="history-scroll">
      <button
        v-for="(item, idx) in searchHistory"
        :key="idx"
        class="history-pill spring-hover"
        @click="clickPill(item.query, item.locale)"
      >
        <span class="query-text">{{ item.query }}</span>
        <span class="locale-tag">{{ item.locale.toUpperCase() }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.history-container {
  padding: 1.25rem;
  margin-bottom: 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

.history-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-header h3 {
  font-family: var(--font-heading);
  font-size: 1.1rem;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--text-primary);
}

.btn-clear {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: color var(--transition-fast);
}

.btn-clear:hover {
  color: var(--danger);
}

.history-scroll {
  display: flex;
  gap: 0.75rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
}

.history-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 50px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-glass);
  color: var(--text-secondary);
  font-family: var(--font-body);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: all var(--transition-fast);
}

.history-pill:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: var(--primary-glow);
  color: var(--primary);
}

.locale-tag {
  font-size: 0.65rem;
  font-weight: 800;
  color: var(--bg-dark);
  background: var(--text-muted);
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
}

.history-pill:hover .locale-tag {
  background: var(--primary);
}
</style>
