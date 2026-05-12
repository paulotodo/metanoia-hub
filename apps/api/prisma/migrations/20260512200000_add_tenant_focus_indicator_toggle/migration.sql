-- Story 5-5: per-tenant focus indicator toggle (NFR-L4 — default OFF for privacy).
-- The transparency banner reads this flag to optionally show "focus indicator is also active";
-- Story 5-4 frontend gates its WebSocket heartbeat on the same flag.

ALTER TABLE "tenants"
  ADD COLUMN "focus_indicator_enabled" BOOLEAN NOT NULL DEFAULT false;
