# Shopify catalog and knowledge

Shopify settings now offer an explicit product import with the same knowledge-processing consent as other sources. It creates one `SHOPIFY` source per connection, in the selected article language. The normal knowledge controls allow excluding the source from articles or deleting it to stop synchronization.

## Ingestion and product sync

- The GraphQL Admin API reads active products published to the online store, all their variant pages and all collection membership pages. Products without a public URL are excluded. Prices use the shop currency, not market-specific prices.
- Variants merge into a single knowledge product. Names, descriptions, options, brands, product types and collection names/descriptions enter the search index. Price and availability stay structured facts; those changes do not require new embeddings.
- Signed product, collection and inventory webhooks queue a current-state sync. Duplicate or late webhook payloads cannot restore old facts because payloads are never applied directly.
- A revision counter records events received during a sync. The `shopify-catalog` task queues another pass when the completed revision differs. The knowledge worker handles retries, stale workers and indexing. API cost pacing and source heartbeats also cover long catalog reads.
- Daily knowledge refresh repairs missed webhooks. Failed API reads never apply a partial snapshot. Successfully empty catalogs remove old products, as do deleted/unpublished products on the next successful sync.
- Existing product quotas apply across all knowledge sources. Very large catalogs import a stable prefix ordered by Shopify product ID; the UI reports the limit. Omitted counts are a lower bound because the adapter stops reading past the quota. Collection counts describe imported products only.
- Disconnected stores are excluded from knowledge retrieval. A shop-redact deletion cascades to its knowledge source and products. No orders or customer data are collected.

## Collection intelligence

Product search includes collection membership and descriptions, so article generation can retrieve relevant products for a collection topic. Shopify settings show collections sorted by available imported products, with product counts and an action to open the AI article editor with a buying-guide brief. Out-of-stock products are excluded by knowledge retrieval; backorders remain orderable.

This is collection context and topic discovery. Revenue attribution, content coverage scoring and bidirectional article conflict resolution are outside this change.

## Release

1. Deploy migration `20261001120000_shopify_knowledge` with the normal database release command.
2. Deploy `shopify.app.toml` through the Shopify app release workflow. The code and app configuration now request `read_inventory` for inventory webhooks, alongside existing product/content access.
3. Existing stores can import products with `read_products`; reconnecting grants inventory webhook access. The interface offers that reconnect. Daily refresh remains available without it.
4. Ensure scheduled tasks run. For external scheduling, call the protected `/api/crons/shopify-catalog` endpoint every five minutes, alongside existing knowledge indexing and refresh schedules.

API references: [Product](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/Product), [ProductVariant](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/ProductVariant), [InventoryItem](https://shopify.dev/docs/api/admin-graphql/2026-07/objects/InventoryItem), [webhooks](https://shopify.dev/docs/api/webhooks/latest).
