import type { DeckItem } from "../components/ItemDeck";
import { executeAction } from "./actionHandler.ts";

/**
 * Trigger an ability based on its trigger type
 * Returns the total damage dealt (if any)
 */
export function triggerAbility(item: DeckItem, abilityId: string): number {
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
