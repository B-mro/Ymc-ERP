<template>
  <div>
    <el-card shadow="never" class="search-bar">
      <el-input
        v-model="queryParams.keyword"
        placeholder="文件名模糊搜索"
        clearable
        style="width: 220px"
        @keyup.enter="handleQuery"
      />
      <el-select
        v-model="queryParams.fileType"
        placeholder="文件类型"
        clearable
        style="width: 160px"
      >
        <el-option
          v-for="t in fileTypeOptions"
          :key="t.value"
          :label="t.label"
          :value="t.value"
        />
      </el-select>
      <el-button type="primary" :icon="Search" @click="handleQuery">查询</el-button>
      <el-button :icon="Refresh" @click="resetQuery">重置</el-button>
      <el-tooltip content="单次最多 50MB，支持批量选择" placement="bottom">
        <el-button type="primary" :icon="Upload" @click="triggerUpload">
          上传文件
        </el-button>
      </el-tooltip>
      <input
        ref="fileInputRef"
        type="file"
        multiple
        style="display: none"
        @change="handleFileChange"
      />
    </el-card>

    <el-card shadow="never">
      <el-table
        v-loading="loading"
        :data="tableData"
        border
        stripe
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="50" align="center" />
        <el-table-column type="index" label="序号" width="70" align="center" :index="indexMethod" />
        <el-table-column label="文件" min-width="240">
          <template #default="{ row }">
            <div class="file-cell">
              <div class="file-icon" :class="getIconClass(row.fileType)">
                {{ getIconText(row.fileType) }}
              </div>
              <div class="file-info">
                <div class="file-name" :title="row.originalName">{{ row.originalName }}</div>
                <div class="file-meta">
                  {{ formatSize(row.fileSize) }} · {{ row.fileType?.toUpperCase() || '-' }}
                </div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="上传人" min-width="120">
          <template #default="{ row }">
            {{ userCache.resolveName(row.createUser) }}
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="上传时间" min-width="170" />
        <el-table-column label="操作" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button type="primary" link @click="openEdit(row)">重命名</el-button>
            <el-button type="success" link @click="previewOrDownload(row)">
              {{ isImage(row.fileType) ? '预览' : '下载' }}
            </el-button>
            <el-button type="danger" link @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        class="table-pagination"
        v-model:current-page="queryParams.pageNum"
        v-model:page-size="queryParams.pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="loadData"
        @current-change="loadData"
      />
    </el-card>

    <el-card
      v-if="uploadQueue.length"
      shadow="never"
      class="upload-queue"
      header="正在上传"
    >
      <div
        v-for="item in uploadQueue"
        :key="item.uid"
        class="queue-item"
      >
        <div class="queue-name" :title="item.file.name">{{ item.file.name }}</div>
        <el-progress
          v-if="item.status === 'uploading'"
          :percentage="item.percentage"
          :stroke-width="14"
        />
        <span v-else-if="item.status === 'success'" class="queue-success">
          ✅ 上传成功
        </span>
        <span v-else-if="item.status === 'error'" class="queue-error">
          ❌ {{ item.errorMsg }}
        </span>
      </div>
    </el-card>

    <el-dialog v-model="editVisible" title="重命名文件" width="480px" @closed="editForm.fileName = ''" :close-on-click-modal="false">
      <el-form label-width="80px">
        <el-form-item label="新文件名">
          <el-input v-model="editForm.fileName" placeholder="输入新的文件名（不需要扩展名）">
            <template #append>{{ editForm.ext }}</template>
          </el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editLoading" @click="submitEdit">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="previewVisible" title="图片预览" width="600px" align-center>
      <img :src="previewUrl" alt="preview" style="max-width: 100%" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: 'FunctionalDesignUploadFileView' })
import { onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Search, Upload } from '@element-plus/icons-vue'
import { pageFiles, uploadFile, updateFile, deleteFile, listFiles } from '@/api/flie'
import type { SysFile } from '@/types'
import { useUserCache } from '@/stores/userCache'

const userCache = useUserCache()

const loading = ref(false)
const tableData = ref<SysFile[]>([])
const total = ref(0)

const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  keyword: '',
  fileType: ''
})

const fileTypeOptions = [
  { label: 'Excel', value: 'xlsx' },
  { label: 'Excel (xls)', value: 'xls' },
  { label: 'CSV', value: 'csv' },
  { label: 'Word', value: 'docx' },
  { label: 'PDF', value: 'pdf' },
  { label: '图片', value: 'png' },
  { label: 'JPEG', value: 'jpg' },
  { label: '其他', value: '' }
]

const editVisible = ref(false)
const editLoading = ref(false)
const editForm = reactive({ id: undefined as number | undefined, fileName: '', ext: '' })

const previewVisible = ref(false)
const previewUrl = ref('')

const fileInputRef = ref<HTMLInputElement>()
const uploadQueue = ref<
  Array<{
    uid: string
    file: File
    status: 'pending' | 'uploading' | 'success' | 'error'
    percentage: number
    errorMsg?: string
  }>
>([])

async function loadData() {
  loading.value = true
  try {
    const res = await pageFiles(queryParams)
    tableData.value = res.list
    total.value = res.total
    userCache.prefetch(
      res.list.flatMap((f) => [f.createUser, f.updateUser])
    )
  } finally {
    loading.value = false
  }
}

function handleQuery() {
  queryParams.pageNum = 1
  loadData()
}

function resetQuery() {
  queryParams.keyword = ''
  queryParams.fileType = ''
  handleQuery()
}

