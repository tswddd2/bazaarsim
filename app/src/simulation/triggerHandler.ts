import type { SimDeckItem } from "../components/ItemDeck";
import { type ActionContext } from "./actionHandler";
import { resolveSubjectTargets } from "./subjectHandler";
import type { SimulationQueue, SignalEvent } from "./eventSystem";

export interface TriggerContext extends ActionContext {}

interface TriggerHandlerParams {
  item: SimDeckItem;
  ability: any;
  event: SignalEvent;
  context: ActionContext;
  queue: SimulationQueue;
}

export function triggerAbilityListener(
  item: SimDeckItem,
  ability: any,
  event: SignalEvent,
  context: ActionContext,
  queue: SimulationQueue
): void {
  const triggerType = ability.Trigger?.$type;
  const params: TriggerHandlerParams = {
    item,
    ability,
    event,
    context,
    queue,
  };

  switch (triggerType) {
    case "TTriggerOnCardFired":
      handleOnCardFiredTrigger(params);
      return;

    case "TTriggerOnBeforeItemUsed":
      handleOnBeforeItemUsedTrigger(params);
      return;

    case "TTriggerOnItemUsed":
      handleOnItemUsedTrigger(params);
      return;

    case "TTriggerOnCardPerformedBurn":
      handleOnCardPerformedBurnTrigger(params);
      return;

    case "TTriggerOnCardPerformedPoison":
      handleOnCardPerformedPoisonTrigger(params);
      return;

    default:
      console.warn(`Unhandled trigger type: ${triggerType}`);
      return;
  }
}

function handleOnCardFiredTrigger({
  item,
  ability,
  context,
  queue,
}: TriggerHandlerParams): void {
  queue.pushAction({ item, action: ability.Action, context });
}

function handleOnBeforeItemUsedTrigger({
  item,
  ability,
  event,
  context,
  queue,
}: TriggerHandlerParams): void {
  const firedItem = event.sourceItem!;
  const items = context.items;

  const subject = ability?.Trigger?.Subject;
  const subjectItems = resolveSubjectTargets(item, subject, items, {
    triggerSourceItem: firedItem,
    sourcePlayer: context.sourcePlayer,
  }).items;

  if (!subjectItems.map((i) => i.uid).includes(firedItem.uid)) {
    return;
  }

  queue.pushAction({
    item,
    action: ability.Action,
    context: { ...context, sourceItem: firedItem },
  });
}

function handleOnItemUsedTrigger({
  item,
  ability,
  event,
  context,
  queue,
}: TriggerHandlerParams): void {
  const firedItem = event.sourceItem!;
  const items = context.items;

  const subject = ability?.Trigger?.Subject;
  const subjectItems = resolveSubjectTargets(item, subject, items, {
    triggerSourceItem: firedItem,
    sourcePlayer: context.sourcePlayer,
  }).items;

  if (!subjectItems.map((i) => i.uid).includes(firedItem.uid)) {
    return;
  }

  queue.pushAction({
    item,
    action: ability.Action,
    context: { ...context, sourceItem: firedItem },
  });
}

function handleOnCardPerformedBurnTrigger({
  item,
  ability,
  event,
  context,
  queue,
}: TriggerHandlerParams): void {
  const firedItem = event.sourceItem!;
  const items = context.items;

  const subject = ability?.Trigger?.Subject;
  const subjectItems = resolveSubjectTargets(item, subject, items, {
    triggerSourceItem: firedItem,
    sourcePlayer: context.sourcePlayer,
  }).items;

  if (!subjectItems.map((i) => i.uid).includes(firedItem.uid)) {
    return;
  }

  queue.pushAction({
    item,
    action: ability.Action,
    context: { ...context, sourceItem: firedItem },
  });
}

function handleOnCardPerformedPoisonTrigger({
  item,
  ability,
  event,
  context,
  queue,
}: TriggerHandlerParams): void {
  const firedItem = event.sourceItem!;
  const items = context.items;

  const subject = ability?.Trigger?.Subject;
  const subjectItems = resolveSubjectTargets(item, subject, items, {
    triggerSourceItem: firedItem,
    sourcePlayer: context.sourcePlayer,
  }).items;

  if (!subjectItems.map((i) => i.uid).includes(firedItem.uid)) {
    return;
  }
  queue.pushAction({
    item,
    action: ability.Action,
    context: { ...context, sourceItem: firedItem },
  });
}
