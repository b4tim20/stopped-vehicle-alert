-- Disable the simulator by default. Existing rows keep their current value;
-- only the column default for new inserts changes.
alter table app_settings
  alter column simulator_enabled set default false;
