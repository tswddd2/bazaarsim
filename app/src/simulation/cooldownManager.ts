import type { DeckItem } from "../components/ItemDeck";
import {
  triggerAbility,
  triggerOnItemUsedAbilities,
} from "./triggerHandler.ts";

export interface CooldownState {
  uid: string;
  currentCooldown: number; // in milliseconds
  maxCooldown: number; // in milliseconds
}

export interface SimulationState {
  cooldowns: Map<string, CooldownState>;
  timeElapsed: number; // in milliseconds
}

/**
 * Initialize cooldown states for all items in the deck
 */
export function initializeCooldowns(items: DeckItem[]): SimulationState {
  const cooldowns = new Map<string, CooldownState>();

  for (const item of items) {
    const cooldownMax = item.attributes.CooldownMax;

    if (cooldownMax !== undefined && cooldownMax > 0) {
      cooldowns.set(item.uid, {
        uid: item.uid,
        currentCooldown: cooldownMax, // Wait one full cooldown before first fire
        maxCooldown: cooldownMax,
      });
    }
  }

  return {
    cooldowns,
    timeElapsed: 0,
  };
}

/**
 * Process a single simulation tick (0.1 seconds = 100ms)
 * Returns an array of events that occurred during this tick
 */
export function tickCooldowns(
  state: SimulationState,
  items: DeckItem[]
): { itemFired: DeckItem; abilityId: string }[] {
  const TICK_DURATION = 100; // milliseconds
  const firedEvents: { itemFired: DeckItem; abilityId: string }[] = [];

  // Create a map for quick item lookup
  const itemMap = new Map(items.map((item) => [item.uid, item]));

  // Process each item with cooldown
  state.cooldowns.forEach((cooldownState, uid) => {
    const item = itemMap.get(uid);
    if (!item) return;

    // Decrease cooldown
    cooldownState.currentCooldown -= TICK_DURATION;

    // Check if cooldown reached 0 or below
    if (cooldownState.currentCooldown <= 0) {
      // Item fires!
      // Get abilities with TTriggerOnCardFired
      if (item.abilityIds && item.abilityIds.length > 0) {
        for (const abilityId of item.abilityIds) {
          const ability = (item.card.Abilities as any)?.[abilityId];
          if (ability && ability.Trigger?.$type === "TTriggerOnCardFired") {
            firedEvents.push({
              itemFired: item,
              abilityId: abilityId,
            });
          }
        }
      }

      // Reset cooldown
      cooldownState.currentCooldown = cooldownState.maxCooldown;
    }
  });

  // Increment time
  state.timeElapsed += TICK_DURATION;

  return firedEvents;
}

/**
 * Simulate the entire battle timeline from 0 to maxTime (in seconds)
 */
export function simulateBattle(
  items: DeckItem[],
  maxTimeSeconds: number
): BattleResult {
  const state = initializeCooldowns(items);
  const maxTimeMs = maxTimeSeconds * 1000;
  const TICK_DURATION = 100;
  const tickCount = Math.floor(maxTimeMs / TICK_DURATION);

  const result: BattleResult = {
    totalDamage: 0,
    totalHits: 0,
    criticalHits: 0,
    damageOverTime: [], // Array of { time, damage } for each tick
    cardEvents: [],
  };

  // Initialize damage over time with 0 damage at time 0
  result.damageOverTime.push({ time: 0, cumulativeDamage: 0 });

  for (let tick = 0; tick < tickCount; tick++) {
    const events = tickCooldowns(state, items);

    // Process each fired event
    for (const event of events) {
      const damage = triggerAbility(event.itemFired, event.abilityId);
      result.totalDamage += damage;
      if (damage > 0) {
        result.totalHits += 1;
        result.cardEvents.push({
          time: state.timeElapsed / 1000,
          uid: event.itemFired.uid,
          damage,
        });
      }

      // Every TTriggerOnCardFired activation also triggers TTriggerOnItemUsed listeners.
      const itemUsedResults = triggerOnItemUsedAbilities(
        items,
        event.itemFired
      );
      for (const itemUsedResult of itemUsedResults) {
        result.totalDamage += itemUsedResult.damage;
        result.totalHits += 1;
        result.cardEvents.push({
          time: state.timeElapsed / 1000,
          uid: itemUsedResult.item.uid,
          damage: itemUsedResult.damage,
        });
      }
    }

    // Record cumulative damage at this time
    const currentTime = (state.timeElapsed / 1000).toFixed(1);
    result.damageOverTime.push({
      time: parseFloat(currentTime),
      cumulativeDamage: result.totalDamage,
    });
  }

  return result;
}

export interface BattleResult {
  totalDamage: number;
  totalHits: number;
  criticalHits: number;
  damageOverTime: Array<{ time: number; cumulativeDamage: number }>;
  cardEvents: BattleCardEvent[];
}

export interface BattleCardEvent {
  time: number;
  uid: string;
  damage: number;
}
