import { Redis } from '@upstash/redis';

export function getRedis() {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error('KV is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN.');
  }

  return Redis.fromEnv();
}

export const GAME_KEY_PREFIX = 'game:';
export const GAME_INDEX_KEY = 'games:index';

export function gameKey(id: string) {
  return `${GAME_KEY_PREFIX}${id}`;
}
