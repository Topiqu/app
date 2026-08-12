-- PostgreSQL requires a newly added enum value to be committed before it is used.
ALTER TYPE "FeatureCodes" ADD VALUE IF NOT EXISTS 'SEARCH_CONSOLE';
