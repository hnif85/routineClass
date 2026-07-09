-- Add Doku payment columns to event_invitations
ALTER TABLE routine_class.event_invitations ADD COLUMN IF NOT EXISTS doku_invoice_number TEXT;
ALTER TABLE routine_class.event_invitations ADD COLUMN IF NOT EXISTS payment_provider TEXT;
ALTER TABLE routine_class.event_invitations ADD COLUMN IF NOT EXISTS payment_url TEXT;
ALTER TABLE routine_class.event_invitations ADD COLUMN IF NOT EXISTS payment_status TEXT;
