import type { UUID } from 'crypto';
import type { PoolClient, QueryResult } from 'pg';
import { DatabaseError } from 'pg';

export default class Table {
  private client: PoolClient;
  private name: string;

  constructor(client: PoolClient, name: string) {
    this.client = client;
    this.name = name;
  }

  protected async call(procedure: string, params: Record<string, any> = {}): Promise<any[]> {
    const paramKeys = Object.keys(params);
    const paramPlaceholders = paramKeys.map((_, index) => `$${index + 1}`).join(', ');
    const query = `SELECT * FROM ${procedure}(${paramPlaceholders})`;
    const paramValues = paramKeys.map(key => params[key]);

    try {
      const result: QueryResult = await this.client.query(query, paramValues);
      return result.rows;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async query(sql: string, params: any[] = []): Promise<any[]> {
    try {
      const result: QueryResult = await this.client.query(sql, params);
      return result.rows;
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  async get(id: UUID): Promise<any> {
    const query = `SELECT * FROM "${this.name}" WHERE "id" = $1`;
    
    try {
      const result: QueryResult = await this.client.query(query, [id]);
      return result.rows[0];
    } catch (error: any) {
      throw this.handleError(error);
    }
  }

  protected handleError(error: any) {
    if (error instanceof DatabaseError) {
      return error;
    }
    
    // For non-database errors, wrap them
    return new Error(error.message || error);
  }
}