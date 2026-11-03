<template>
  <el-header class="header">
    <div class="header-left">
      <el-icon class="collapse-btn" :size="20" @click="toggleCollapse">
        <Fold v-if="!collapse" />
        <Expand v-else />
      </el-icon>
      <el-breadcrumb separator="/">
        <el-breadcrumb-item
          v-for="(item, index) in route.matched.filter((r) => r.meta?.title)"
          :key="item.path + '-' + index"
        >
          {{ item.meta.title }}
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="header-right">
      <el-tag v-for="role in userStore.roles" :key="role" size="small" class="role-tag">
        {{ role }}
      </el-tag>
      <el-dropdown @command="onCommand">
        <span class="user-info">
          <el-avatar :size="30" class="avatar">
            <el-icon><UserFilled /></el-icon>
          </el-avatar>
          <span class="username">{{ userStore.userInfo.nickname || userStore.userInfo.username }}</span>
          <el-icon><CaretBottom /></el-icon>
        </span>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="dashboard">
              <el-icon><HomeFilled /></el-icon>工作台
            </el-dropdown-item>
            <el-dropdown-item command="logout" divided>
              <el-icon><SwitchButton /></el-icon>退出登录
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
    </div>
  </el-header>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { useUserStore } from '@/stores/user'

const collapse = defineModel<boolean>('collapse', { default: false })

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

function toggleCollapse() {
  collapse.value = !collapse.value
}

async function onCommand(command: string) {
  if (command === 'dashboard') {
    router.push('/dashboard')
  } else if (command === 'logout') {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    userStore.logout()
  }
}
</script>

<style scoped>
.header {
  height: 80px;
  background: #fff;
  border-bottom: 1px solid #e6e6e6;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.collapse-btn {
  cursor: pointer;
  color: #5a5e66;
}

.collapse-btn:hover {
  color: #409eff;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.role-tag {
  text-transform: uppercase;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  outline: none;
}

.avatar {
  background-color: #409eff;
}

.username {
  font-size: 14px;
  color: #303133;
}
</style>