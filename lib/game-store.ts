import type { SimState } from './types';
import { GAME_INDEX_KEY, gameKey, getRedis } from './kv';

export interface GameRecord {
  id: string;
  state: SimState;
  turns?: TurnSnapshot[];
  createdAt: string;
  updatedAt: string;
  name?: string;
  scenarioName?: string;
  playerId?: string | null;
  goal?: string;
}

export interface TurnSnapshot {
  turn: number;
  headline: string;
  narration: string;
  context: string;
  agents: { id: string; name: string; type: string; state: string }[];
  agentActions: { agentId: string; action: string }[];
}

const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function resolveTtl() {
  const raw = process.env.GAME_TTL_DAYS;
  if (!raw) return DEFAULT_TTL_SECONDS;
  const days = Number(raw);
  if (!Number.isFinite(days) || days <= 0) return DEFAULT_TTL_SECONDS;
  return Math.round(days * 24 * 60 * 60);
}

function indexKey() {
  return process.env.KV_INDEX_NAMESPACE ? `${process.env.KV_INDEX_NAMESPACE}:${GAME_INDEX_KEY}` : GAME_INDEX_KEY;
}

export async function saveGame(record: GameRecord) {
  const redis = getRedis();
  const ttl = resolveTtl();
  const now = new Date().toISOString();
  const payload: GameRecord = {
    ...record,
    updatedAt: now,
  };
  if (!payload.createdAt) payload.createdAt = now;

  await redis.set(gameKey(record.id), payload, { ex: ttl });
  await redis.zadd(indexKey(), { score: Date.now(), member: record.id });
  return payload;
}

export async function getGame(id: string) {
  const redis = getRedis();
  const result = await redis.get<GameRecord>(gameKey(id));
  return result ?? null;
}

export interface GameSummary {
  id: string;
  updatedAt: string;
  createdAt: string;
  scenarioName?: string;
  name?: string;
}

export async function listGames(limit = 20): Promise<GameSummary[]> {
  const redis = getRedis();
  const ids = await redis.zrange<string>(indexKey(), 0, limit - 1, { rev: true });
  if (!ids || ids.length === 0) return [];
  const records = await redis.mget<GameRecord>(...ids.map(gameKey));
  const summaries: GameSummary[] = [];
  for (const rec of records) {
    if (!rec) continue;
    summaries.push({
      id: rec.id,
      updatedAt: rec.updatedAt,
      createdAt: rec.createdAt,
      scenarioName: rec.scenarioName,
      name: rec.name,
    });
  }
  return summaries;
}

export async function deleteGame(id: string) {
  const redis = getRedis();
  await redis.del(gameKey(id));
  await redis.zrem(indexKey(), id);
}
