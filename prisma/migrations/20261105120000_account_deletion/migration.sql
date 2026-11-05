-- Self-service account deletion: a restorable period, then anonymisation. The User row stays because
-- deleting it would cascade into articles on other people's blogs and into the audit chain.
ALTER TABLE "public"."User" ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "deletionScheduledFor" TIMESTAMP(3),
ADD COLUMN     "deletionReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "anonymizedAt" TIMESTAMP(3);

CREATE INDEX "User_deletionScheduledFor_idx" ON "public"."User"("deletionScheduledFor");

-- A blog closing with its owner's account, and the Stripe subscriptions to resume if the account is restored.
ALTER TABLE "public"."ClientSite" ADD COLUMN     "closingAt" TIMESTAMP(3),
ADD COLUMN     "closingSubscriptionIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
