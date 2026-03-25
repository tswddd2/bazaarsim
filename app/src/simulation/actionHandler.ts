import type { SimDeckItem } from "../components/ItemDeck";
import { resolveSubjectTargets } from "./subjectHandler";
import { resolveValue } from "./valueHandler";
import {
  getPlayerStatusBySide,
  type PlayerSide,
  type PlayerState,
} from "./playerState";

import type { SimulationQueue } from "./eventSystem";
import type { BattleStats } from "./cooldownManager";

export interface ActionContext {
  items: SimDeckItem[];
  sourceItem?: SimDeckItem;
  players: PlayerState;
  sourcePlayer: PlayerSide;
  battleStats: BattleStats;
  eventTimeSeconds: number;
}

/**
 * Execute an action from a triggered ability
 */
export function executeAction(
  item: SimDeckItem,
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
    case "TActionCardCharge":
      return handleCardCharge(item, action, context, queue);
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
  item: SimDeckItem,
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
  item: SimDeckItem,
  _action: any,
  _context: ActionContext,
  queue: SimulationQueue
): void {
  item.simStats.itemUsed += 1;

  queue.emitSignal({
    signalName: "TTriggerOnItemUsed",
    sourceItem: item,
  });
}

function handlePlayerBurnApply(
  item: SimDeckItem,
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
      ? item.attributes.BurnApplyAmount
      : resolveValue(item, action.ReferenceValue, context);

  for (const targetSide of targets) {
    const targetStatus = getPlayerStatusBySide(playerState, targetSide);
    targetStatus.Burn += burnAmount;
  }

  item.simStats.burnApplied += burnAmount;

  queue.emitSignal({
    signalName: "TTriggerOnCardPerformedBurn",
    sourceItem: item,
  });

  return;
}

function handlePlayerPoisonApply(
  item: SimDeckItem,
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
      : resolveValue(item, action.ReferenceValue, context);

  if (poisonAmount <= 0) {
    return;
  }

  for (const targetSide of targets) {
    const targetStatus = getPlayerStatusBySide(playerState, targetSide);
    targetStatus.Poison += poisonAmount;
  }

  item.simStats.poisonApplied += poisonAmount;

  queue.emitSignal({
    signalName: "TTriggerOnCardPerformedPoison",
    sourceItem: item,
  });

  return;
}

function handleCardForceUse(
  sourceItem: SimDeckItem,
  action: any,
  context: ActionContext,
  queue: SimulationQueue
): void {
  const targets = resolveSubjectTargets(
    sourceItem,
    action?.Target,
    context.items,
    {
      triggerSourceItem: context.sourceItem,
      sourcePlayer: context.sourcePlayer,
    }
  ).items;

  if (targets.length === 0) {
    return;
  }

  const targetCount = action?.TargetCount
    ? resolveValue(sourceItem, action.TargetCount, context)
    : sourceItem.attributes.ForceUseTargets ?? null;

  let targetsToUse = targets;
  if (targetCount !== null && targetCount < targets.length) {
    targetsToUse = pickRandom(targets, targetCount);
  }

  for (const targetItem of targetsToUse) {
    queue.emitSignal({
      signalName: `TTriggerOnCardFired-${targetItem.uid}`,
      sourceItem: targetItem,
    });
  }

  return;
}

function handlePlayerDamage(
  item: SimDeckItem,
  action: any,
  context: ActionContext,
  _queue: SimulationQueue
): void {
  const damage =
    action?.ReferenceValue == null
      ? item.attributes.DamageAmount ?? 0
      : resolveValue(item, action.ReferenceValue, context);

  const isOpponentRelativeTarget =
    action?.Target?.$type === "TTargetPlayerRelative" &&
    action?.Target?.TargetMode === "Opponent" &&
    action?.Target?.Conditions === null;

  if (!isOpponentRelativeTarget) {
    console.warn("Unhandled TActionPlayerDamage target:", action?.Target);
    return;
  }

  const finalDamage = damage;

  if (finalDamage > 0) {
    context.battleStats.totalDamage += finalDamage;
    item.simStats.weaponDamage += finalDamage;
  }

  return;
}

function handleCardModifyAttribute(
  sourceItem: SimDeckItem,
  action: any,
  context: ActionContext,
  _queue: SimulationQueue
): void {
  const targets = resolveSubjectTargets(
    sourceItem,
    action?.Target,
    context.items,
    {
      triggerSourceItem: context.sourceItem,
      sourcePlayer: context.sourcePlayer,
    }
  ).items;
  if (targets.length === 0) {
    return;
  }

  const targetCount = action?.TargetCount
    ? resolveValue(sourceItem, action.TargetCount, context)
    : null;

  let targetsToModify = targets;
  if (targetCount !== null && targetCount < targets.length) {
    targetsToModify = pickRandom(targets, targetCount);
  }

  const amount = resolveValue(sourceItem, action?.Value, context);
  const attributeType = action?.AttributeType;
  const operation = action?.Operation ?? "Add";

  if (!attributeType || targetsToModify.length === 0) {
    return;
  }

  for (const target of targetsToModify) {
    const currentValue = target.attributes[attributeType] ?? 0;
    target.attributes[attributeType] = applyAttributeOperation(
      currentValue,
      amount,
      operation
    );
  }

  return;
}

function handleCardCharge(
  sourceItem: SimDeckItem,
  action: any,
  context: ActionContext,
  queue: SimulationQueue
): void {
  const targets = resolveSubjectTargets(
    sourceItem,
    action?.Target,
    context.items,
    {
      triggerSourceItem: context.sourceItem,
      sourcePlayer: context.sourcePlayer,
    }
  ).items;

  if (targets.length === 0) {
    return;
  }

  const chargeAmount =
    action?.ReferenceValue != null
      ? resolveValue(sourceItem, action.ReferenceValue, context)
      : sourceItem.attributes.ChargeAmount ?? 0;

  const targetCount = action?.TargetCount
    ? resolveValue(sourceItem, action.TargetCount, context)
    : sourceItem.attributes.ChargeTargets ?? null;

  let targetsToCharge = targets;
  if (targetCount !== null && targetCount < targets.length) {
    targetsToCharge = pickRandom(targets, targetCount);
  }

  for (const targetItem of targetsToCharge) {
    if (
      targetItem.attributes.CooldownMax <= 0 ||
      targetItem.attributes.CooldownDisabled
    )
      continue;

    targetItem.attributes.Cooldown -= chargeAmount;

    if (targetItem.attributes.Cooldown <= 0) {
      targetItem.attributes.Cooldown = targetItem.attributes.CooldownMax;
      queue.emitSignal({
        signalName: `TTriggerOnCardFired-${targetItem.uid}`,
        sourceItem: targetItem,
      });
    }
  }
}

function pickRandom<T>(items: T[], count: number): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const randomIndex = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[i]];
  }
  return shuffled.slice(0, count);
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
