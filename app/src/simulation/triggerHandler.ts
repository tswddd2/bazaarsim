import type { DeckItem } from "../components/ItemDeck";
import { executeAction } from "./actionHandler.ts";
import { resolveSubjectItems } from "./subjectHandler";

export interface TriggerContext {
  items?: DeckItem[];
  firedItem?: DeckItem;
}

/**
 * Trigger an ability based on its trigger type
 * Returns the total damage dealt (if any)
 */
export function triggerAbility(
  item: DeckItem,
  abilityId: string,
  context?: TriggerContext
): number {
  const ability = (item.card.Abilities as any)?.[abilityId];

  if (!ability) {
    console.warn(
      `Ability ${abilityId} not found on item ${item.card.InternalName}`
    );
    return 0;
  }

  const triggerType = ability.Trigger?.$type;

  // Handle different trigger types
  switch (triggerType) {
    case "TTriggerOnCardFired":
      return handleOnCardFiredTrigger(item, ability);

    case "TTriggerOnItemUsed":
      return handleOnItemUsedTrigger(item, ability, context);

    // TODO: Add other trigger types as needed:
    // case "TTriggerOnHit":
    //   return handleOnHitTrigger(item, ability);
    // case "TTriggerOnCrit":
    //   return handleOnCritTrigger(item, ability);
    // case "TTriggerOnKill":
    //   return handleOnKillTrigger(item, ability);

    default:
      console.warn(`Unhandled trigger type: ${triggerType}`);
      return 0;
  }
}

/**
 * Handle TTriggerOnCardFired - this trigger activates when the item's cooldown completes
 * It simply executes the associated action immediately
 */
function handleOnCardFiredTrigger(item: DeckItem, ability: any): number {
  // TTriggerOnCardFired has no additional conditions - just execute the action
  return executeAction(item, ability.Action);
}

/**
 * Handle TTriggerOnItemUsed - this trigger activates when any item is used
 * and the fired item is included in the resolved subject list
 */
function handleOnItemUsedTrigger(
  item: DeckItem,
  ability: any,
  context?: TriggerContext
): number {
  const firedItem = context?.firedItem;
  const items = context?.items;

  if (!firedItem || !items) {
    return 0;
  }

  const subject = ability?.Trigger?.Subject;
  const subjectItems = resolveSubjectItems(item, subject, items);
  const shouldTrigger = subjectItems.some(
    (subjectItem: DeckItem) => subjectItem.uid === firedItem.uid
  );

  if (!shouldTrigger) {
    return 0;
  }

  return executeAction(item, ability.Action);
}

/**
 * Process all TTriggerOnItemUsed abilities for a single item-used event.
 */
export function triggerOnItemUsedAbilities(
  items: DeckItem[],
  firedItem: DeckItem
): Array<{ item: DeckItem; abilityId: string; damage: number }> {
  const results: Array<{ item: DeckItem; abilityId: string; damage: number }> =
    [];

  for (const item of items) {
    if (!item.abilityIds || item.abilityIds.length === 0) {
      continue;
    }

    for (const abilityId of item.abilityIds) {
      const ability = (item.card.Abilities as any)?.[abilityId];
      if (ability?.Trigger?.$type !== "TTriggerOnItemUsed") {
        continue;
      }

      const damage = triggerAbility(item, abilityId, {
        items,
        firedItem,
      });

      if (damage > 0) {
        results.push({ item, abilityId, damage });
      }
    }
  }

  return results;
}

/**
 * Check if a trigger's prerequisites are met
 * Returns true if all prerequisites are satisfied (or if there are no prerequisites)
 */
export function checkPrerequisites(
  _item: DeckItem,
  prerequisites: any
): boolean {
  if (!prerequisites) {
    return true; // No prerequisites means always satisfied
  }

  // TODO: Implement prerequisite checking logic
  // This would check conditions like:
  // - Minimum/maximum attribute values
  // - Specific tags or heroes
  // - Game state conditions

  return true;
}

/**
 * Get the multicast count for an item (how many times it fires)
 */
export function getMulticastCount(item: DeckItem): number {
  return item.attributes.Multicast ?? 1;
}
