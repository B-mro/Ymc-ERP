<template>
  <div class="scheduled-task-container">
    <el-card shadow="never" class="header-card">
      <div class="header-title">
        <span>定时任务管理</span>
        <el-button type="primary" :icon="Refresh" @click="loadTasks" :loading="loading">
          刷新列表
        </el-button>
      </div>
    </el-card>

    <el-card shadow="never" class="table-card">
      <el-table
        v-loading="loading"
        :data="taskList"
        border
        stripe
        style="width: 100%"
        :row-style="{ height: '48px' }"
        :header-cell-style="{ height: '44px' }"
      >
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column prop="taskName" label="任务名称" min-width="180" show-overflow-tooltip />
        <el-table-column prop="cronExpression" label="Cron 表达式" width="200" show-overflow-tooltip />
        <el-table-column prop="cronDescription" label="执行描述" min-width="280" show-overflow-tooltip />
        <el-table-column label="上次执行时间" width="180" align="center">
          <template #default="{ row }">
            <span v-if="row.lastExecuteTime">{{ row.lastExecuteTime }}</span>
            <el-tag v-else type="info" size="small">未执行</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="上次执行结果" width="140" align="center">
          <template #default="{ row }">
            <template v-if="row.lastExecuteSuccess === true">
              <el-tag type="success" size="small">成功</el-tag>
            </template>
            <template v-else-if="row.lastExecuteSuccess === false">
              <el-tooltip :content="row.lastExecuteMessage" placement="top" :show-after="300">
                <el-tag type="danger" size="small" class="error-tag">失败</el-tag>
              </el-tooltip>
            </template>
            <template v-else>
              <el-tag type="info" size="small">无记录</el-tag>
            </template>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="130" align="center" fixed="right">
          <template #default="{ row }">
            <el-button
              type="primary"
              size="small"
              :loading="executingKey === row.taskKey"
              @click="handleExecute(row)"
            >
              执行
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card v-if="lastError" shadow="never" class="error-card">
      <template #header>
        <span style="color: #f56c6c">最近执行错误详情</span>
      </template>
      <pre class="error-msg">{{ lastError }}</pre>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { getScheduledTasks, executeScheduledTask } from '@/api/scheduledTask'
import type { ScheduledTask } from '@/types'

defineOptions({ name: 'SystemScheduledTaskView' })

const loading = ref(false)
const executingKey = ref('')
const taskList = ref<ScheduledTask[]>([])
const lastError = ref('')

async function loadTasks() {
  loading.value = true
  try {
    taskList.value = await getScheduledTasks()
    const failTask = taskList.value.find((t) => t.lastExecuteSuccess === false)
    lastError.value = failTask
      ? `[${failTask.taskName}] ${failTask.lastExecuteMessage}`
      : ''
  } catch (e: any) {
    ElMessage.error(e?.message || '加载定时任务列表失败')
  } finally {
    loading.value = false
  }
}

async function handleExecute(row: ScheduledTask) {
  executingKey.value = row.taskKey
  try {
    const result = await executeScheduledTask(row.taskKey)
    if (result.lastExecuteSuccess) {
      ElMessage.success(`[${result.taskName}] 执行成功`)
    } else {
      ElMessage.error(`[${result.taskName}] ${result.lastExecuteMessage}`)
    }
    await loadTasks()
  } catch (e: any) {
    ElMessage.error(e?.message || '执行失败')
  } finally {
    executingKey.value = ''
  }
}

onMounted(() => {
  loadTasks()
})
</script>

<style scoped>
.scheduled-task-container {
  padding: 16px;
}

.header-card {
  margin-bottom: 16px;
}

.header-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
}

.table-card {
  margin-bottom: 16px;
}

.error-tag {
  cursor: pointer;
}

.error-card {
  border: 1px solid #f56c6c;
}

.error-card :deep(.el-card__header) {
  background-color: #fef0f0;
  border-bottom: 1px solid #f56c6c;
}

.error-msg {
  margin: 0;
  padding: 8px;
  background-color: #fef0f0;
  color: #f56c6c;
  border-radius: 4px;
  white-space: pre-wrap;
  word-break: break-all;
  font-size: 13px;
  line-height: 1.6;
}
</style>