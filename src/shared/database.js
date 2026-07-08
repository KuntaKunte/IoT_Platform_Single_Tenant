import pg from 'pg';
import { loadConfig } from './config.js';
import { createLogger } from './logger.js';

const { Pool } = pg;
const logger = createLogger();

export class DatabaseClient {
  constructor(config) {
    this.config = config;
    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: config.poolMax,
      idleTimeoutMillis: config.poolIdleTimeoutMs,
      connectionTimeoutMillis: config.poolConnectionTimeoutMs,
      statement_timeout: config.statementTimeoutMs
    });

    // pg.Pool emits 'error' on behalf of any idle client that errors out (e.g. the
    // connection was terminated by the server). Without a listener, Node's default
    // unhandled-'error' behavior crashes the process on any transient DB hiccup.
    this.pool.on('error', (err) => {
      logger.error({ err }, 'Postgres pool error');
    });
  }

  async connect() {
    await this.pool.query('SELECT 1');
    return { connected: true };
  }

  async query(sql, params = []) {
    return this.pool.query(sql, params);
  }

  async disconnect() {
    await this.pool.end();
  }
}

export const dbClient = new DatabaseClient(loadConfig().postgres);
