<template>
	<div>
		<el-card shadow="never" class="welcome-card">
			<div class="welcome">
				<el-avatar :size="56" class="avatar">
					<el-icon :size="30"><UserFilled /></el-icon>
				</el-avatar>
				<div>
					<h2 class="hello">
						你好，{{
							userStore.userInfo.nickname || userStore.userInfo.username
						}}
						<el-tag v-if="userStore.isAdmin" type="danger" size="small"
							>超级管理员</el-tag
						>
					</h2>
					<p class="desc">欢迎使用权限管理系统，今天也要元气满满哦！</p>
				</div>
			</div>
		</el-card>

		<el-row :gutter="16" class="stat-row">
			<el-col :span="8">
				<el-card shadow="hover" class="stat-card">
					<div class="stat-icon" style="background-color: #409eff">
						<el-icon :size="28"><UserFilled /></el-icon>
					</div>
					<div class="stat-content">
						<div class="stat-value">{{ userStore.roles.length }}</div>
						<div class="stat-label">我的角色</div>
					</div>
				</el-card>
			</el-col>
			<el-col :span="8">
				<el-card shadow="hover" class="stat-card">
					<div class="stat-icon" style="background-color: #67c23a">
						<el-icon :size="28"><Key /></el-icon>
					</div>
					<div class="stat-content">
						<div class="stat-value">
							{{ userStore.isAdmin ? "全部" : userStore.permissions.length }}
						</div>
						<div class="stat-label">权限标识</div>
					</div>
				</el-card>
			</el-col>
			<el-col :span="8">
				<el-card shadow="hover" class="stat-card">
					<div class="stat-icon" style="background-color: #e6a23c">
						<el-icon :size="28"><Menu /></el-icon>
					</div>
					<div class="stat-content">
						<div class="stat-value">{{ menuCount }}</div>
						<div class="stat-label">可见菜单</div>
					</div>
				</el-card>
			</el-col>
		</el-row>

		<el-card shadow="never" class="quick-card">
			<template #header>
				<span>系统快捷入口（按权限显示）</span>
			</template>
			<el-space wrap>
				<el-button
					v-hasPermi="['system:user:list']"
					type="primary"
					@click="go('/system/user')"
				>
					用户管理
				</el-button>
				<el-button
					v-hasPermi="['system:role:list']"
					type="success"
					@click="go('/system/role')"
				>
					角色管理
				</el-button>
				<el-button
					v-hasPermi="['system:menu:list']"
					type="warning"
					@click="go('/system/menu')"
				>
					菜单管理
				</el-button>
				<el-button
					v-hasPermi="['system:permission:list']"
					type="danger"
					@click="go('/system/permission')"
				>
					权限管理
				</el-button>
				<el-button
					v-hasPermi="['finance:customerInvoice:menu']"
					type="danger"
					@click="go('/finance/customerInvoice')"
				>
					财务管理
				</el-button>
				
			</el-space>
		</el-card>
		<el-card shadow="never" class="quick-card" style="margin-top: 16px">
			<template #header>
				<span>人员菜单权限管理流程（新增菜单的权限分配流程）</span>
			</template>
			<el-alert :closable="false" title="人员-角色-菜单-权限" type="error"> </el-alert>
			<el-alert :closable="false" title="先在代码中创建菜单" type="success"> </el-alert>
			<el-alert :closable="false" title="点击权限管理-对创建的菜单设置权限" type="success"> </el-alert>
			<el-alert :closable="false" title="点击菜单管理-新增菜单，将创建的菜单映射出来" type="success"> </el-alert>
			<el-alert :closable="false" title="点击角色管理-分配菜单，将新增的菜单分配给需要的角色。" type="success"> </el-alert>
		</el-card>
	</div>
</template>

<script setup lang="ts">
defineOptions({ name: 'DashboardView' })
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "@/stores/user";
import type { SysMenu } from "@/types";

const router = useRouter();
const userStore = useUserStore();

const menuCount = computed(() => {
	let count = 0;
	const walk = (list: SysMenu[]) => {
		for (const m of list) {
			if (m.menuType === "M" || m.menuType === "C") count++;
			if (m.children) walk(m.children);
		}
	};
	walk(userStore.menus);
	return count;
});

function go(path: string) {
	router.push(path);
}


</script>

<style scoped>
.welcome-card {
	margin-bottom: 16px;
}

.welcome {
	display: flex;
	align-items: center;
	gap: 18px;
}

.avatar {
	background-color: #409eff;
}

.hello {
	margin: 0 0 6px;
	font-size: 20px;
	display: flex;
	align-items: center;
	gap: 8px;
}

.desc {
	margin: 0;
	color: #909399;
	font-size: 13px;
}

.stat-row {
	margin-bottom: 16px;
}

.stat-card :deep(.el-card__body) {
	display: flex;
	align-items: center;
	gap: 16px;
}

.stat-icon {
	width: 56px;
	height: 56px;
	border-radius: 8px;
	color: #fff;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.stat-value {
	font-size: 24px;
	font-weight: 600;
	color: #303133;
}

.stat-label {
	font-size: 13px;
	color: #909399;
	margin-top: 2px;
}
</style>
