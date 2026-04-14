// components/__tests__/RunDetail-search.test.ts
//
// Behavioral tests for the RunDetail agent search filter (BL-206 / EMU-3 Task 1).
// The script in RunDetail.astro reads `.em-search`, grabs `.em-agent-card`
// elements, and toggles `style.display` based on `data-agent-name` matches.
// We exercise the pure helpers (`matchesAgentSearch`, `applyAgentSearch`)
// using lightweight DOM-shaped fixtures so we do not need jsdom.

import { describe, it, expect } from 'vitest';
import {
  matchesAgentSearch,
  applyAgentSearch,
  type AgentCardLike,
} from '../../utils/agent-search.js';

function makeCards(names: string[]): AgentCardLike[] {
  return names.map(name => ({
    dataset: { agentName: name },
    style: { display: '' },
  }));
}

describe('matchesAgentSearch', () => {
  it('matches case-insensitive substrings', () => {
    expect(matchesAgentSearch('Alice', 'al')).toBe(true);
    expect(matchesAgentSearch('Alice', 'AL')).toBe(true);
    expect(matchesAgentSearch('Alice', 'lic')).toBe(true);
  });

  it('returns true for empty / whitespace-only queries (restore all)', () => {
    expect(matchesAgentSearch('Alice', '')).toBe(true);
    expect(matchesAgentSearch('Alice', '   ')).toBe(true);
  });

  it('returns false when the substring is absent', () => {
    expect(matchesAgentSearch('Alice', 'zzz')).toBe(false);
  });

  it('returns false when the agent has no name and the query is non-empty', () => {
    expect(matchesAgentSearch(undefined, 'al')).toBe(false);
  });
});

describe('applyAgentSearch', () => {
  it('shows only matching cards when typing "Al" (Alice/Bob/Carol fixture)', () => {
    const cards = makeCards(['Alice', 'Bob', 'Carol']);
    const visible = applyAgentSearch(cards, 'Al');
    expect(visible).toBe(1);
    expect(cards[0].style.display).toBe('');      // Alice visible
    expect(cards[1].style.display).toBe('none');  // Bob hidden
    expect(cards[2].style.display).toBe('none');  // Carol hidden
  });

  it('restores every card when the query is cleared', () => {
    const cards = makeCards(['Alice', 'Bob', 'Carol']);
    applyAgentSearch(cards, 'Al');                // hide Bob + Carol first
    const visible = applyAgentSearch(cards, '');  // then clear
    expect(visible).toBe(3);
    for (const card of cards) {
      expect(card.style.display).toBe('');
    }
  });

  it('hides all cards when no agent matches', () => {
    const cards = makeCards(['Alice', 'Bob', 'Carol']);
    const visible = applyAgentSearch(cards, 'zzz');
    expect(visible).toBe(0);
    for (const card of cards) {
      expect(card.style.display).toBe('none');
    }
  });

  it('matches case-insensitively across the full card set', () => {
    const cards = makeCards(['Alice', 'aloysius', 'Bob']);
    const visible = applyAgentSearch(cards, 'AL');
    expect(visible).toBe(2);
    expect(cards[0].style.display).toBe('');      // Alice
    expect(cards[1].style.display).toBe('');      // aloysius
    expect(cards[2].style.display).toBe('none');  // Bob
  });
});
