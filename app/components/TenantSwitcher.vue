<template><FormSelect v-if="memberships.length > 1" v-model="active" :items="options" class="max-w-40" /></template>
<script setup lang="ts">
const { data: auth, getSession } = useAuth()
type MembershipOption = {clientSiteId:string;clientSite:{name:string}}
const { data } = await useFetch<MembershipOption[]>('/api/tenant/memberships')
const memberships = computed<MembershipOption[]>(() => (data.value as MembershipOption[] | null) ?? [])
const options = computed(() => memberships.value.map(m => ({label:m.clientSite.name,value:m.clientSiteId})))
const active = computed({ get:()=>auth.value?.user.clientSiteId ?? '', set:async(clientSiteId:string)=>{ await $fetch('/api/tenant/active',{method:'POST',body:{clientSiteId}});await getSession();window.location.reload() } })
</script>
