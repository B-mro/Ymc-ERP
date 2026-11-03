<template>
  <div class="system-page">
    <el-card shadow="never" class="search-bar">
      <el-input
        v-model="queryParams.perms"
        placeholder="权限标识 / 菜单名称"
        clearable
        style="width: 220px"
        @keyup.enter="handleQuery"
      />
      <el-button type="primary" :icon="Search" @click="handleQuery">查询</el-button>
      <el-button :icon="Refresh" @click="resetQuery">重置</el-button>
      <el-button type="primary" :icon="Plus" @click="openDialog()">新增规则</el-button>
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
        <el-table-column type="index" label="序号" width="70" align="center" :index="indexMethod" />
        <el-table-column prop="scopeName" label="规则名称" min-width="160" />
        <el-table-column label="所属菜单" min-width="180">
          <template #default="{ row }">
            <template v-if="row.perms">
              <el-tag size="small" type="info" effect="plain">
                {{ menuNameMap[row.perms] || row.perms }}
              </el-tag>
              <div class="perms-sub">{{ row.perms }}</div>
            </template>
            <el-tag v-else size="small" type="warning" effect="plain">
              未绑定菜单
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="范围类型" width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.scopeType === 'ALL' ? 'success' : 'warning'">
              {{ scopeTypeLabel(row.scopeType) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="fieldName" label="权限字段" width="140" />
        <el-table-column prop="valueSource" label="取值来源" width="100" align="center">
          <template #default="{ row }">
            {{ row.valueSource === 'USERID' ? '用户ID' : '用户名' }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="80" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.status === '0' ? 'success' : 'info'">
              {{ row.status === '0' ? '正常' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="绑定角色" width="120" align="center">
          <template #default="{ row }">
            <el-button type="primary" link @click="openBindDialog(row)">配置</el-button>
          </template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
        <el-table-column prop="createTime" label="创建时间" width="170" />
        <el-table-column label="操作" width="160" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link @click="openDialog(row)">修改</el-button>
            <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
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

    <el-dialog v-model="dialogVisible" :title="dialogTitle" :close-on-click-modal="false" width="560px" @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="规则名称" prop="scopeName">
          <el-input v-model="form.scopeName" placeholder="如 Fedex-仅本人" />
        </el-form-item>
        <el-form-item label="所属菜单" prop="perms">
          <el-select
            v-model="form.perms"
            filterable
            clearable
            placeholder="选择要控制数据权限的菜单"
            style="width: 100%"
          >
            <el-option
              v-for="m in menuPermOptions"
              :key="m.perms"
              :label="`${m.menuName} (${m.perms})`"
              :value="m.perms"
            />
          </el-select>
          <div class="form-tip">未在此设置权限的菜单默认展示全部数据</div>
        </el-form-item>
        <el-form-item label="范围类型" prop="scopeType">
          <el-select v-model="form.scopeType" style="width: 100%">
            <el-option label="全部数据 (ALL)" value="ALL" />
            <el-option label="仅本人 (SELF)" value="SELF" />
          </el-select>
        </el-form-item>
        <el-form-item label="权限字段" prop="fieldName">
          <el-input v-model="form.fieldName" placeholder="如 create_user" />
        </el-form-item>
        <el-form-item label="取值来源" prop="valueSource">
          <el-select v-model="form.valueSource" style="width: 100%">
            <el-option label="当前用户名 (USERNAME)" value="USERNAME" />
            <el-option label="当前用户ID (USERID)" value="USERID" />
          </el-select>
        </el-form-item>
        <el-form-item label="绑定角色" prop="roleIds">
          <el-select
            v-model="form.roleIds"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="选择此规则生效的角色"
            style="width: 100%"
          >
            <el-option
              v-for="r in roleList"
              :key="r.id"
              :label="`${r.roleName} (${r.roleCode})`"
              :value="r.id"
            />
          </el-select>
          <div class="form-tip">此规则只对选中的角色生效；每个用户同时拥有多个角色时，取最严格的范围</div>
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

    <el-dialog v-model="bindVisible" :title="'绑定角色 - ' + (currentScope?.scopeName ?? '')" width="520px">
      <el-checkbox-group v-model="selectedRoleIds">
        <el-checkbox v-for="r in roleList" :key="r.id" :value="r.id">
          {{ r.roleName }} <span class="role-code">({{ r.roleCode }})</span>
        </el-checkbox>
      </el-checkbox-group>
      <template #footer>
        <el-button @click="bindVisible = false">取消</el-button>
        <el-button type="primary" :loading="bindLoading" @click="submitBind">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'SystemDataScopeView' })
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Plus, Refresh, Search } from '@element-plus/icons-vue'
import {
  pageDataScopes,
  saveDataScope,
  updateDataScope,
  deleteDataScope,
  bindRoles,
  getBoundRoles,
  getMenuPerms, 
  type SysDataScope,
  type MenuPermOption
} from '@/api/dataScope'
import { listRoles } from '@/api/role'
import type { SysRole } from '@/types'

const loading = ref(false)
const tableData = ref<SysDataScope[]>([])
const total = ref(0)
const menuPermOptions = ref<MenuPermOption[]>([])
const menuNameMap = ref<Record<string, string>>({})

const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  perms: ''
})

