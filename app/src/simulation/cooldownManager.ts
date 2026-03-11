import type { DeckItem } from "../components/ItemDeck";
import {
  triggerAbility,
  triggerOnItemUsedAbilities,
} from "./triggerHandler.ts";
import { createInitialPlayerState, type PlayerState } from "./playerState";

export const SIMULATION_TICK_DURATION_MS = 100;

export interface CooldownState {
  uid: string;
  currentCooldown: number; // in milliseconds
  maxCooldown: number; // in milliseconds
}

export interface SimulationState {
  cooldowns: Map<string, CooldownState>;
  timeElapsed: number; // in milliseconds
  players: PlayerState;
  burnTickAccumulator: number;
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
    players: createInitialPlayerState(),
    burnTickAccumulator: 0,
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
  const firedEvents: { itemFired: DeckItem; abilityId: string }[] = [];

  // Create a map for quick item lookup
  const itemMap = new Map(items.map((item) => [item.uid, item]));

  // Process each item with cooldown
  state.cooldowns.forEach((cooldownState, uid) => {
    const item = itemMap.get(uid);
    if (!item) return;

    // Decrease cooldown
    cooldownState.currentCooldown -= SIMULATION_TICK_DURATION_MS;

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
  state.timeElapsed += SIMULATION_TICK_DURATION_MS;

  return firedEvents;
}

/**
 * Simulate the entire battle timeline from 0 to maxTime (in seconds)
 */
export function simulateBattle(
  items: DeckItem[],
  maxTimeSeconds: number
): BattleResult {
  const simulationItems = items.map((item) => ({
    ...item,
    attributes: { ...item.attributes },
  }));

  const state = initializeCooldowns(simulationItems);
  const maxTimeMs = maxTimeSeconds * 1000;
  const tickCount = Math.floor(maxTimeMs / SIMULATION_TICK_DURATION_MS);

  const result: BattleResult = {
    totalDamage: 0,
    totalHits: 0,
    criticalHits: 0,
    damageOverTime: [], // Array of { time, damage } for each tick
    cardEvents: [],
    playerState: state.players,
  };

  // Initialize damage over time with 0 damage at time 0
  result.damageOverTime.push({ time: 0, cumulativeDamage: 0 });

  for (let tick = 0; tick < tickCount; tick++) {
    const events = tickCooldowns(state, simulationItems);

    // Process each fired event
    for (const event of events) {
      const damage = triggerAbility(event.itemFired, event.abilityId, {
        items: simulationItems,
        firedItem: event.itemFired,
        players: state.players,
        sourcePlayer: "Self",
      });
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
        simulationItems,
        event.itemFired,
        {
          players: state.players,
          sourcePlayer: "Self",
        }
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

    applyBurnTickDamage(state, result);

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
  playerState: PlayerState;
}

export interface BattleCardEvent {
  time: number;
  uid: string;
  damage: number;
}

function applyBurnTickDamage(
  state: SimulationState,
  result: BattleResult
): void {
  const BURN_TICK_MS = 500;
  state.burnTickAccumulator += SIMULATION_TICK_DURATION_MS;

  while (state.burnTickAccumulator >= BURN_TICK_MS) {
    state.burnTickAccumulator -= BURN_TICK_MS;

    const opponentBurn = state.players.opponent.Burn;
    if (opponentBurn <= 0) {
      continue;
    }

    result.totalDamage += opponentBurn;

    const decay = Math.max(1, Math.round(opponentBurn * 0.05));
    state.players.opponent.Burn = Math.max(0, opponentBurn - decay);
  }
}
