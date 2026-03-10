import type { DeckItem } from "../components/ItemDeck";
import { calculateReferenceValue } from "./referenceValueHandler";

/**
 * Execute an action from a triggered ability
 * Returns the total damage dealt (0 if the action doesn't deal damage)
 */
export function executeAction(item: DeckItem, action: any): number {
  if (!action) {
    console.warn("No action to execute");
    return 0;
  }

  const actionType = action.$type;

  switch (actionType) {
    case "TActionPlayerDamage":
      return handlePlayerDamage(item, action);

    // TODO: Implement other action types:
    // case "TActionPlayerHeal":
    //   return handlePlayerHeal(item, action);
    // case "TActionModifyItemAttribute":
    //   return handleModifyItemAttribute(item, action);
    // case "TActionBurn":
    //   return handleBurn(item, action);
    // case "TActionFreeze":
    //   return handleFreeze(item, action);
    // case "TActionPoison":
    //   return handlePoison(item, action);
    // case "TActionSlow":
    //   return handleSlow(item, action);
    // case "TActionHaste":
    //   return handleHaste(item, action);
    // case "TActionShield":
    //   return handleShield(item, action);

    default:
      console.warn(`Unhandled action type: ${actionType}`);
      return 0;
  }
}

/**
 * Handle TActionPlayerDamage - deals damage to the opponent
 * For Katana, this uses the DamageAmount attribute
 */
function handlePlayerDamage(item: DeckItem, action: any): number {
  const damage =
    action?.ReferenceValue == null
      ? item.attributes.DamageAmount ?? 0
      : calculateReferenceValue(item, action.ReferenceValue);

  const isOpponentRelativeTarget =
    action?.Target?.$type === "TTargetPlayerRelative" &&
    action?.Target?.TargetMode === "Opponent" &&
    action?.Target?.Conditions === null;

  if (!isOpponentRelativeTarget) {
    console.log("Unhandled TActionPlayerDamage target:", action?.Target);
    return 0;
  }

  // TODO: Apply damage modifiers:
  // - Critical hit multiplier
  // - Damage increase/decrease buffs
  // - Enemy armor/resistance

  const finalDamage = damage;

  return finalDamage;
}

/**
 * Handle TActionPlayerHeal - heals the player
 */
// @ts-ignore - TODO: Implement healing logic
function handlePlayerHeal(item: DeckItem, action: any): number {
  // TODO: Implement healing logic
  return 0;
}

/**
 * Handle TActionModifyItemAttribute - modifies an item's attribute
 */
// @ts-ignore - TODO: Implement attribute modification logic
function handleModifyItemAttribute(item: DeckItem, action: any): number {
  // TODO: Implement attribute modification logic
  return 0;
}

/**
 * Handle TActionBurn - applies burn effect
 */
// @ts-ignore - TODO: Implement burn logic
function handleBurn(item: DeckItem, action: any): number {
  // TODO: Implement burn logic
  return 0;
}

/**
 * Handle TActionFreeze - applies freeze effect
 */
// @ts-ignore - TODO: Implement freeze logic
function handleFreeze(item: DeckItem, action: any): number {
  // TODO: Implement freeze logic
  return 0;
}

/**
 * Handle TActionPoison - applies poison effect
 */
// @ts-ignore - TODO: Implement poison logic
function handlePoison(item: DeckItem, action: any): number {
  // TODO: Implement poison logic
  return 0;
}

/**
 * Handle TActionSlow - applies slow effect
 */
// @ts-ignore - TODO: Implement slow logic
function handleSlow(item: DeckItem, action: any): number {
  // TODO: Implement slow logic
  return 0;
}

/**
 * Handle TActionHaste - applies haste effect
 */
// @ts-ignore - TODO: Implement haste logic
function handleHaste(item: DeckItem, action: any): number {
  // TODO: Implement haste logic
  return 0;
}

/**
 * Handle TActionShield - applies shield effect
 */
// @ts-ignore - TODO: Implement shield logic
function handleShield(item: DeckItem, action: any): number {
  // TODO: Implement shield logic
  return 0;
}
