import type { DeckItem } from "../components/ItemDeck";
import { evaluateConditions } from "./conditionHandler";
import { resolveSubjectItems } from "./subjectHandler";
import { resolveNumericValue } from "./valueHandler";

export interface ActionContext {
  items?: DeckItem[];
  firedItem?: DeckItem;
}

/**
 * Execute an action from a triggered ability
 * Returns the total damage dealt (0 if the action doesn't deal damage)
 */
export function executeAction(
  item: DeckItem,
  action: any,
  context?: ActionContext
): number {
  if (!action) {
    console.warn("No action to execute");
    return 0;
  }

  const actionType = action.$type;

  switch (actionType) {
    case "TActionPlayerDamage":
      return handlePlayerDamage(item, action, context);

    case "TActionCardModifyAttribute":
      return handleCardModifyAttribute(item, action, context);

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
function handlePlayerDamage(
  item: DeckItem,
  action: any,
  context?: ActionContext
): number {
  const damage =
    action?.ReferenceValue == null
      ? item.attributes.DamageAmount ?? 0
      : resolveNumericValue(item, action.ReferenceValue, context);

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
 * Handle TActionCardModifyAttribute - modifies one or more target item attributes.
 */
function handleCardModifyAttribute(
  sourceItem: DeckItem,
  action: any,
  context?: ActionContext
): number {
  const allItems = context?.items;
  if (!allItems || allItems.length === 0) {
    return 0;
  }

  const rawTargets = resolveSubjectItems(sourceItem, action?.Target, allItems, {
    triggerSourceItem: context?.firedItem,
  });
  if (rawTargets.length === 0) {
    return 0;
  }

  const conditionPayload = action?.Target?.Conditions;
  const filteredTargets =
    conditionPayload == null
      ? rawTargets
      : rawTargets.filter((targetItem) =>
          evaluateConditions(conditionPayload, {
            sourceItem,
            items: allItems,
            triggerSourceItem: context?.firedItem,
            currentItem: targetItem,
          })
        );

  const targetCount =
    typeof action?.TargetCount === "number" ? action.TargetCount : null;

  let targetsToModify = filteredTargets;
  if (targetCount !== null && targetCount < filteredTargets.length) {
    const shuffledTargets = [...filteredTargets];

    for (let i = shuffledTargets.length - 1; i > 0; i--) {
      const randomIndex = Math.floor(Math.random() * (i + 1));
      [shuffledTargets[i], shuffledTargets[randomIndex]] = [
        shuffledTargets[randomIndex],
        shuffledTargets[i],
      ];
    }

    targetsToModify = shuffledTargets.slice(0, targetCount);
  }

  const amount = resolveNumericValue(sourceItem, action?.Value, context);
  const attributeType = action?.AttributeType;
  const operation = action?.Operation ?? "Add";

  if (!attributeType || targetsToModify.length === 0) {
    return 0;
  }

  for (const targetItem of targetsToModify) {
    const runtimeTarget = targetItem as DeckItem & {
      initialAttributes?: Record<string, number>;
    };

    if (!runtimeTarget.initialAttributes) {
      runtimeTarget.initialAttributes = { ...runtimeTarget.attributes };
    }

    const currentValue = runtimeTarget.attributes[attributeType] ?? 0;
    runtimeTarget.attributes[attributeType] = applyAttributeOperation(
      currentValue,
      amount,
      operation
    );
  }

  return 0;
}
function applyAttributeOperation(
  currentValue: number,
  amount: number,
  operation: string
): number {
  switch (operation) {
    case "Add":
      return currentValue + amount;
    case "Subtract":
      return currentValue - amount;
    case "Multiply":
      return currentValue * amount;
    case "AdditiveMultiply":
      return currentValue + currentValue * amount;
    default:
      console.warn(`Unhandled attribute operation: ${operation}`);
      return currentValue;
  }
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
