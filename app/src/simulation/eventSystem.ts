import type { DeckItem } from "../components/ItemDeck";
import { executeAction, type ActionContext } from "./actionHandler";
import { triggerAbilityListener } from "./triggerHandler";

export interface SignalEvent {
  signalName: string;
  sourceItem?: DeckItem;
}

export interface ActionEvent {
  item: DeckItem;
  action: any;
  context: ActionContext;
}

export class SimulationQueue {
  private signalQueue: SignalEvent[] = [];
  private actionQueue: ActionEvent[] = [];
  private listeners: Map<string, Array<(event: SignalEvent) => void>> =
    new Map();

  public on(signalName: string, listener: (event: SignalEvent) => void) {
    if (!this.listeners.has(signalName)) {
      this.listeners.set(signalName, []);
    }
    this.listeners.get(signalName)!.push(listener);
  }

  public emitSignal(event: SignalEvent) {
    this.signalQueue.push(event);
  }

  public pushAction(action: ActionEvent) {
    this.actionQueue.push(action);
  }

  public registerTriggers(items: DeckItem[], context: ActionContext) {
    for (const item of items) {
      if (!item.abilityIds || item.abilityIds.length === 0) continue;
      for (const abilityId of item.abilityIds) {
        const ability = (item.card.Abilities as any)?.[abilityId];
        if (!ability || !ability.Trigger) continue;

        const triggerType = ability.Trigger.$type;
        let signalName = triggerType;
        if (triggerType === "TTriggerOnCardFired") {
          signalName = `${triggerType}-${item.uid}`;
        }

        this.on(signalName, (event) => {
          triggerAbilityListener(item, ability, event, context, this);
        });
      }
    }
  }

  public processQueues(timeSeconds?: number) {
    while (this.signalQueue.length > 0 || this.actionQueue.length > 0) {
      while (this.signalQueue.length > 0) {
        const signal = this.signalQueue.shift()!;
        const handlers = this.listeners.get(signal.signalName) || [];
        for (const handler of handlers) {
          handler(signal);
        }
      }

      if (this.actionQueue.length > 0) {
        const actionEvent = this.actionQueue.shift()!;
        if (timeSeconds !== undefined) {
          actionEvent.context.eventTimeSeconds = timeSeconds;
        }
        executeAction(
          actionEvent.item,
          actionEvent.action,
          actionEvent.context,
          this
        );
      }
    }
  }
}
