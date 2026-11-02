-- Keep channel assignment atomic with an approved provider payment, without changing provider code.
CREATE FUNCTION acontec_assign_pagadito_channel() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='confirmado' AND (lower(NEW.method)='pagadito' OR NEW.provider_key LIKE 'sandbox:ACT-%' OR NEW.provider_key LIKE 'production:ACT-%') THEN
  INSERT INTO acontec_billing_channels(email,channel) VALUES(NEW.email,'pagadito')
  ON CONFLICT(email) DO UPDATE SET channel='pagadito',permit=NULL,version=acontec_billing_channels.version+1
  WHERE acontec_billing_channels.channel IN ('unassigned','pagadito') OR acontec_billing_channels.permit='pagadito';
  IF NOT FOUND THEN RAISE EXCEPTION 'billing_channel_conflict'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER acontec_assign_payment_channel AFTER INSERT OR UPDATE OF status ON acontec_customer_payments
FOR EACH ROW EXECUTE FUNCTION acontec_assign_pagadito_channel();
