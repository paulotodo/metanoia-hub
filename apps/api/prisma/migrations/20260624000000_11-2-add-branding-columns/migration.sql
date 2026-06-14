-- Additive nullable columns; RLS inherited from existing tenants policy
-- NO trigger_set_timestamp — project uses @updatedAt (Prisma). (CI lesson 11-1)
ALTER TABLE tenants ADD COLUMN brand_primary_color VARCHAR(9);
ALTER TABLE tenants ADD COLUMN brand_secondary_color VARCHAR(9);
ALTER TABLE tenants ADD COLUMN display_name VARCHAR(100);
