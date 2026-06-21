-- rate-limit.lua — Atomic Redis rate limiter for email notifications (Story 14-3).
--
-- Arguments:
--   KEYS[1]  = "rate:email:{tenantId}:{YYYYMMDD}"  (daily counter key)
--   ARGV[1]  = limit       (EMAIL_DAILY_LIMIT, e.g. 100)
--   ARGV[2]  = threshold   (EMAIL_RATE_THRESHOLD, e.g. 80)
--   ARGV[3]  = ttlSeconds  (seconds until midnight UTC — always positive)
--   ARGV[4]  = isCritical  ("1" = critical type, always send; "0" = non-critical)
--   ARGV[5]  = alertedKey  (Redis key flag: "rate:email:{tenantId}:{YYYYMMDD}:alerted")
--
-- Returns: array [decision, count, crossedThreshold]
--   decision         = "allow" | "defer" | "allow_critical"
--   count            = current daily counter after this call
--   crossedThreshold = "1" if first time crossing threshold, "0" otherwise
--
-- Atomicity: all reads and writes happen inside a single Lua script (server-side).
-- SECURITY: NEVER log KEYS[1] value as it contains tenantId — caller enforces L2.

local key       = KEYS[1]
local limit     = tonumber(ARGV[1])
local threshold = tonumber(ARGV[2])
local ttl       = tonumber(ARGV[3])
local critical  = ARGV[4] == "1"
local alertedKey = ARGV[5]

-- Get current count WITHOUT incrementing first (peek)
local current = tonumber(redis.call('GET', key) or "0")

-- If already at or over limit and NOT critical: defer immediately (do not increment)
if current >= limit and not critical then
  return {"defer", current, "0"}
end

-- Increment atomically
local newCount = redis.call('INCR', key)

-- Set TTL on first write (newCount == 1) or refresh if not set
if newCount == 1 then
  redis.call('EXPIRE', key, ttl)
end

-- Critical types always send regardless of limit
if critical then
  return {"allow_critical", newCount, "0"}
end

-- Non-critical: check if over limit after increment
if newCount > limit then
  -- Undo the increment (roll back) and defer
  redis.call('DECR', key)
  return {"defer", newCount - 1, "0"}
end

-- Check if we crossed the threshold for the FIRST time (alert admin once per day)
local crossedThreshold = "0"
if newCount >= threshold then
  -- SET NX: only set if NOT already set (atomic "first time" detection)
  local alertSet = redis.call('SET', alertedKey, "1", "NX", "EX", ttl)
  if alertSet then
    crossedThreshold = "1"
  end
end

return {"allow", newCount, crossedThreshold}
