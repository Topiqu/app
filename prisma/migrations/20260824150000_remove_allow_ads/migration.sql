-- Platform ads are derived from the plan, while tenant-owned GAM is enabled by
-- gamNetworkCode. The ambiguous mutable flag is no longer needed.
ALTER TABLE "ClientSite" DROP COLUMN "allowAds";
