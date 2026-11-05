-- Queue repairs instead of editing relational manifests/hashes in SQL.
-- The owner read consumes each record in updateCompany with backup, audit,
-- optimistic revision, row lock and synchronization of both representations.
INSERT INTO acontec_site_content(id,content)
SELECT 'company-default-repair:'||c.id::text,
 jsonb_build_object('version',1,'profilePending',
   c.onboarding_done=false AND c.business_type='comercio'
   AND coalesce(u.name,'')<>''
   AND NOT EXISTS (SELECT 1 FROM acontec_audit_events a WHERE a.company_id=c.id
     AND (a.action='Empresa creada' OR a.action LIKE '%perfil%' OR a.action LIKE '%completeProfile%')))
FROM acontec_companies c JOIN acontec_users u ON u.email=c.owner_email
WHERE NOT c.is_platform_company AND c.archived_at IS NULL
 AND (c.data IS NULL OR EXISTS (
  SELECT 1 FROM jsonb_array_elements_text('["fiscalWorkflows", "inventoryLayers", "businessRecords", "branches", "accounts", "products", "customers", "suppliers", "employees", "payrolls", "settlements", "taxes", "properties", "shifts", "cashMovements", "pettyFunds", "pettyVouchers", "cashCounts", "costCatalog", "costs", "entries", "withholdings", "instruments", "partners", "stockTransfers", "assets", "loans", "recurringEntries", "exchangeRates", "foreignDocuments", "budgets", "quotations", "purchaseOrders", "attendance", "vacationRequests", "employeeAdvances", "invoiceSequences", "moneyTransfers"]'::jsonb) AS k(key)
  WHERE NOT (c.data ? k.key)
 ) OR EXISTS (SELECT 1 FROM jsonb_array_elements_text('["name","invoiceCountry","cur","ruc","addr","fiscal","pos"]'::jsonb) AS k(key) WHERE NOT(coalesce(c.data->'cfg','{}'::jsonb) ? k.key))
 OR EXISTS (SELECT 1 FROM jsonb_array_elements_text('["vatRate", "incomeRate", "salaryTax", "socialRate", "daysPerMonth", "overtimeFactor", "workingHours", "bonusDays", "premiumDays", "vacationDays", "dismissalDays", "resignationDays", "delimiter", "decimal", "exportColumns"]'::jsonb) AS k(key) WHERE NOT(coalesce(c.data->'cfg'->'fiscal','{}'::jsonb) ? k.key))
 OR NOT(coalesce(c.data->'cfg'->'pos','{}'::jsonb) ? 'useDimensions') OR (c.onboarding_done=false AND c.business_type='comercio'
   AND coalesce(u.name,'')<>''
   AND NOT EXISTS (SELECT 1 FROM acontec_audit_events a WHERE a.company_id=c.id
     AND (a.action='Empresa creada' OR a.action LIKE '%perfil%' OR a.action LIKE '%completeProfile%'))))
ON CONFLICT(id) DO NOTHING;
