-- Historical payments fix the channel without changing subscriptions or provider data.
INSERT INTO acontec_billing_channels (email, channel)
SELECT u.email, CASE WHEN EXISTS (
 SELECT 1 FROM acontec_customer_payments p WHERE p.email=u.email
 AND (lower(p.method)='pagadito' OR p.provider_key LIKE 'sandbox:ACT-%' OR p.provider_key LIKE 'production:ACT-%')
) THEN 'pagadito' ELSE 'unassigned' END
FROM acontec_users u ON CONFLICT (email) DO NOTHING;
