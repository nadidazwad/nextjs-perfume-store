-- Storefront queries are short and many; Postgres JIT compiles them for longer
-- than they run once catalogs reach the tens of thousands (measured: a 35 ms
-- query spent 215 ms in JIT). Hosts that don't let the owner change database
-- settings keep their default; the app works either way.
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET jit = off', current_database());
EXCEPTION WHEN insufficient_privilege OR undefined_object OR feature_not_supported THEN
  RAISE NOTICE 'jit left at host default: %', SQLERRM;
END $$;