const dialogVisible = ref(false)
const submitLoading = ref(false)
const isEdit = ref(false)
const dialogTitle = ref('新增规则')
const formRef = ref<FormInstance>()

const form = reactive<SysDataScope & { roleIds: number[] }>({
  scopeName: '',
  perms: '',
  tableName: '',
  scopeType: 'SELF',
  fieldName: 'create_user',
  valueSource: 'USERNAME',
  status: '0',
  remark: '',
  roleIds: []
})

const rules: FormRules = {
  scopeName: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  scopeType: [{ required: true, message: '请选择范围类型', trigger: 'change' }],
  fieldName: [{ required: true, message: '请输入权限字段', trigger: 'blur' }],
  roleIds: [{
    required: true,
    validator: (_rule, value, cb) => {
      if (!value || value.length === 0) cb(new Error('请至少选择一个角色'))
      else cb()
    },
    trigger: 'change'
  }]
}

const bindVisible = ref(false)
const bindLoading = ref(false)
const currentScope = ref<SysDataScope | null>(null)
const selectedRoleIds = ref<number[]>([])
const roleList = ref<SysRole[]>([])

async function loadMenuPermOptions() {
  menuPermOptions.value = await getMenuPerms()
  const map: Record<string, string> = {}
  menuPermOptions.value.forEach(m => { map[m.perms] = m.menuName })
  menuNameMap.value = map
}

async function loadData() {
  loading.value = true
  try {
    const res = await pageDataScopes(queryParams)
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
  queryParams.perms = ''
  handleQuery()
}

async function openDialog(row?: SysDataScope) {
  isEdit.value = !!row
  dialogTitle.value = isEdit.value ? '修改规则' : '新增规则'
  roleList.value = await listRoles()
  if (row) {
    Object.assign(form, JSON.parse(JSON.stringify(row)))
    form.roleIds = Array.from(await getBoundRoles(row.id!))
  } else {
    Object.assign(form, {
      id: undefined,
      scopeName: '',
      perms: '',
      tableName: '',
      scopeType: 'SELF',
      fieldName: 'create_user',
      valueSource: 'USERNAME',
      status: '0',
      remark: '',
      roleIds: []
    })
  }
  dialogVisible.value = true
}

function resetForm() {
  formRef.value?.resetFields()
  form.roleIds = []
}

async function handleSubmit() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    submitLoading.value = true
    try {
      const { roleIds, ...scope } = form
      if (isEdit.value) {
        await updateDataScope(scope, roleIds)
        ElMessage.success('修改成功，已立即生效')
      } else {
        await saveDataScope(scope, roleIds)
        ElMessage.success('新增成功，已立即生效')
      }
      dialogVisible.value = false
      loadData()
    } finally {
      submitLoading.value = false
    }
  })
}

async function handleDelete(row: SysDataScope) {
  await ElMessageBox.confirm(`确定删除规则「${row.scopeName}」吗？`, '提示', { type: 'warning' })
  await deleteDataScope(row.id!)
  ElMessage.success('删除成功')
  loadData()
}

async function openBindDialog(row: SysDataScope) {
  currentScope.value = row
  roleList.value = await listRoles()
  const bound = await getBoundRoles(row.id!)
  selectedRoleIds.value = Array.from(bound)
  bindVisible.value = true
}

async function submitBind() {
  if (!currentScope.value) return
  bindLoading.value = true
  try {
    await bindRoles(currentScope.value.id!, selectedRoleIds.value)
    ElMessage.success('绑定成功')
    bindVisible.value = false
  } finally {
    bindLoading.value = false
  }
}

function scopeTypeLabel(type: string) {
  return { ALL: '全部数据', SELF: '仅本人', DEPT: '本部门' }[type] ?? type
}

function indexMethod(index: number) {
  return (queryParams.pageNum - 1) * queryParams.pageSize + index + 1
}

onMounted(() => {
  loadMenuPermOptions()
  loadData()
})
</script>

<style scoped>
.perms-sub {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
  font-family: 'Courier New', monospace;
}
.role-code {
  color: #909399;
  font-size: 12px;
  margin-left: 4px;
}
.form-tip {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
  margin-top: 4px;
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