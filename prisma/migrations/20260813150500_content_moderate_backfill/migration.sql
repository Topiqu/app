UPDATE "TenantMembership"
SET "scopes" = array_append("scopes", 'CONTENT_MODERATE'::"TenantScope")
WHERE NOT ('CONTENT_MODERATE'::"TenantScope" = ANY("scopes"));
