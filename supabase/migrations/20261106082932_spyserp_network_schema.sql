-- pg_net creates its own net schema. Keep extension metadata out of the exposed public schema.
-- This newly installed extension has no pending requests or production history.
drop extension pg_net;
create extension pg_net with schema extensions;
