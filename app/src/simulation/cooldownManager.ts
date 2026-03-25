import type { DeckItem, SimDeckItem } from "../components/ItemDeck";
import { createInitialPlayerState, type PlayerState } from "./playerState";
import { SimulationQueue } from "./eventSystem";

export const SIMULATION_TICK_DURATION_MS = 100;

export interface SimulationState {
  timeElapsed: number; // in milliseconds
  players: PlayerState;
  queue: SimulationQueue;
  items: SimDeckItem[];
  battleStats: BattleStats;
}

/**
 * Initialize cooldown states for all items in the deck
 */
export function initializeState(items: DeckItem[]): SimulationState {
  const simItems: SimDeckItem[] = items.map((item) => ({
    ...item,
    simStats: {
      weaponDamage: 0,
      burnApplied: 0,
      poisonApplied: 0,
      itemUsed: 0,
      cooldown: null,
    },
    snapshots: [],
  }));

  for (const item of simItems) {
    item.attributes.Cooldown = item.attributes.CooldownMax;
  }

  // Init player states
  const players = createInitialPlayerState();

  // Init battle stats tracking
  const battleStats: BattleStats = {
    totalDamage: 0,
    totalBurnDamage: 0,
    totalPoisonDamage: 0,
    damageOverTime: [],
    burnOverTime: [],
    poisonOverTime: [],
  };
  battleStats.damageOverTime.push({
    time: 0,
    cumulativeDamage: 0,
    cumulativeBurnDamage: 0,
    cumulativePoisonDamage: 0,
  });
  battleStats.burnOverTime.push({ time: 0, burn: 0 });
  battleStats.poisonOverTime.push({
    time: 0,
    poison: 0,
  });

  // Init simulation queue
  const queue = new SimulationQueue();
  // Initialise ICD state on every ability's action object
  for (const item of simItems) {
    if (!item.abilityIds) continue;
    for (const abilityId of item.abilityIds) {
      const ability = (item.card.Abilities as any)?.[abilityId];
      if (ability?.Action) {
        ability.Action.internalCooldown = 0;
        ability.Action.events = [];
      }
    }
  }
  // Register all triggers from all items before starting battle
  queue.registerTriggers(simItems, {
    items: simItems,
    players,
    sourcePlayer: "Self",
    battleStats,
    eventTimeSeconds: 0,
  });

  return {
    timeElapsed: 0,
    players,
    queue,
    items: simItems,
    battleStats,
  };
}

/**
 * Process a single simulation tick (0.1 seconds = 100ms)
 */
export function tickCooldowns(state: SimulationState): void {
  // Process each item with a cooldown
  for (const item of state.items) {
    if (item.attributes.CooldownMax <= 0 || item.attributes.CooldownDisabled)
      continue;

    // Decrease cooldown
    item.attributes.Cooldown -= SIMULATION_TICK_DURATION_MS;

    // Check if cooldown reached 0 or below
    if (item.attributes.Cooldown <= 0) {
      // Emit signals for the fired item
      state.queue.emitSignal({
        signalName: `TTriggerOnCardFired-${item.uid}`,
        sourceItem: item,
      });

      // Reset cooldown
      item.attributes.Cooldown = item.attributes.CooldownMax;
    }
  }

  // Tick action internal cooldowns
  state.queue.tickActionICDs(SIMULATION_TICK_DURATION_MS);

  // Increment time
  state.timeElapsed += SIMULATION_TICK_DURATION_MS;
}

/**
 * Simulate the entire battle timeline from 0 to maxTime (in seconds)
 */
export function simulateBattle(
  items: DeckItem[],
  maxTimeSeconds: number
): SimulationState {
  const state = initializeState(
    items.map((item) => ({ ...item, attributes: { ...item.attributes } }))
  );
  const maxTimeMs = maxTimeSeconds * 1000;
  const tickCount = Math.floor(maxTimeMs / SIMULATION_TICK_DURATION_MS);

  const battleStats = state.battleStats;

  for (let tick = 0; tick < tickCount; tick++) {
    tickCooldowns(state);

    state.queue.processQueues(state.timeElapsed / 1000);

    applyBurnTickDamage(state);
    applyPoisonTickDamage(state);

    // Record cumulative damage and per-item stats at this time
    const currentTime = (state.timeElapsed / 1000).toFixed(1);
    const timeFloat = parseFloat(currentTime);
    battleStats.damageOverTime.push({
      time: timeFloat,
      cumulativeDamage: battleStats.totalDamage,
      cumulativeBurnDamage: battleStats.totalBurnDamage,
      cumulativePoisonDamage: battleStats.totalPoisonDamage,
    });
    battleStats.burnOverTime.push({
      time: timeFloat,
      burn: state.players.opponent.Burn,
    });
    battleStats.poisonOverTime.push({
      time: timeFloat,
      poison: state.players.opponent.Poison,
    });
    for (const item of state.items) {
      item.snapshots.push({
        time: timeFloat,
        stats: {
          ...item.simStats,
          cooldown:
            item.attributes.CooldownMax > 0 ? item.attributes.Cooldown : null,
        },
      });
    }
  }

  return state;
}

export interface BattleStats {
  totalDamage: number;
  totalBurnDamage: number;
  totalPoisonDamage: number;
  damageOverTime: Array<{
    time: number;
    cumulativeDamage: number;
    cumulativeBurnDamage: number;
    cumulativePoisonDamage: number;
  }>;
  burnOverTime: Array<{ time: number; burn: number }>;
  poisonOverTime: Array<{ time: number; poison: number }>;
}

function applyBurnTickDamage(state: SimulationState): void {
  const BURN_TICK_MS = 500;
  if (state.timeElapsed % BURN_TICK_MS !== 0) {
    return;
  }

  const opponentBurn = state.players.opponent.Burn;
  if (opponentBurn <= 0) {
    return;
  }

  state.battleStats.totalDamage += opponentBurn;
  state.battleStats.totalBurnDamage += opponentBurn;

  const decay = Math.max(1, Math.round(opponentBurn * 0.05));
  state.players.opponent.Burn = Math.max(0, opponentBurn - decay);
}

function applyPoisonTickDamage(state: SimulationState): void {
  const POISON_TICK_MS = 1000;
  if (state.timeElapsed % POISON_TICK_MS !== 0 || state.timeElapsed === 0) {
    return;
  }

  const opponentPoison = state.players.opponent.Poison;
  if (opponentPoison <= 0) {
    return;
  }

  state.battleStats.totalDamage += opponentPoison;
  state.battleStats.totalPoisonDamage += opponentPoison;
}
