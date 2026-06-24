// Upstash Redis 우선, 환경변수 미설정 시 인메모리 폴백.
// 인터페이스는 async 로 통일 (라우트에서 await).
import { Redis } from "@upstash/redis";

const TTL = Number(process.env.CACHE_TTL_SECONDS) || 600;
const hasRedis = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);
const redis = hasRedis ? Redis.fromEnv() : null;

// 인메모리 폴백 저장소
const mem = new Map();

export async function getCached(key) {
  if (redis) {
    try {
      return (await redis.get(key)) ?? null;
    } catch {
      return null;
    }
  }
  const hit = mem.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > TTL * 1000) {
    mem.delete(key);
    return null;
  }
  return hit.data;
}

export async function setCached(key, data) {
  if (redis) {
    try {
      await redis.set(key, data, { ex: TTL });
    } catch {
      /* 캐시 실패는 무시 */
    }
    return;
  }
  mem.set(key, { data, at: Date.now() });
  if (mem.size > 500) {
    const oldest = [...mem.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) mem.delete(oldest[0]);
  }
}
