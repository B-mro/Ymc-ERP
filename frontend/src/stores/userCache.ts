import { defineStore } from 'pinia'
import { ref } from 'vue'
import { batchGetUsers } from '@/api/user'
import type { SysUser } from '@/types'

// 通过用户id，获取用户名称
const BATCH_DEBOUNCE_MS = 120
const MAX_BATCH_SIZE = 50

export const useUserCache = defineStore('userCache', () => {
  const cache = ref<Map<string, SysUser>>(new Map())
  const pendingIds = new Set<string>()
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let inflightPromise: Promise<void> | null = null

  function key(id: number | string | undefined | null): string | null {
    if (id == null || id === '') return null
    return String(id)
  }

  function resolveName(id: number | string | undefined | null): string {
    const k = key(id)
    if (k == null) return '-'
    const hit = cache.value.get(k)
    if (hit) return hit.nickname || hit.username || `用户${k}`
    pendingIds.add(k)
    scheduleFetch()
    return `用户${k}`
  }

  function resolve(id: number | string | undefined | null): SysUser | null {
    const k = key(id)
    if (k == null) return null
    const hit = cache.value.get(k)
    if (hit) return hit
    pendingIds.add(k)
    scheduleFetch()
    return null
  }

  function prefetch(ids: (number | string | undefined | null)[]) {
    for (const id of ids) {
      const k = key(id)
      if (k && !cache.value.has(k)) pendingIds.add(k)
    }
    if (pendingIds.size) scheduleFetch()
  }

  async function scheduleFetch() {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      if (inflightPromise) return
      if (!pendingIds.size) return
      const batch: string[] = []
      let count = 0
      for (const id of pendingIds) {
        batch.push(id)
        pendingIds.delete(id)
        if (++count >= MAX_BATCH_SIZE) break
      }
      inflightPromise = fetchBatch(batch).finally(() => {
        inflightPromise = null
        if (pendingIds.size) scheduleFetch()
      })
    }, BATCH_DEBOUNCE_MS)
  }

  async function fetchBatch(ids: string[]) {
    try {
      const users = await batchGetUsers(ids.map(Number))
      for (const u of users) {
        const k = key(u.id)
        if (k) cache.value.set(k, u)
      }
    } catch {
      for (const id of ids) {
        cache.value.set(id, { id: Number(id), nickname: '', username: '' })
      }
    }
  }

  function clear() {
    cache.value.clear()
    pendingIds.clear()
    if (debounceTimer) clearTimeout(debounceTimer)
    inflightPromise = null
  }

//   <script setup>
// import { useUserCache } from '@/stores/userCache'
// const userCache = useUserCache()
// </script>

// <template>
//   {{ userCache.resolveName(row.createUser) }}
//   {{ userCache.resolveName(row.updateUser) }}
// </template>

  return {
    cache,
    resolveName,
    resolve,
    prefetch,
    clear
  }
})