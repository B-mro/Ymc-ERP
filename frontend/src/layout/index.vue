<template>
  <el-container class="app-wrapper">
    <el-aside :width="collapsed ? '64px' : '210px'" class="sidebar-container">
      <Sidebar :collapse="collapsed" />
    </el-aside>

    <el-container class="main-container" direction="vertical">
      <HeaderBar v-model:collapse="collapsed" />
      <TagsView />
      <el-main class="app-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <keep-alive :include="tagsViewStore.cachedViews">
              <component :is="Component" :key="`${route.path}-${tagsViewStore.refreshKey}`" />
            </keep-alive>
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import Sidebar from './components/Sidebar.vue'
import HeaderBar from './components/HeaderBar.vue'
import TagsView from './components/TagsView.vue'
import { useTagsViewStore } from '@/stores/tagsView'

const collapsed = ref(false)
const route = useRoute()
const tagsViewStore = useTagsViewStore()
</script>

<style scoped>
.app-wrapper {
  height: 100%;
  /* background-color: #FAFAFA; */
}

.sidebar-container {
    background-color: #1D203D;
  /* background-color: #FAFAFA; */
  transition: width 0.28s;
  overflow: hidden;
}

.main-container {
  /* margin:10px; */
  /* height: 98%; */
  height: 100%;
  overflow: hidden;
  /* border: 1px solid #D9D9D9; */
  /* border-radius: 18px; */
  /* box-shadow: 0 2px 12px 0 rgba(183, 84, 84, 0.1); */
}

.app-main {
  background-color: #ffffff;
  padding: 16px;
  overflow-y: auto;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
