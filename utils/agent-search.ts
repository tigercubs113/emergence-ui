// utils/agent-search.ts -- Pure helpers for the RunDetail agent search filter.
//
// Kept DOM-free so it can be unit tested without jsdom.  The Astro <script>
// tag in RunDetail.astro wires these to real elements.

export interface AgentCardLike {
  dataset: { agentName?: string };
  style: { display: string };
}

/**
 * Case-insensitive substring match.  Empty/whitespace-only query matches
 * everything (used to restore visibility when the input is cleared).
 */
export function matchesAgentSearch(name: string | undefined, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  if (!name) return false;
  return name.toLowerCase().includes(q);
}

/**
 * Toggle each card's `display` based on whether its `data-agent-name`
 * matches the query.  Visible cards get `''` (default), hidden get `'none'`.
 * Returns the count of cards that remained visible (handy for tests).
 */
export function applyAgentSearch<T extends AgentCardLike>(cards: T[], query: string): number {
  let visible = 0;
  for (const card of cards) {
    if (matchesAgentSearch(card.dataset.agentName, query)) {
      card.style.display = '';
      visible++;
    } else {
      card.style.display = 'none';
    }
  }
  return visible;
}
