#!/bin/bash
supabase db dump --file ~/Work/insightly/supabase/insightly.data.sql --data-only
# supabase db reset && supabase db dump restore ~/Work/insightly/supabase/insightly.data.sql
# docker inspect supabase_db_insightly | grep POSTGRES_PASSWORD
# pg_restore --verbose --clean --no-acl --no-owner -h localhost -U postgres -d postgres ~/Work/insightly/supabase/insightly.data.sql

#psql -U postgres -h localhost -p 54322
psql -U postgres -h localhost -p 54322 -d postgres -f ~/Work/insightly/supabase/insightly.data.sql
