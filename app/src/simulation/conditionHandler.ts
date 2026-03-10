import type { DeckItem } from "../components/ItemDeck";

export interface ConditionContext {
  sourceItem: DeckItem;
  items: DeckItem[];
}

/**
 * Placeholder condition evaluator.
 * TODO: Implement full condition resolution.
 */
export function evaluateConditions(
  conditions: unknown,
  _context: ConditionContext
): boolean {
  if (conditions == null) {
    return true;
  }

  // Intentionally left empty for now.
  return true;
}
