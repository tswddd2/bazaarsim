import type { DeckItem } from "../components/ItemDeck";
import { executeAction } from "./actionHandler.ts";
import { resolveSubjectTargets } from "./subjectHandler";
import type { PlayerSide, PlayerState } from "./playerState";

export interface TriggerContext {
  items?: DeckItem[];
  firedItem?: DeckItem;
  players?: PlayerState;
  sourcePlayer?: PlayerSide;
  result?: {
    totalDamage: number;
    cardEvents: Array<{ time: number; uid: string; damage: number }>;
  };
  eventTimeSeconds?: number;
}

/**
 * Trigger an ability based on its trigger type
 */
export function triggerAbility(
  item: DeckItem,
  abilityId: string,
  context?: TriggerContext
): void {
  const ability = (item.card.Abilities as any)?.[abilityId];

  if (!ability) {
    console.warn(
      `Ability ${abilityId} not found on item ${item.card.InternalName}`
    );
    return;
  }

  const triggerType = ability.Trigger?.$type;

  // Handle different trigger types
  switch (triggerType) {
    case "TTriggerOnCardFired":
      handleOnCardFiredTrigger(item, ability, context);
      return;

    case "TTriggerOnItemUsed":
      handleOnItemUsedTrigger(item, ability, context);
      return;

    // TODO: Add other trigger types as needed:
    // case "TTriggerOnHit":
    //   return handleOnHitTrigger(item, ability);
    // case "TTriggerOnCrit":
    //   return handleOnCritTrigger(item, ability);
    // case "TTriggerOnKill":
    //   return handleOnKillTrigger(item, ability);

    default:
      console.warn(`Unhandled trigger type: ${triggerType}`);
      return;
  }
}

/**
 * Handle TTriggerOnCardFired - this trigger activates when the item's cooldown completes
 * It simply executes the associated action immediately
 */
function handleOnCardFiredTrigger(
  item: DeckItem,
  ability: any,
  context?: TriggerContext
): void {
  // TTriggerOnCardFired has no additional conditions - just execute the action
  executeAction(item, ability.Action, context);
}

/**
 * Handle TTriggerOnItemUsed - this trigger activates when any item is used
 * and the fired item is included in the resolved subject list
 */
function handleOnItemUsedTrigger(
  item: DeckItem,
  ability: any,
  context?: TriggerContext
): void {
  const firedItem = context?.firedItem;
  const items = context?.items;

  if (!firedItem || !items) {
    return;
  }

  const subject = ability?.Trigger?.Subject;
  const subjectItems = resolveSubjectTargets(item, subject, items, {
    triggerSourceItem: firedItem,
    sourcePlayer: context?.sourcePlayer,
  }).items;
  const shouldTrigger = subjectItems.some(
    (subjectItem: DeckItem) => subjectItem.uid === firedItem.uid
  );

  if (!shouldTrigger) {
    return;
  }

  executeAction(item, ability.Action, {
    items,
    firedItem,
    players: context?.players,
    sourcePlayer: context?.sourcePlayer,
    result: context?.result,
    eventTimeSeconds: context?.eventTimeSeconds,
  });
}

/**
 * Process all TTriggerOnItemUsed abilities for a single item-used event.
 */
export function triggerOnItemUsedAbilities(
  items: DeckItem[],
  firedItem: DeckItem,
  context?: Omit<TriggerContext, "items" | "firedItem">
): void {
  for (const item of items) {
    if (!item.abilityIds || item.abilityIds.length === 0) {
      continue;
    }

    for (const abilityId of item.abilityIds) {
      const ability = (item.card.Abilities as any)?.[abilityId];
      if (ability?.Trigger?.$type !== "TTriggerOnItemUsed") {
        continue;
      }

      triggerAbility(item, abilityId, {
        items,
        firedItem,
        players: context?.players,
        sourcePlayer: context?.sourcePlayer,
        result: context?.result,
        eventTimeSeconds: context?.eventTimeSeconds,
      });
    }
  }
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
