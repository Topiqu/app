-- NextAuth JWTs carry no Better Auth token, so every existing session is dropped and users sign in again.
DELETE FROM "public"."Session";

ALTER TABLE "public"."Session" DROP COLUMN "revoked";
ALTER TABLE "public"."Session" ADD COLUMN "token" TEXT NOT NULL;
ALTER TABLE "public"."Session" ADD COLUMN "expiresAt" TIMESTAMP(3) NOT NULL;
CREATE UNIQUE INDEX "Session_token_key" ON "public"."Session"("token");

CREATE TABLE "public"."Account" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "public"."Account"("providerId", "accountId");
CREATE INDEX "Account_userId_idx" ON "public"."Account"("userId");
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "public"."Verification" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Verification_identifier_idx" ON "public"."Verification"("identifier");
