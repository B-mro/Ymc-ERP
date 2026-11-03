<template>
  <!-- 目录：含可见子项时渲染为子菜单 -->
  <el-sub-menu
    v-if="visibleChildren.length > 0 && menu.menuType === 'M'"
    :index="resolvePath(menu)"
  >
    <template #title>
      <el-icon v-if="menu.icon"><component :is="menu.icon" /></el-icon>
      <span>{{ menu.menuName }}</span>
    </template>
    <SidebarItem
      v-for="child in visibleChildren"
      :key="child.id"
      :menu="child"
      :base-path="resolvePath(menu)"
    />
  </el-sub-menu>

  <!-- 菜单项 -->
  <el-menu-item v-else-if="menu.menuType !== 'F'" :index="resolvePath(menu)">
    <el-icon v-if="menu.icon"><component :is="menu.icon" /></el-icon>
    <template #title>{{ menu.menuName }}</template>
  </el-menu-item>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SysMenu } from '@/types'

const props = defineProps<{
  menu: SysMenu
  basePath: string
}>()

const visibleChildren = computed(() =>
  (props.menu.children || []).filter(
    (c) => c.menuType !== 'F' && c.visible !== '1' && c.status !== '1'
  )
)

/** 拼接完整路由地址 */
function resolvePath(menu: SysMenu): string {
  const path = menu.path || ''
  if (path.startsWith('/')) {
    return path
  }
  const base = props.basePath.endsWith('/')
    ? props.basePath.slice(0, -1)
    : props.basePath
  return `${base}/${path}`
}
</script>
