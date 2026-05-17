import { ref } from 'vue';

export type TabType = 'suggest' | 'trending' | 'popular' | 'watchlist';

const activeTab = ref<TabType>('suggest');

export function useTabs() {
  function setTab(tab: TabType) {
    activeTab.value = tab;
  }

  return {
    activeTab,
    setTab
  };
}
