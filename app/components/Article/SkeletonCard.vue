<template>
  <UCard v-if="pending" aria-busy="true">
    <div class="space-y-4">
      <USkeleton class="aspect-[8/5] w-full" />
      <USkeleton class="h-6 w-3/4" />
      <USkeleton class="h-4 w-full" />
      <USkeleton class="h-9 w-1/2" />
    </div>
  </UCard>
  <ArticleCard v-else-if="article" :article="article" :variant="isFeatured ? 'featured' : 'standard'" />
</template>

<script setup lang="ts">
import type { ArticleCardData } from '~~/shared/types/article'

defineProps<{
  pending: boolean
  isFeatured?: boolean
  article?: ArticleCardData
  tags?: ArticleCardData['tags']
  index?: number
  selectedTag?: string
}>()
</script>

<style scoped>
.editorial-card {
  --card-ink: #17211b;
  --card-muted: #68736b;
  --card-accent: var(--client-accent, #2563eb);
  --card-line: rgb(23 33 27 / 12%);
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  overflow: hidden;
  border: 1px solid var(--card-line);
  border-radius: 1.35rem;
  background: #fbfaf6;
  box-shadow: 0 1px 0 rgb(255 255 255 / 80%) inset;
  transition:
    transform 220ms ease,
    box-shadow 220ms ease,
    border-color 220ms ease;
}

.editorial-card:hover {
  transform: translateY(-4px);
  border-color: color-mix(in srgb, var(--card-accent) 35%, transparent);
  box-shadow: 0 18px 45px rgb(23 33 27 / 10%);
}
.editorial-card__media-link {
  display: block;
  overflow: hidden;
}
.editorial-card__image {
  display: block;
  width: 100%;
  height: clamp(11.5rem, 20vw, 15rem);
  object-fit: cover;
  transition: transform 500ms cubic-bezier(0.2, 0.75, 0.2, 1);
}
.editorial-card__image--featured {
  height: clamp(17rem, 38vw, 31rem);
}
.editorial-card:hover .editorial-card__image {
  transform: scale(1.035);
}
.editorial-card__tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  padding: 1rem 1.15rem 0;
}
.editorial-card__tags--featured {
  padding: 1.25rem clamp(1.15rem, 3vw, 2rem) 0;
}
.editorial-card__tag {
  padding: 0.35rem 0.65rem !important;
  border: 1px solid color-mix(in srgb, var(--card-accent) 22%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--card-accent) 8%, transparent);
  color: var(--card-accent);
  font-size: 0.7rem !important;
  font-weight: 750;
  letter-spacing: 0.04em;
  text-decoration: none;
  text-transform: uppercase;
}
.editorial-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 1rem 1.15rem 1.2rem;
}
.editorial-card__body--featured {
  padding: clamp(1.25rem, 3vw, 2rem);
}
.editorial-card__title {
  color: var(--card-ink);
  line-height: 1.12;
  letter-spacing: -0.025em;
  text-wrap: balance;
  transition: color 160ms ease;
}
.editorial-card__title:hover {
  color: var(--card-accent);
}
.editorial-card__excerpt {
  margin-top: 0.7rem;
  color: var(--card-muted);
  font-size: 0.88rem;
  line-height: 1.6;
}
.editorial-card__excerpt--featured {
  margin-top: 1.15rem;
  font-size: clamp(0.95rem, 1.5vw, 1.08rem);
  line-height: 1.7;
}
.editorial-card__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.65rem 1rem;
  margin-top: auto;
  padding-top: 1.3rem;
  color: var(--card-muted);
  font-size: 0.75rem;
  border-top: 1px solid var(--card-line);
}
.editorial-card__author {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.8rem;
}
.editorial-card__author--featured {
  margin-top: 1rem;
}

:global(html.dark) .editorial-card {
  --card-ink: #f1eee7;
  --card-muted: #a9b2ab;
  --card-line: rgb(241 238 231 / 13%);
  background: #19221c;
}

@media (max-width: 600px) {
  .editorial-card,
  .editorial-card--featured {
    border-radius: 1.1rem;
  }
  .editorial-card__image,
  .editorial-card__image--featured {
    height: clamp(13rem, 63vw, 20rem);
  }
  .editorial-card__body,
  .editorial-card__body--featured {
    padding: 1rem 1rem 1.15rem;
  }
  .editorial-card__tags,
  .editorial-card__tags--featured {
    padding: 0.9rem 1rem 0;
  }
  .editorial-card__meta {
    flex-direction: row;
    align-items: center;
  }
}
</style>
