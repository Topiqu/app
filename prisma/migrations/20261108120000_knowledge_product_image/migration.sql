-- Product images for article product cards: the feed's image and our resized CDN copy of it.
ALTER TABLE "KnowledgeProduct" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "KnowledgeProduct" ADD COLUMN "cdnImageUrl" TEXT;
ALTER TABLE "KnowledgeProduct" ADD COLUMN "cdnImageSource" TEXT;
