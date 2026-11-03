<template>
  <div class="tags-view">
    <el-tabs
      class="tags-tabs"
      :model-value="route.path"
      type="card"
      @tab-click="onTabClick"
      @tab-remove="onTabRemove"
    >
      <el-tab-pane
        v-for="tag in tagsViewStore.visitedViews"
        :key="tag.path"
        :name="tag.path"
        :closable="!tag.affix"
      >
        <template #label>
          <el-dropdown
            trigger="contextmenu"
            @command="(cmd: string) => onTabCommand(cmd, tag)"
          >
            <span class="tag-label" @contextmenu.prevent>
              <el-icon v-if="tag.affix" class="tag-affix-icon"><HomeFilled /></el-icon>
              {{ tag.title }}
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="refresh">
                  <el-icon class="menu-icon"><Refresh /></el-icon>
                  刷新
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </el-tab-pane>
    </el-tabs>

    <el-dropdown
      class="tags-actions"
      trigger="click"
      @command="onCommand"
    >
      <el-button text :icon="ArrowDown" title="标签操作" />
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item command="others">关闭其他标签</el-dropdown-item>
          <el-dropdown-item command="all">关闭全部标签</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type TabPaneName, type TabsPaneContext } from 'element-plus'
import { ArrowDown, HomeFilled, Refresh } from '@element-plus/icons-vue'
import { useTagsViewStore } from '@/stores/tagsView'
import type { TagView } from '@/stores/tagsView'

const route = useRoute()
const router = useRouter()
const tagsViewStore = useTagsViewStore()

// 路由变化时收录标签；immediate 保证刷新页面后当前页仍在标签栏
watch(
  () => route.path,
  () => tagsViewStore.addView(route),
  { immediate: true }
)

function onTabClick(pane: TabsPaneContext) {
  const path = pane.paneName as TabPaneName
  if (typeof path === 'string' && path !== route.path) {
    router.push(path)
  }
}

function onTabRemove(target: TabPaneName) {
  if (typeof target !== 'string') return
  const nextPath = tagsViewStore.closeView(target)
  // 关闭的是当前标签时跳到相邻标签
  if (target === route.path && nextPath) {
    router.push(nextPath)
  }
}

function onCommand(command: string) {
  if (command === 'others') {
    tagsViewStore.closeOthers(route.path)
  } else if (command === 'all') {
    const nextPath = tagsViewStore.closeAll()
    if (nextPath !== route.path) router.push(nextPath)
  }
}

function onTabCommand(command: string, tag: TagView) {
  if (command === 'refresh') {
    tagsViewStore.refreshView(tag.path, tag.path === route.path)
    ElMessage.success({ message: '刷新成功', duration: 1000 })
  }
}
</script>

<style scoped>
.tags-view {
  position: relative;
  display: flex;
  align-items: center;
  background-color: #fff;
  border-bottom: 1px solid #d8dce5;
  padding: 0 8px;
  height: 38px;
  box-shadow: 0 1px 4px rgb(0 21 41 / 8%);
}

.tags-tabs {
  flex: 1;
  min-width: 0;
}

:deep(.tags-tabs .el-tabs__header) {
  margin: 0;
  border: none;
}

:deep(.tags-tabs .el-tabs__nav) {
  border: none;
}

:deep(.tags-tabs .el-tabs__item) {
  height: 28px;
  line-height: 26px;
  margin: 5px 4px 0 0;
  padding: 0 12px;
  border: 1px solid #d8dce5;
  border-radius: 3px;
  color: #495060;
  background: #fff;
  font-size: 12px;
  transition: all 0.2s;
}

:deep(.tags-tabs .el-tabs__item:hover) {
  color: #409eff;
}

:deep(.tags-tabs .el-tabs__item.is-active) {
  background: #409eff;
  border-color: #409eff;
  color: #fff;
}

:deep(.tags-tabs .el-tabs__item.is-active .tag-affix-icon) {
  color: #fff;
}

:deep(.tags-tabs .el-tabs__item .is-icon-close) {
  width: 14px;
  height: 14px;
  line-height: 14px;
  border-radius: 50%;
  margin-left: 4px;
  font-size: 10px;
}

:deep(.tags-tabs .el-tabs__item .is-icon-close:hover) {
  background: rgb(255 255 255 / 30%);
  color: #fff;
}

.tag-label {
  display: inline-flex;
  align-items: center;
}

.tag-affix-icon {
  margin-right: 4px;
  font-size: 12px;
}

.menu-icon {
  margin-right: 6px;
  vertical-align: middle;
}

.tags-actions {
  flex-shrink: 0;
  margin-left: 8px;
  padding-left: 8px;
  border-left: 1px solid #ebeef5;
}
</style>
