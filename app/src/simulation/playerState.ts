export interface PlayerStatus {
  Burn: number;
  Enraged: number;
  Rage: number;
  Gold: number;
  Health: number;
  Poison: number;
  Shield: number;
}

export type PlayerSide = "Self" | "Opponent";

export interface PlayerState {
  self: PlayerStatus;
  opponent: PlayerStatus;
}

export function createInitialPlayerStatus(): PlayerStatus {
  return {
    Burn: 0,
    Enraged: 0,
    Rage: 0,
    Gold: 0,
    Health: 0,
    Poison: 0,
    Shield: 0,
  };
}

export function createInitialPlayerState(): PlayerState {
  return {
    self: createInitialPlayerStatus(),
    opponent: createInitialPlayerStatus(),
  };
}

export function getOppositePlayerSide(side: PlayerSide): PlayerSide {
  return side === "Self" ? "Opponent" : "Self";
}

export function getPlayerStatusBySide(
  state: PlayerState,
  side: PlayerSide
): PlayerStatus {
  return side === "Self" ? state.self : state.opponent;
}
