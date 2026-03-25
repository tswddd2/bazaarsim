import type { SimDeckItem } from "../components/ItemDeck";
import { executeAction, type ActionContext } from "./actionHandler";
import { triggerAbilityListener } from "./triggerHandler";

export interface SignalEvent {
  signalName: string;
  sourceItem?: SimDeckItem;
}

export interface ActionEvent {
  item: SimDeckItem;
  action: any;
  context: ActionContext;
}

const ACTION_ICD_MS = 250;

export class SimulationQueue {
  private signalQueue: SignalEvent[] = [];
  private actionQueue: ActionEvent[] = [];
  private listeners: Map<string, Array<(event: SignalEvent) => void>> =
    new Map();
  /** Every action object that has ever been pushed, for ticking ICDs. */
  private trackedActions: Set<any> = new Set();

  public on(signalName: string, listener: (event: SignalEvent) => void) {
    if (!this.listeners.has(signalName)) {
      this.listeners.set(signalName, []);
    }
    this.listeners.get(signalName)!.push(listener);
  }

  public emitSignal(event: SignalEvent) {
    this.signalQueue.push(event);
  }

  public pushAction(actionEvent: ActionEvent) {
    const action = actionEvent.action;
    this.trackedActions.add(action);

    if (action.internalCooldown <= 0) {
      action.internalCooldown = ACTION_ICD_MS;
      this.actionQueue.push(actionEvent);
    } else {
      action.events.push(actionEvent);
    }
  }

  /**
   * Tick all action ICDs by deltaMs. When an ICD expires and stack > 0,
   * release one stacked action into the queue.
   */
  public tickActionICDs(deltaMs: number): void {
    this.trackedActions.forEach((act) => {
      if (act.internalCooldown <= 0) return;

      act.internalCooldown -= deltaMs;

      if (act.internalCooldown <= 0 && act.events.length > 0) {
        const event = act.events.pop();
        event.action.internalCooldown = ACTION_ICD_MS;
        this.actionQueue.push(event);
      }
    });
  }

  public registerTriggers(items: SimDeckItem[], context: ActionContext) {
    for (const item of items) {
      if (!item.abilityIds || item.abilityIds.length === 0) continue;

      // Pre-create stable action objects so ICD state is preserved across firings
      const beforeUsedAbility = {
        Trigger: { $type: "TTriggerOnCardFired" },
        Action: {
          $type: "TActionBeforeItemUsed",
          internalCooldown: 0,
          events: [],
        },
        Prerequisites: null,
      };
      const itemUsedAbility = {
        Trigger: { $type: "TTriggerOnCardFired" },
        Action: {
          $type: "TActionItemUsed",
          internalCooldown: 0,
          events: [],
        },
        Prerequisites: null,
      };

      if (item.attributes.CooldownMax > 0) {
        this.on(`TTriggerOnCardFired-${item.uid}`, (event) => {
          triggerAbilityListener(item, beforeUsedAbility, event, context, this);
        });
      }

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

      if (item.attributes.CooldownMax > 0) {
        this.on(`TTriggerOnCardFired-${item.uid}`, (event) => {
          triggerAbilityListener(item, itemUsedAbility, event, context, this);
        });
      }
    }
  }

  public processQueues(timeMs?: number) {
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
        if (timeMs !== undefined) {
          actionEvent.context.eventTimeMs = timeMs;
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
