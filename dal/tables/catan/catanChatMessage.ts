import type { PoolClient } from 'pg';
import type { UUID } from 'crypto';
import Table from '../../table.js';
import type { CatanChatMessage } from '../../models/catan.js';

export default class CatanChatMessageTable extends Table {
  constructor(client: PoolClient) {
    super(client, 'catan_chat_message');
  }

  private mapRow(data: any): CatanChatMessage {
    return {
      id: Number(data.id),
      gameId: data.game_id,
      playerId: data.player_id ?? null,
      message: data.message,
      createdAt: new Date(data.created_at),
    };
  }

  async listByGame(gameId: UUID, limit: number = 200): Promise<CatanChatMessage[]> {
    const sql = `
      SELECT id, game_id, player_id, message, created_at
      FROM catan_chat_message
      WHERE game_id = $1
      ORDER BY created_at ASC
      LIMIT $2
    `;

    const rows = await super.query(sql, [gameId, limit]);
    return rows.map((r) => this.mapRow(r));
  }

  async add({
    gameId,
    playerId,
    message,
  }: {
    gameId: UUID;
    playerId?: UUID | null;
    message: string;
  }): Promise<CatanChatMessage> {
    const sql = `
      INSERT INTO catan_chat_message (game_id, player_id, message)
      VALUES ($1, $2, $3)
      RETURNING id, game_id, player_id, message, created_at
    `;

    const rows = await super.query(sql, [gameId, playerId ?? null, message]);
    const data = rows[0];
    if (!data) throw new Error('Failed to add chat message');
    return this.mapRow(data);
  }
}
