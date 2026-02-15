<template>
  <div class="min-h-screen bg-gray-900 p-10 flex flex-col items-center gap-10">
    <h1 class="text-white text-2xl">Test OG</h1>

    <div style="width: 1200px; height: 630px; border: 2px solid red; overflow: hidden">
      <OgImageTopiquArticle
        title="Jak se připravit na AI-first dobu, aby AI váš tým nenahradila, ale posílila"
        description="Tady vlož ten dlouhý text, který tam reálně posíláš. Pokud je moc dlouhý, uvidíš, jak se to chová."
        siteName="Topiqu"
        authorName="Jan Novák"
        :isPremium="true"
        themeColor="#2d5ebc"
        domain="topiqu.com"
        siteLogo="https://cdn.topiqu.com/app-logo.png"
        backgroundImage="https://cdn.topiqu.com/app-logo.png"
      />
    </div>
  </div>
</template>

<script setup lang="ts"></script>
