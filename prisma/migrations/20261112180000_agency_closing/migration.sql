-- An agency closing with its last owner's account, and the Stripe subscriptions to resume if it is restored.
ALTER TABLE "public"."BillingAccount" ADD COLUMN     "closingAt" TIMESTAMP(3),
ADD COLUMN     "closingSubscriptionIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
