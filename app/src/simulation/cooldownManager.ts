import type { DeckItem } from "../components/ItemDeck";
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
}

/**
 * Initialize cooldown states for all items in the deck
 */
export function initializeState(items: DeckItem[]): SimulationState {
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

  const queue = new SimulationQueue();

  return {
    cooldowns,
    timeElapsed: 0,
    players: createInitialPlayerState(),
    queue,
  };
}

/**
 * Process a single simulation tick (0.1 seconds = 100ms)
 */
export function tickCooldowns(state: SimulationState, items: DeckItem[]): void {
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
  const simulationItems = items.map((item) => ({
    ...item,
    attributes: { ...item.attributes },
  }));

  const state = initializeState(simulationItems);
  const maxTimeMs = maxTimeSeconds * 1000;
  const tickCount = Math.floor(maxTimeMs / SIMULATION_TICK_DURATION_MS);

  const result: BattleResult = {
    totalDamage: 0,
    damageOverTime: [], // Array of { time, damage } for each tick
    burnOverTime: [],
    cardEvents: [],
    playerState: state.players,
  };

  // Initialize damage over time with 0 damage at time 0
  result.damageOverTime.push({ time: 0, cumulativeDamage: 0 });
  result.burnOverTime.push({ time: 0, burn: state.players.opponent.Burn });

  // Register all triggers from all items before starting battle
  state.queue.registerTriggers(simulationItems, {
    items: simulationItems,
    players: state.players,
    sourcePlayer: "Self",
    result,
  });

  for (let tick = 0; tick < tickCount; tick++) {
    tickCooldowns(state, simulationItems);

    state.queue.processQueues(state.timeElapsed / 1000);

    applyBurnTickDamage(state, result);

    // Record cumulative damage at this time
    const currentTime = (state.timeElapsed / 1000).toFixed(1);
    result.damageOverTime.push({
      time: parseFloat(currentTime),
      cumulativeDamage: result.totalDamage,
    });
    result.burnOverTime.push({
      time: parseFloat(currentTime),
      burn: state.players.opponent.Burn,
    });
  }

  return result;
}

export interface BattleResult {
  totalDamage: number;
  damageOverTime: Array<{ time: number; cumulativeDamage: number }>;
  burnOverTime: Array<{ time: number; burn: number }>;
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
  if (state.timeElapsed % BURN_TICK_MS !== 0) {
    return;
  }

  const opponentBurn = state.players.opponent.Burn;
  if (opponentBurn <= 0) {
    return;
  }

  result.totalDamage += opponentBurn;

  const decay = Math.max(1, Math.round(opponentBurn * 0.05));
  state.players.opponent.Burn = Math.max(0, opponentBurn - decay);
}
