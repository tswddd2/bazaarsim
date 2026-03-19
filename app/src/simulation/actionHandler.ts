import type { DeckItem, SimDeckItem } from "../components/ItemDeck";
import { evaluateConditions } from "./conditionHandler";
import { resolveSubjectTargets } from "./subjectHandler";
import { resolveNumericValue } from "./valueHandler";
import {
  getPlayerStatusBySide,
  type PlayerSide,
  type PlayerState,
} from "./playerState";

import type { SimulationQueue } from "./eventSystem";
import type { BattleStats } from "./cooldownManager";

export interface ActionContext {
  items: SimDeckItem[];
  sourceItem?: DeckItem;
  players: PlayerState;
  sourcePlayer: PlayerSide;
  battleStats: BattleStats;
  eventTimeSeconds: number;
}

/**
 * Execute an action from a triggered ability
 */
export function executeAction(
  item: DeckItem,
  action: any,
  context: ActionContext,
  queue: SimulationQueue
): void {
  if (!action) {
    console.warn("No action to execute");
    return;
  }

  const actionType = action.$type;

  switch (actionType) {
    case "TActionPlayerDamage":
      return handlePlayerDamage(item, action, context, queue);
    case "TActionCardModifyAttribute":
      return handleCardModifyAttribute(item, action, context, queue);
    case "TActionPlayerBurnApply":
      return handlePlayerBurnApply(item, action, context, queue);
    case "TActionPlayerPoisonApply":
      return handlePlayerPoisonApply(item, action, context, queue);
    case "TActionCardForceUse":
      return handleCardForceUse(item, action, context, queue);
    case "TActionBeforeItemUsed":
      return handleActionBeforeItemUsed(item, action, context, queue);
    case "TActionItemUsed":
      return handleActionItemUsed(item, action, context, queue);

    default:
      console.warn(`Unhandled action type: ${actionType}`);
      return;
  }
}

function handleActionBeforeItemUsed(
  item: DeckItem,
  _action: any,
  _context: ActionContext,
  queue: SimulationQueue
): void {
  queue.emitSignal({
    signalName: "TTriggerOnBeforeItemUsed",
    sourceItem: item,
  });
}

function handleActionItemUsed(
  item: DeckItem,
  _action: any,
  _context: ActionContext,
  queue: SimulationQueue
): void {
  const simItem = item as SimDeckItem;
  simItem.simStats.itemUsed += 1;

  queue.emitSignal({
    signalName: "TTriggerOnItemUsed",
    sourceItem: item,
  });
}

function handlePlayerBurnApply(
  item: DeckItem,
  action: any,
  context: ActionContext,
  queue: SimulationQueue
): void {
  const playerState = context.players;

  const targets = resolveSubjectTargets(item, action?.Target, context.items, {
    sourcePlayer: context.sourcePlayer,
  }).players;
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

  (item as SimDeckItem).simStats.burnApplied += burnAmount;

  queue.emitSignal({
    signalName: "TTriggerOnCardPerformedBurn",
    sourceItem: item,
  });

  return;
}

function handlePlayerPoisonApply(
  item: DeckItem,
  action: any,
  context: ActionContext,
  queue: SimulationQueue
): void {
  const playerState = context.players;

  const targets = resolveSubjectTargets(item, action?.Target, context.items, {
    sourcePlayer: context.sourcePlayer,
  }).players;
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

  (item as SimDeckItem).simStats.poisonApplied += poisonAmount;

  queue.emitSignal({
    signalName: "TTriggerOnCardPerformedPoison",
    sourceItem: item,
  });

  return;
}

function handleCardForceUse(
  sourceItem: DeckItem,
  action: any,
  context: ActionContext,
  queue: SimulationQueue
): void {
  const rawTargets = resolveSubjectTargets(
    sourceItem,
    action?.Target,
    context.items,
    {
      triggerSourceItem: context.sourceItem,
      sourcePlayer: context.sourcePlayer,
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
            items: context.items,
            triggerSourceItem: context.sourceItem,
            currentItem: targetItem,
          })
        );

  const targetCount =
    typeof action?.TargetCount === "number" ? action.TargetCount : null;

  let targetsToUse = filteredTargets;
  if (targetCount !== null && targetCount < filteredTargets.length) {
    const shuffledTargets = [...filteredTargets];

    for (let i = shuffledTargets.length - 1; i > 0; i--) {
      const randomIndex = Math.floor(Math.random() * (i + 1));
      [shuffledTargets[i], shuffledTargets[randomIndex]] = [
        shuffledTargets[randomIndex],
        shuffledTargets[i],
      ];
    }

    targetsToUse = shuffledTargets.slice(0, targetCount);
  }

  for (const targetItem of targetsToUse) {
    queue.emitSignal({
      signalName: `TTriggerOnCardFired-${targetItem.uid}`,
      sourceItem: targetItem,
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
  context: ActionContext,
  _queue: SimulationQueue
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
    console.warn("Unhandled TActionPlayerDamage target:", action?.Target);
    return;
  }

  // TODO: Apply damage modifiers:
  // - Critical hit multiplier
  // - Damage increase/decrease buffs
  // - Enemy armor/resistance

  const finalDamage = damage;

  if (finalDamage > 0) {
    context.battleStats.totalDamage += finalDamage;
    (item as SimDeckItem).simStats.weaponDamage += finalDamage;
  }

  return;
}

/**
 * Handle TActionCardModifyAttribute - modifies one or more target item attributes.
 */
function handleCardModifyAttribute(
  sourceItem: DeckItem,
  action: any,
  context: ActionContext,
  _queue: SimulationQueue
): void {
  const rawTargets = resolveSubjectTargets(
    sourceItem,
    action?.Target,
    context.items,
    {
      triggerSourceItem: context.sourceItem,
      sourcePlayer: context.sourcePlayer,
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
            items: context.items,
            triggerSourceItem: context.sourceItem,
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
