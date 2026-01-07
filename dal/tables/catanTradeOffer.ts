import type { PoolClient } from 'pg';
import type { UUID } from 'crypto';
import Table from '../table.js';
import type { CatanTradeOffer, CatanTradeStatus } from '../models/catan.js';
import { catanTradeStatusFromString } from '../models/catan.js';

export default class CatanTradeOfferTable extends Table {
  constructor(client: PoolClient) {
    super(client, 'catan_trade_offer');
  }

  private mapRow(data: any): CatanTradeOffer {
    return {
      id: data.id,
      gameId: data.game_id,
      offeredByPlayerId: data.offered_by_player_id,
      status: (catanTradeStatusFromString(data.status) ?? 'open') as CatanTradeStatus,
      offer: data.offer,
      createdAt: new Date(data.created_at),
      resolvedAt: data.resolved_at ? new Date(data.resolved_at) : null,
    };
  }

  async listByGame(gameId: UUID, limit: number = 200): Promise<CatanTradeOffer[]> {
    const sql = `
      SELECT id, game_id, offered_by_player_id, status, offer, created_at, resolved_at
      FROM catan_trade_offer
      WHERE game_id = $1
      ORDER BY created_at ASC
      LIMIT $2
    `;

    const rows = await super.query(sql, [gameId, limit]);
    return rows.map((r) => this.mapRow(r));
  }

  async create({
    gameId,
    offeredByPlayerId,
    offer,
  }: {
    gameId: UUID;
    offeredByPlayerId: UUID;
    offer: unknown;
  }): Promise<CatanTradeOffer> {
    const sql = `
      INSERT INTO catan_trade_offer (game_id, offered_by_player_id, offer)
      VALUES ($1, $2, $3::jsonb)
      RETURNING id, game_id, offered_by_player_id, status, offer, created_at, resolved_at
    `;

    const rows = await super.query(sql, [gameId, offeredByPlayerId, JSON.stringify(offer ?? null)]);
    const data = rows[0];
    if (!data) throw new Error('Failed to create trade offer');
    return this.mapRow(data);
  }

  async setStatus(id: UUID, status: CatanTradeStatus): Promise<CatanTradeOffer> {
    const sql = `
      UPDATE catan_trade_offer
      SET status = $2::catan_trade_status,
          resolved_at = CASE WHEN $2::catan_trade_status = 'open' THEN NULL ELSE now() END
      WHERE id = $1
      RETURNING id, game_id, offered_by_player_id, status, offer, created_at, resolved_at
    `;

    const rows = await super.query(sql, [id, status]);
    const data = rows[0];
    if (!data) throw new Error('Trade offer not found');
    return this.mapRow(data);
  }
}
