-- Notifications can be archived one by one: kept (the Archived tab in the bell), but out of the inbox and out of the
-- admin's Live Alerts. Deleting one needs nothing new: each person could already delete their own notifications.
-- Safe to run more than once.

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
