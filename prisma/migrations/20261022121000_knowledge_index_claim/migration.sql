-- Additive fencing token: a reclaimed worker cannot mutate the replacement's run.
-- Old binaries do not set this field, so stop/drain indexing workers before rollout;
-- unowned PROCESSING work is reclaimed through the normal stale-claim timeout.
ALTER TABLE "KnowledgeSource" ADD COLUMN "indexingToken" TEXT;