function triggerUpload() {
  fileInputRef.value?.click()
}

function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files || input.files.length === 0) return
  const files = Array.from(input.files)
  input.value = ''
  enqueueUpload(files)
}

const MAX_FILE_SIZE = 50 * 1024 * 1024

function enqueueUpload(files: File[]) {
  const valid: File[] = []
  for (const f of files) {
    if (f.size > MAX_FILE_SIZE) {
      ElMessage.error(`「${f.name}」超过 50MB，已跳过`)
    } else {
      valid.push(f)
    }
  }
  if (!valid.length) return
  const entries = valid.map((file) => ({
    uid: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    status: 'pending' as const,
    percentage: 0
  }))
  uploadQueue.value.push(...entries)
  entries.forEach((entry) => doUpload(entry))
}

async function doUpload(entry: (typeof uploadQueue.value)[number]) {
  entry.status = 'uploading'
  try {
    const fd = new FormData()
    fd.append('file', entry.file)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/file/upload')
    const token = localStorage.getItem('rbac_token')
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        entry.percentage = Math.round((e.loaded / e.total) * 100)
      }
    }
    const done = new Promise<{ code: number; msg: string }>((resolve, reject) => {
      xhr.onload = () => {
        try {
          const body = JSON.parse(xhr.responseText)
          resolve(body)
        } catch {
          reject(new Error('响应解析失败'))
        }
      }
      xhr.onerror = () => reject(new Error('网络错误'))
    })
    xhr.send(fd)
    const body = await done
    if (body.code === 200) {
      entry.status = 'success'
      entry.percentage = 100
      ElMessage.success(`「${entry.file.name}」上传成功`)
      loadData()
    } else {
      throw new Error(body.msg || '上传失败')
    }
  } catch (err: any) {
    entry.status = 'error'
    entry.errorMsg = err?.message || '上传失败'
    ElMessage.error(`「${entry.file.name}」${entry.errorMsg}`)
  }
  setTimeout(() => {
    uploadQueue.value = uploadQueue.value.filter((q) => q.uid !== entry.uid)
  }, 5000)
}

function handleSelectionChange(_rows: SysFile[]) {}

function openEdit(row: SysFile) {
  const dot = (row.originalName || '').lastIndexOf('.')
  const baseName = dot > 0 ? row.originalName!.slice(0, dot) : row.originalName || ''
  const ext = dot > 0 ? row.originalName!.slice(dot) : ''
  editForm.id = row.id
  editForm.fileName = baseName
  editForm.ext = ext
  editVisible.value = true
}

async function submitEdit() {
  if (!editForm.id) return
  if (!editForm.fileName.trim()) {
    ElMessage.warning('文件名不能为空')
    return
  }
  editLoading.value = true
  try {
    const newName = editForm.fileName.trim() + editForm.ext
    await updateFile({ id: editForm.id, originalName: newName })
    ElMessage.success('修改成功')
    editVisible.value = false
    loadData()
  } finally {
    editLoading.value = false
  }
}

async function handleDelete(row: SysFile) {
  await ElMessageBox.confirm(`确定删除文件「${row.originalName}」吗？此操作不可恢复。`, '提示', {
    type: 'warning'
  })
  await deleteFile(row.id!)
  ElMessage.success('删除成功')
  loadData()
}

function previewOrDownload(row: SysFile) {
  if (!row.fileUrl) return
  if (isImage(row.fileType)) {
    previewUrl.value = row.fileUrl
    previewVisible.value = true
  } else {
    window.open(row.fileUrl, '_blank')
  }
}

function isImage(ext?: string) {
  return /^(jpg|jpeg|png|gif|bmp|webp|svg|ico)$/i.test(ext || '')
}

function formatSize(bytes?: number) {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

function getIconClass(ext?: string) {
  if (!ext) return 'icon-other'
  const e = ext.toLowerCase()
  if (['xls', 'xlsx', 'csv'].includes(e)) return 'icon-excel'
  if (['doc', 'docx'].includes(e)) return 'icon-word'
  if (e === 'pdf') return 'icon-pdf'
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico'].includes(e)) return 'icon-image'
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) return 'icon-zip'
  return 'icon-other'
}

function getIconText(ext?: string) {
  if (!ext) return '文件'
  return ext.toUpperCase().slice(0, 4)
}

function indexMethod(index: number) {
  return (queryParams.pageNum - 1) * queryParams.pageSize + index + 1
}

onMounted(async () => {
  await loadData()
  void listFiles()
})
</script>

<style scoped>
.file-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.file-icon {
  width: 40px;
  height: 46px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  border-radius: 4px;
  line-height: 1;
}
.icon-excel { background: #217346; }
.icon-word  { background: #2b579a; }
.icon-pdf   { background: #d93025; }
.icon-image { background: #4285f4; }
.icon-zip   { background: #f2a93b; }
.icon-other { background: #8b8b8b; }
.file-info {
  min-width: 0;
  flex: 1;
}
.file-name {
  font-size: 13px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-meta {
  font-size: 12px;
  color: #909399;
  margin-top: 2px;
}

.upload-queue {
  margin-top: 12px;
}
.queue-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
  border-bottom: 1px dashed #ebeef5;
}
.queue-item:last-child { border-bottom: none; }
.queue-name {
  width: 240px;
  flex-shrink: 0;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.queue-item .el-progress {
  flex: 1;
}
.queue-success { color: #67c23a; font-size: 13px; }
.queue-error { color: #f56c6c; font-size: 13px; }
</style>