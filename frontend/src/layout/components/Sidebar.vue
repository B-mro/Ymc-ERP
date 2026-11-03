<template>
	<div class="sidebar">
		<div class="logo">
			<!-- <span v-show="!collapse" class="logo-text">优麦驰</span> -->
			<!-- <el-icon :size="24" color="#fff"><Cpu /></el-icon> -->
			<img src="../../../image/icon-removebg-preview.png" style="width: 80px;height: 100px;" alt="">
      <span v-show="!collapse" class="logo-text">管理系统</span>
		</div>

		<el-scrollbar class="menu-scroll">
			<el-menu
				:default-active="activeMenu"
				:collapse="collapse"
				:collapse-transition="false"
				router
				background-color="#1D203D"
				text-color="#fff"
				font-family="黑体"
				active-text-color="#409eff"
				unique-opened
			>
				<!-- 固定工作台 -->
				<el-menu-item index="/dashboard">
					<el-icon><HomeFilled /></el-icon>
					<template #title>工作台</template>
				</el-menu-item>

				<!-- 后端动态菜单 -->
				<SidebarItem
					v-for="menu in userStore.menus"
					:key="menu.id"
					:menu="menu"
					:base-path="'/'"
				/>
			</el-menu>
		</el-scrollbar>
	</div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useUserStore } from "@/stores/user";
import SidebarItem from "./SidebarItem.vue";

defineProps<{ collapse: boolean }>();

const route = useRoute();
const userStore = useUserStore();

const activeMenu = computed(() => route.path);
</script>

<style scoped>
.sidebar {
	height: 100%;
	display: flex;
	flex-direction: column;
}

.logo {
	height: 80px;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	/* background-color: #fafafa; */
	background-color: #409EFF;
	flex-shrink: 0;
}

.logo-text {
	color: #fff;
	font-size: 20px;
	/* font-family: "黑体"; */
	font-weight: 600;
	white-space: nowrap;
	/* letter-spacing: 14px; */
}

.menu-scroll {
	flex: 1;
}

.menu-scroll :deep(.el-menu) {
	border-right: none;
}
</style>
