ALTER TYPE "EmailTokenType" ADD VALUE 'TWO_FACTOR_CODE';

CREATE TYPE "TwoFactorMethod" AS ENUM ('APP', 'EMAIL');

ALTER TABLE "User"
  ADD COLUMN "two_factor_method" "TwoFactorMethod" NOT NULL DEFAULT 'APP';
