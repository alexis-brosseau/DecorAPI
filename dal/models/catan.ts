import type { UUID } from 'crypto';

export type CatanGameStatus = 'lobby' | 'running' | 'finished' | 'abandoned';
export type CatanPlayerColor = 'red' | 'blue' | 'white' | 'orange' | 'green' | 'brown';
export type CatanTradeStatus = 'open' | 'accepted' | 'declined' | 'cancelled' | 'expired';

export interface CatanGame {
  id: UUID;
  joinCode: string;
  name: string | null;
  status: CatanGameStatus;
  maxPlayers: number;
  createdByUserId: UUID | null;
  createdAt: Date;
  startedAt: Date | null;
  finishedAt: Date | null;
  seed: number | null;
  config: unknown;
}

export interface CatanGamePlayer {
  id: UUID;
  gameId: UUID;
  userId: UUID | null;
  guestId: UUID | null;

  seat: number;
  color: CatanPlayerColor | null;
  displayName: string;

  isHost: boolean;
  isReady: boolean;
  isConnected: boolean;

  victoryPoints: number;
  playedKnights: number;
  longestRoadLength: number;
  largestArmy: boolean;
  longestRoad: boolean;

  createdAt: Date;
}

export interface CatanGameState {
  gameId: UUID;
  version: number;
  state: unknown;
  updatedAt: Date;
}

export interface CatanGameEvent {
  id: number;
  gameId: UUID;
  seq: number;
  playerId: UUID | null;
  type: string;
  payload: unknown;
  createdAt: Date;
}

export interface CatanChatMessage {
  id: number;
  gameId: UUID;
  playerId: UUID | null;
  message: string;
  createdAt: Date;
}

export interface CatanTradeOffer {
  id: UUID;
  gameId: UUID;
  offeredByPlayerId: UUID;
  status: CatanTradeStatus;
  offer: unknown;
  createdAt: Date;
  resolvedAt: Date | null;
}
