<template>
  <div class="p-6">
    <h1 class="text-2xl font-bold mb-6">Content Drafts</h1>

    <div class="mb-4 flex space-x-2">
      <button
        v-for="status in ['ALL', 'DRAFT', 'AWAITING_APPROVAL', 'APPROVED', 'REJECTED', 'PUBLISHED']"
        :key="status"
        class="px-3 py-1 rounded border"
        :class="
          filterStatus === status || (filterStatus === '' && status === 'ALL')
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-gray-700'
        "
        @click="filterStatus = status === 'ALL' ? '' : status"
      >
        {{ status }}
      </button>
    </div>

    <div v-if="pending" class="text-gray-500">Loading drafts...</div>
    <div v-else-if="error" class="text-red-500">{{ error.message }}</div>

    <div v-else class="space-y-4">
      <div v-for="draft in filteredDrafts" :key="draft.id" class="bg-white p-6 rounded-lg shadow flex flex-col gap-4">
        <div class="flex justify-between items-start">
          <div>
            <h3 class="font-bold text-lg">Topic: {{ draft.task?.topic || 'Unknown' }}</h3>
            <p class="text-sm text-gray-500">Company: {{ draft.task?.company?.name }}</p>
          </div>
          <span class="px-2 py-1 text-xs font-semibold rounded-full" :class="statusClass(draft.status)">
            {{ draft.status }}
          </span>
        </div>

        <div class="bg-gray-50 p-4 rounded text-sm whitespace-pre-wrap border">{{ draft.text }}</div>

        <div class="flex items-center gap-4 text-sm">
          <span class="font-medium"
            >Score: <span :class="draft.score >= 70 ? 'text-green-600' : 'text-red-600'">{{ draft.score }}</span></span
          >
          <span v-if="draft.policyFlags && draft.policyFlags.length > 0" class="text-red-500">
            Flags: {{ draft.policyFlags.join(', ') }}
          </span>
        </div>

        <div v-if="draft.status === 'AWAITING_APPROVAL' || draft.status === 'DRAFT'" class="flex gap-2">
          <button class="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700" @click="approveDraft(draft.id)">
            Approve
          </button>
          <button class="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700" @click="rejectDraft(draft.id)">
            Reject
          </button>
          <button class="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700" @click="publishDraft(draft.id)">
            Publish Now
          </button>
        </div>
      </div>

      <div v-if="filteredDrafts.length === 0" class="text-gray-500 text-center py-8">
        No drafts found for the selected status.
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const filterStatus = shallowRef('')
const { data: drafts, pending, error, refresh } = await useFetch('/api/drafts')

const filteredDrafts = computed(() => {
  if (!drafts.value) return []
  if (!filterStatus.value) return drafts.value
  return drafts.value.filter((d: any) => d.status === filterStatus.value)
})

function statusClass(status: string) {
  switch (status) {
    case 'PUBLISHED':
      return 'bg-green-100 text-green-800'
    case 'APPROVED':
      return 'bg-blue-100 text-blue-800'
    case 'AWAITING_APPROVAL':
      return 'bg-yellow-100 text-yellow-800'
    case 'REJECTED':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

async function approveDraft(id: string) {
  try {
    await $fetch(`/api/drafts/${id}/approve`, { method: 'POST' })
    refresh()
  } catch (err: any) {
    alert(`Error: ${err.message}`)
  }
}

async function rejectDraft(id: string) {
  const reason = prompt('Reason for rejection:')
  if (reason === null) return // Cancelled
  try {
    await $fetch(`/api/drafts/${id}/reject`, { method: 'POST', body: { reason } })
    refresh()
  } catch (err: any) {
    alert(`Error: ${err.message}`)
  }
}

async function publishDraft(id: string) {
  if (!confirm('Are you sure you want to publish this draft immediately?')) return
  try {
    await $fetch(`/api/publish/${id}`, { method: 'POST' })
    refresh()
    alert('Publish request sent')
  } catch (err: any) {
    alert(`Error: ${err.message}`)
  }
}
</script>
