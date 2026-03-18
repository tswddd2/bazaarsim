import type { DeckItem } from "../components/ItemDeck";
import { evaluateConditions } from "./conditionHandler";
import { resolveSubjectTargets } from "./subjectHandler";
import { resolveNumericValue } from "./valueHandler";
import {
  getPlayerStatusBySide,
  type PlayerSide,
  type PlayerState,
} from "./playerState";

import type { SimulationQueue } from "./eventSystem";

export interface ActionContext {
  items?: DeckItem[];
  sourceItem?: DeckItem;
  players?: PlayerState;
  sourcePlayer?: PlayerSide;
  result?: {
    totalDamage: number;
    cardEvents: Array<{ time: number; uid: string; damage: number }>;
  };
  eventTimeSeconds?: number;
}

/**
 * Execute an action from a triggered ability
 */
export function executeAction(
  item: DeckItem,
  action: any,
  context?: ActionContext,
  queue?: SimulationQueue
): void {
  if (!action) {
    console.warn("No action to execute");
    return;
  }

  const actionType = action.$type;

  switch (actionType) {
    case "TActionPlayerDamage":
      handlePlayerDamage(item, action, context);
      return;

    case "TActionCardModifyAttribute":
      handleCardModifyAttribute(item, action, context);
      return;

    case "TActionPlayerBurnApply":
      handlePlayerBurnApply(item, action, context, queue);
      return;

    case "TActionPlayerPoisonApply":
      handlePlayerPoisonApply(item, action, context, queue);
      return;

    default:
      console.warn(`Unhandled action type: ${actionType}`);
      return;
  }
}

function handlePlayerBurnApply(
  item: DeckItem,
  action: any,
  context?: ActionContext,
  queue?: SimulationQueue
): void {
  const playerState = context?.players;
  if (!playerState) {
    return;
  }

  const targets = resolveSubjectTargets(
    item,
    action?.Target,
    context?.items ?? [item],
    {
      sourcePlayer: context?.sourcePlayer ?? "Self",
    }
  ).players;
  if (targets.length === 0) {
    return;
  }

  const burnAmount =
    action?.ReferenceValue == null
      ? item.attributes.BurnApplyAmount ?? 0
      : resolveNumericValue(item, action.ReferenceValue, context);

  if (burnAmount <= 0) {
    return;
  }

  for (const targetSide of targets) {
    const targetStatus = getPlayerStatusBySide(playerState, targetSide);
    targetStatus.Burn += burnAmount;
  }

  if (queue) {
    queue.emitSignal({
      signalName: "TTriggerOnCardPerformedBurn",
      sourceItem: item,
    });
  }

  return;
}

function handlePlayerPoisonApply(
  item: DeckItem,
  action: any,
  context?: ActionContext,
  queue?: SimulationQueue
): void {
  const playerState = context?.players;
  if (!playerState) {
    return;
  }

  const targets = resolveSubjectTargets(
    item,
    action?.Target,
    context?.items ?? [item],
    {
      sourcePlayer: context?.sourcePlayer ?? "Self",
    }
  ).players;
  if (targets.length === 0) {
    return;
  }

  const poisonAmount =
    action?.ReferenceValue == null
      ? item.attributes.PoisonApplyAmount ?? 0
      : resolveNumericValue(item, action.ReferenceValue, context);

  if (poisonAmount <= 0) {
    return;
  }

  for (const targetSide of targets) {
    const targetStatus = getPlayerStatusBySide(playerState, targetSide);
    targetStatus.Poison += poisonAmount;
  }

  if (queue) {
    queue.emitSignal({
      signalName: "TTriggerOnCardPerformedPoison",
      sourceItem: item,
    });
  }

  return;
}

/**
 * Handle TActionPlayerDamage - deals damage to the opponent
 * For Katana, this uses the DamageAmount attribute
 */
function handlePlayerDamage(
  item: DeckItem,
  action: any,
  context?: ActionContext
): void {
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
    return;
  }

  // TODO: Apply damage modifiers:
  // - Critical hit multiplier
  // - Damage increase/decrease buffs
  // - Enemy armor/resistance

  const finalDamage = damage;

  if (finalDamage > 0) {
    if (context?.result) {
      context.result.totalDamage += finalDamage;
      context.result.cardEvents.push({
        time: context.eventTimeSeconds ?? 0,
        uid: item.uid,
        damage: finalDamage,
      });
    }
  }

  return;
}

/**
 * Handle TActionCardModifyAttribute - modifies one or more target item attributes.
 */
function handleCardModifyAttribute(
  sourceItem: DeckItem,
  action: any,
  context?: ActionContext
): void {
  const allItems = context?.items;
  if (!allItems || allItems.length === 0) {
    return;
  }

  const rawTargets = resolveSubjectTargets(
    sourceItem,
    action?.Target,
    allItems,
    {
      triggerSourceItem: context?.sourceItem,
      sourcePlayer: context?.sourcePlayer,
    }
  ).items;
  if (rawTargets.length === 0) {
    return;
  }

  const conditionPayload = action?.Target?.Conditions;
  const filteredTargets =
    conditionPayload == null
      ? rawTargets
      : rawTargets.filter((targetItem) =>
          evaluateConditions(conditionPayload, {
            sourceItem,
            items: allItems,
            triggerSourceItem: context?.sourceItem,
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
    return;
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

  return;
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
