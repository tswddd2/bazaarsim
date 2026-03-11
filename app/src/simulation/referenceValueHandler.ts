import type { DeckItem } from "../components/ItemDeck";
import { resolveNumericValue, type ValueContext } from "./valueHandler";

/**
 * @deprecated Use valueHandler.resolveNumericValue instead.
 */
export function calculateReferenceValue(
  item: DeckItem,
  referenceValue: unknown,
  context?: ValueContext
): number {
  return resolveNumericValue(item, referenceValue, context);
}
