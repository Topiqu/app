-- Fail before creating any index when historical duplicates need an operator decision.
-- This migration never deletes or rewrites reader history. Run the read-only
-- scripts/audit-reader-identities.ts before rollout and preserve all rows during remediation.
DO $$
DECLARE
    relation_name text;
    identity_name text;
    grouping_columns text;
    duplicate_groups bigint;
BEGIN
    FOREACH relation_name IN ARRAY ARRAY['ArticleReaction', 'ArticleFeedback', 'ArticleShare'] LOOP
        FOREACH identity_name IN ARRAY ARRAY['userId', 'sessionId'] LOOP
            grouping_columns := CASE WHEN relation_name = 'ArticleShare'
                THEN format('"articleId", "platform", %I', identity_name)
                ELSE format('"articleId", %I', identity_name) END;
            EXECUTE format('SELECT count(*) FROM (SELECT 1 FROM %I WHERE %I IS NOT NULL GROUP BY %s HAVING count(*) > 1) duplicates',
                relation_name, identity_name, grouping_columns) INTO duplicate_groups;
            IF duplicate_groups > 0 THEN
                RAISE EXCEPTION 'Reader identity preflight failed: % has % duplicate % groups; no rows were changed. Run the read-only audit before migration.',
                    relation_name, duplicate_groups, identity_name;
            END IF;
        END LOOP;
    END LOOP;
END $$;
