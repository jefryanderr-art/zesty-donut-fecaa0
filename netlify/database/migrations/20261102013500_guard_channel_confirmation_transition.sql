-- Replayed confirmations must not consume a later one-use channel permission.
CREATE OR REPLACE FUNCTION acontec_assign_pagadito_channel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.status='confirmado' THEN RETURN NEW; END IF;
 IF NEW.status='confirmado' AND (lower(NEW.method)='pagadito' OR NEW.provider_key LIKE 'sandbox:ACT-%' OR NEW.provider_key LIKE 'production:ACT-%') THEN
  INSERT INTO acontec_billing_channels(email,channel) VALUES(NEW.email,'pagadito')
  ON CONFLICT(email) DO UPDATE SET channel='pagadito',permit=NULL,version=acontec_billing_channels.version+1
  WHERE acontec_billing_channels.channel IN ('unassigned','pagadito') OR acontec_billing_channels.permit='pagadito';
  IF NOT FOUND THEN RAISE EXCEPTION 'billing_channel_conflict'; END IF;
 END IF;
 RETURN NEW;
END $$;
