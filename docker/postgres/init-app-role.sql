-- Create non-superuser application role for RLS enforcement
-- Superusers bypass RLS even with FORCE ROW LEVEL SECURITY
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'metanoia_app') THEN
    CREATE ROLE metanoia_app WITH LOGIN PASSWORD 'metanoia_app_pass' NOSUPERUSER;
  END IF;
END $$;

-- Grant necessary permissions on the database (dynamic to work in both dev and test)
DO $$ BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO metanoia_app', current_database());
END $$;
GRANT USAGE ON SCHEMA public TO metanoia_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO metanoia_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO metanoia_app;

-- Ensure future tables also get permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO metanoia_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO metanoia_app;
