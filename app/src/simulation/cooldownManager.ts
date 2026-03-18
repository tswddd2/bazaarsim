import type { DeckItem, SimDeckItem } from "../components/ItemDeck";
import { createInitialPlayerState, type PlayerState } from "./playerState";
import { SimulationQueue } from "./eventSystem";

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
  queue: SimulationQueue;
  items: SimDeckItem[];
}

/**
 * Initialize cooldown states for all items in the deck
 */
export function initializeState(items: DeckItem[]): SimulationState {
  const cooldowns = new Map<string, CooldownState>();

  const simItems: SimDeckItem[] = items.map((item) => ({
    ...item,
    simStats: {
      weaponDamage: 0,
      burnApplied: 0,
      poisonApplied: 0,
    },
    snapshots: [],
  }));

  for (const item of simItems) {
    const cooldownMax = item.attributes.CooldownMax;

    if (cooldownMax !== undefined && cooldownMax > 0) {
      cooldowns.set(item.uid, {
        uid: item.uid,
        currentCooldown: cooldownMax, // Wait one full cooldown before first fire
        maxCooldown: cooldownMax,
      });
    }
  }

  const queue = new SimulationQueue();

  return {
    cooldowns,
    timeElapsed: 0,
    players: createInitialPlayerState(),
    queue,
    items: simItems,
  };
}

/**
 * Process a single simulation tick (0.1 seconds = 100ms)
 */
export function tickCooldowns(state: SimulationState): void {
  // Create a map for quick item lookup
  const itemMap = new Map(state.items.map((item) => [item.uid, item]));

  // Process each item with cooldown
  state.cooldowns.forEach((cooldownState, uid) => {
    const item = itemMap.get(uid);
    if (!item) return;

    // Decrease cooldown
    cooldownState.currentCooldown -= SIMULATION_TICK_DURATION_MS;

    // Check if cooldown reached 0 or below
    if (cooldownState.currentCooldown <= 0) {
      // Emit signals for the fired item
      state.queue.emitSignal({
        signalName: `TTriggerOnCardFired-${item.uid}`,
        sourceItem: item,
      });
      state.queue.emitSignal({
        signalName: "TTriggerOnItemUsed",
        sourceItem: item,
      });

      // Reset cooldown
      cooldownState.currentCooldown = cooldownState.maxCooldown;
    }
  });

  // Increment time
  state.timeElapsed += SIMULATION_TICK_DURATION_MS;
}

/**
 * Simulate the entire battle timeline from 0 to maxTime (in seconds)
 */
export function simulateBattle(
  items: DeckItem[],
  maxTimeSeconds: number
): BattleResult {
  const state = initializeState(
    items.map((item) => ({ ...item, attributes: { ...item.attributes } }))
  );
  const maxTimeMs = maxTimeSeconds * 1000;
  const tickCount = Math.floor(maxTimeMs / SIMULATION_TICK_DURATION_MS);

  const result: BattleResult = {
    totalDamage: 0,
    totalBurnDamage: 0,
    totalPoisonDamage: 0,
    damageOverTime: [],
    burnOverTime: [],
    poisonOverTime: [],
    playerState: state.players,
    items: state.items,
  };

  // Initialize damage over time with 0 damage at time 0
  result.damageOverTime.push({
    time: 0,
    cumulativeDamage: 0,
    cumulativeBurnDamage: 0,
    cumulativePoisonDamage: 0,
  });
  result.burnOverTime.push({ time: 0, burn: state.players.opponent.Burn });
  result.poisonOverTime.push({
    time: 0,
    poison: state.players.opponent.Poison,
  });

  // Register all triggers from all items before starting battle
  state.queue.registerTriggers(state.items, {
    items: state.items,
    players: state.players,
    sourcePlayer: "Self",
    result,
    eventTimeSeconds: 0,
  });

  for (let tick = 0; tick < tickCount; tick++) {
    tickCooldowns(state);

    state.queue.processQueues(state.timeElapsed / 1000);

    applyBurnTickDamage(state, result);
    applyPoisonTickDamage(state, result);

    // Record cumulative damage and per-item stats at this time
    const currentTime = (state.timeElapsed / 1000).toFixed(1);
    const timeFloat = parseFloat(currentTime);
    result.damageOverTime.push({
      time: timeFloat,
      cumulativeDamage: result.totalDamage,
      cumulativeBurnDamage: result.totalBurnDamage,
      cumulativePoisonDamage: result.totalPoisonDamage,
    });
    result.burnOverTime.push({
      time: timeFloat,
      burn: state.players.opponent.Burn,
    });
    result.poisonOverTime.push({
      time: timeFloat,
      poison: state.players.opponent.Poison,
    });
    for (const item of state.items) {
      item.snapshots.push({
        time: timeFloat,
        stats: item.simStats,
      });
    }
  }

  return result;
}

export interface BattleResult {
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
  playerState: PlayerState;
  items: SimDeckItem[];
}

function applyBurnTickDamage(
  state: SimulationState,
  result: BattleResult
): void {
  const BURN_TICK_MS = 500;
  if (state.timeElapsed % BURN_TICK_MS !== 0) {
    return;
  }

  const opponentBurn = state.players.opponent.Burn;
  if (opponentBurn <= 0) {
    return;
  }

  result.totalDamage += opponentBurn;
  result.totalBurnDamage += opponentBurn;

  const decay = Math.max(1, Math.round(opponentBurn * 0.05));
  state.players.opponent.Burn = Math.max(0, opponentBurn - decay);
}

function applyPoisonTickDamage(
  state: SimulationState,
  result: BattleResult
): void {
  const POISON_TICK_MS = 1000;
  if (state.timeElapsed % POISON_TICK_MS !== 0 || state.timeElapsed === 0) {
    return;
  }

  const opponentPoison = state.players.opponent.Poison;
  if (opponentPoison <= 0) {
    return;
  }

  result.totalDamage += opponentPoison;
  result.totalPoisonDamage += opponentPoison;
}
