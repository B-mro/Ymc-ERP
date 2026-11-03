<template>
  <div class="system-page">
    <el-card shadow="never" class="search-bar">
      <el-input
        v-model="queryParams.permissionName"
        placeholder="权限名称"
        clearable
        style="width: 180px"
        @keyup.enter="handleQuery"
      />
      <el-input
        v-model="queryParams.permissionCode"
        placeholder="权限标识"
        clearable
        style="width: 200px"
        @keyup.enter="handleQuery"
      />
      <el-button type="primary" :icon="Search" @click="handleQuery">查询</el-button>
      <el-button :icon="Refresh" @click="resetQuery">重置</el-button>
      <el-button
        v-hasPermi="['system:permission:add']"
        type="primary"
        :icon="Plus"
        @click="openDialog()"
      >
        新增权限
      </el-button>
    </el-card>

    <el-card shadow="never" class="table-card">
      <div class="table-wrapper">
        <el-table
          v-loading="loading"
          :data="tableData"
          border
          stripe
          height="100%"
          :row-style="{ height: '38px' }"
          :header-cell-style="{ height: '38px' }"
        >
         <el-table-column  type="index" label="序号" width="70" align="center" :index="indexMethod" />
        <el-table-column  v-if="false" prop="id" label="ID" width="70" align="center" />
        <el-table-column prop="permissionName" label="权限名称" min-width="140" />
        <el-table-column prop="permissionCode" label="权限标识" min-width="220">
          <template #default="{ row }">
            <code class="perm-code">{{ row.permissionCode }}</code>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="90" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="typeTag(row.permissionType)">
              {{ typeLabel(row.permissionType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === '0' ? 'success' : 'info'">
              {{ row.status === '0' ? '正常' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
        <el-table-column prop="createTime" label="创建时间" min-width="160" />
        <el-table-column label="操作" width="160" fixed="right" align="center">
          <template #default="{ row }">
            <el-button
              v-hasPermi="['system:permission:edit']"
              type="primary"
              link
              @click="openDialog(row)"
            >
              修改
            </el-button>
            <el-button
              v-hasPermi="['system:permission:remove']"
              type="danger"
              link
              @click="handleDelete(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
        </el-table>
      </div>

      <el-pagination
        class="table-pagination"
        v-model:current-page="queryParams.pageNum"
        v-model:page-size="queryParams.pageSize"
        :page-sizes="[10, 20, 50]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadData"
        @current-change="loadData"
      />
    </el-card>

    <el-dialog v-model="dialogVisible" :close-on-click-modal="false" :title="dialogTitle" width="500px" @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px">
        <el-form-item label="权限名称" prop="permissionName">
          <el-input v-model="form.permissionName" placeholder="如 用户新增" />
        </el-form-item>
        <el-form-item label="权限标识" prop="permissionCode">
          <el-input v-model="form.permissionCode" placeholder="如 system:user:add" />
        </el-form-item>
        <el-form-item label="权限类型">
          <el-select v-model="form.permissionType" style="width: 100%">
            <el-option label="菜单 (menu)" value="menu" />
            <el-option label="按钮 (button)" value="button" />
            <el-option label="接口 (api)" value="api" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="0">正常</el-radio>
            <el-radio value="1">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="handleSubmit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'SystemPermissionView' })
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus, Refresh, Search } from '@element-plus/icons-vue'
import {
  addPermission,
  deletePermissions,
  pagePermissions,
  updatePermission
} from '@/api/permission'
import type { SysPermission } from '@/types'

const loading = ref(false)
const tableData = ref<SysPermission[]>([])
const total = ref(0)

const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  permissionName: '',
  permissionCode: ''
})

const dialogVisible = ref(false)
const submitLoading = ref(false)
const isEdit = ref(false)
const dialogTitle = ref('新增权限')
const formRef = ref<FormInstance>()

const form = reactive<SysPermission>({
  permissionName: '',
  permissionCode: '',
  permissionType: 'button',
  status: '0',
  remark: ''
})

const rules: FormRules = {
  permissionName: [{ required: true, message: '请输入权限名称', trigger: 'blur' }],
  permissionCode: [{ required: true, message: '请输入权限标识', trigger: 'blur' }]
}

async function loadData() {
  loading.value = true
  try {
    const res = await pagePermissions(queryParams)
    tableData.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

function handleQuery() {
  queryParams.pageNum = 1
  loadData()
}

function resetQuery() {
  queryParams.permissionName = ''
  queryParams.permissionCode = ''
  handleQuery()
}

function openDialog(row?: SysPermission) {
  isEdit.value = !!row
  dialogTitle.value = isEdit.value ? '修改权限' : '新增权限'
  if (row) {
    Object.assign(form, JSON.parse(JSON.stringify(row)))
  } else {
    Object.assign(form, {
      id: undefined,
      permissionName: '',
      permissionCode: '',
      permissionType: 'button',
      status: '0',
      remark: ''
    })
  }
  dialogVisible.value = true
}

function resetForm() {
  formRef.value?.resetFields()
}

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitLoading.value = true
    try {
      if (isEdit.value) {
        await updatePermission({ ...form })
        ElMessage.success('修改成功')
      } else {
        await addPermission({ ...form })
        ElMessage.success('新增成功')
      }
      dialogVisible.value = false
      loadData()
    } finally {
      submitLoading.value = false
    }
  })
}

async function handleDelete(row: SysPermission) {
  await ElMessageBox.confirm(`确定删除权限「${row.permissionName}」吗？`, '提示', {
    type: 'warning'
  })
  await deletePermissions([row.id!])
  ElMessage.success('删除成功')
  loadData()
}

function typeLabel(type: string) {
  return { menu: '菜单', button: '按钮', api: '接口' }[type] || type
}

function typeTag(type: string) {
  return ({ menu: 'success', button: 'warning', api: 'danger' } as Record<string, string>)[
    type
  ] || 'info'
}

 function indexMethod(index: number) {
  return (queryParams.pageNum - 1) * queryParams.pageSize + index + 1
}

onMounted(loadData)
</script>

<style scoped>
:deep(.perm-code) {
  font-family: 'Courier New', monospace;
  color: #c7254e;
  background-color: #f9f2f4;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
}

/* ===== 页面整体：纵向 flex，撑满内容区高度 ===== */
.system-page {
	display: flex;
	flex-direction: column;
	height: 100%;
	gap: 8px;
}

/* ===== 搜索栏压缩 ===== */
.search-bar {
	flex-shrink: 0;
}
.search-bar :deep(.el-card__body) {
	padding: 8px 12px;
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px;
}
.search-bar :deep(.el-form-item) {
	margin-bottom: 8px;
}
.search-bar :deep(.el-form-item__label) {
	padding-right: 6px;
}
.search-bar :deep(.el-input__wrapper),
.search-bar :deep(.el-select__wrapper) {
	height: 30px;
	padding: 0 8px;
}
.search-bar :deep(.el-button) {
	padding: 7px 14px;
	height: 30px;
}

/* ===== 列表卡片：占满剩余高度 ===== */
.table-card {
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
}
.table-card :deep(.el-card__body) {
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
}

/* 表格容器：撑满剩余空间 */
.table-wrapper {
	flex: 1;
	min-height: 0;
}

/* 固定行高 38px，内容垂直居中 */
.table-wrapper :deep(.el-table .cell) {
	line-height: 35px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

/* 分页高度压缩，把空间让给表格 */
.table-pagination {
	flex-shrink: 0;
	margin-top: 6px;
	justify-content: flex-end;
}
.table-pagination :deep(.el-pagination) {
	font-size: 12px;
}
.table-pagination :deep(.el-pagination button),
.table-pagination :deep(.el-pagination .el-pager li) {
	min-width: 24px;
	height: 24px;
	line-height: 24px;
	font-size: 12px;
}
.table-pagination :deep(.el-pagination .el-pagination__sizes .el-select) {
	height: 24px;
}
.table-pagination :deep(.el-pagination .el-select__wrapper) {
	height: 24px;
	min-height: 24px;
}
</style>
