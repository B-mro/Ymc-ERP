<template>
  <div class="file-upload">
    <div v-if="files.length" class="file-list">
      <div v-for="(url, index) in files" :key="'db-' + index" class="file-item">
        <div class="file-icon" :class="getExtClass(url)">📄</div>
        <div class="file-info">
          <div class="file-name" :title="getFileName(url)">{{ getFileName(url) }}</div>
          <div class="file-meta">
            <a :href="url" target="_blank" class="file-link">查看/下载</a>
          </div>
        </div>
        <span v-if="!hideDbRemove" class="remove-btn" @click="removeDb(index)">×</span>
      </div>
    </div>

    <div v-if="localFiles.length" class="file-list">
      <div v-for="(item, index) in localFiles" :key="'local-' + index" class="file-item">
        <div class="file-icon" :class="getExtClass(item.file.name)">📄</div>
        <div class="file-info">
          <div class="file-name" :title="item.file.name">{{ item.file.name }}</div>
          <div class="file-size">{{ formatSize(item.file.size) }}</div>
        </div>
        <span class="remove-btn" @click="removeLocal(index)">×</span>
        <div v-if="item.uploading" class="uploading-mask">
          <el-icon class="is-loading" :size="18"><Loading /></el-icon>
          <span>上传中</span>
        </div>
      </div>
    </div>

    <el-upload
      v-if="!max || totalCount < max"
      :auto-upload="false"
      :show-file-list="false"
      :limit="max"
      :multiple="max > 1"
      :disabled="disabled"
      :on-change="handleChange"
    >
      <div class="add-btn">
        <el-icon :size="22"><UploadFilled /></el-icon>
        <span>{{ files.length ? '继续添加文件' : '选择文件' }}</span>
      </div>
    </el-upload>

    <div v-if="tip" class="upload-tip">{{ tip }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading, UploadFilled } from '@element-plus/icons-vue'
import { uploadCustomerFile } from '@/api/customerFile'

const props = withDefaults(defineProps<{
  modelValue: string | string[] | null | undefined
  max?: number
  tip?: string
  disabled?: boolean 
  hideDbRemove?: boolean
}>(), {
  modelValue: () => [],
  max: 5,
  tip: '支持 Word/Excel/PDF/ZIP/TXT 等，单个最大 100MB',
  disabled: false,
  hideDbRemove: false
})

const files = computed(() => {
  const v = props.modelValue
  if (Array.isArray(v)) return v
  if (typeof v === 'string' && v) return v.split(',').filter(Boolean)
  return []
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

interface LocalFile {
  file: File
  uploading: boolean
}

const localFiles = ref<LocalFile[]>([])
const totalCount = computed(() => files.value.length + localFiles.value.length)

function handleChange(file: any) {
  let raw: File = file.raw
  if (/\s/.test(raw.name)) {
    raw = new File([raw], raw.name.replace(/\s+/g, ''), { type: raw.type, lastModified: raw.lastModified })
  }
  if (raw.size > 100 * 1024 * 1024) {
    ElMessage.warning('文件不能超过 100MB')
    return
  }
  if (totalCount.value >= props.max) {
    ElMessage.warning(`最多上传 ${props.max} 个文件`)
    return
  }
  localFiles.value.push({ file: raw, uploading: false })
}

function removeLocal(index: number) {
  localFiles.value.splice(index, 1)
}

function removeDb(index: number) {
  const next = [...files.value]
  next.splice(index, 1)
  emit('update:modelValue', next.join(','))
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

function getFileName(url: string): string {
  return url.split('/').pop() || url
}

function getExtClass(nameOrUrl: string): string {
  const name = nameOrUrl.split('/').pop() || ''
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (['doc', 'docx'].includes(ext)) return 'ext-word'
  if (['xls', 'xlsx'].includes(ext)) return 'ext-excel'
  if (['ppt', 'pptx'].includes(ext)) return 'ext-ppt'
  if (['pdf'].includes(ext)) return 'ext-pdf'
  if (['zip', 'rar', '7z'].includes(ext)) return 'ext-zip'
  return 'ext-other'
}

async function confirmUpload(): Promise<string[]> {
  if (localFiles.value.length === 0) {
    emit('update:modelValue', files.value.join(','))
    return files.value
  }

  const pending = localFiles.value.filter(f => !f.uploading)
  const newUrls: string[] = []

  for (const item of pending) {
    item.uploading = true
    try {
      const res = await uploadCustomerFile(item.file)
      if (res?.fileUrl) {
        newUrls.push(res.fileUrl)
      }
    } catch {
      ElMessage.error(`「${item.file.name}」上传失败`)
    } finally {
      item.uploading = false
    }
  }

  const merged = [...files.value, ...newUrls]
  emit('update:modelValue', merged.join(','))
  localFiles.value = []
  return merged
}

function cancelUpload() {
  localFiles.value = []
}

defineExpose({ confirmUpload, cancelUpload })
</script>

<style scoped>
.file-upload {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.file-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.file-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #fafafa;
  transition: background 0.2s;
}
.file-item:hover {
  background: #f5f7fa;
}
.file-icon {
  font-size: 22px;
  width: 36px;
  text-align: center;
  flex-shrink: 0;
}
.file-icon.ext-word { color: #2b579a; }
.file-icon.ext-excel { color: #217346; }
.file-icon.ext-ppt { color: #d24726; }
.file-icon.ext-pdf { color: #e52521; }
.file-icon.ext-zip { color: #f7a400; }
.file-icon.ext-other { color: #909399; }
.file-info {
  flex: 1;
  min-width: 0;
}
.file-name {
  font-size: 13px;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.file-meta {
  margin-top: 2px;
}
.file-size {
  font-size: 12px;
  color: #909399;
}
.file-link {
  font-size: 12px;
  color: #409eff;
  text-decoration: none;
}
.file-link:hover {
  text-decoration: underline;
}
.remove-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  line-height: 16px;
  text-align: center;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  border-radius: 50%;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.2s;
}
.remove-btn:hover {
  background: rgba(0, 0, 0, 0.85);
}
.uploading-mask {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.88);
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: #409eff;
  border-radius: 6px;
}
.add-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  color: #606266;
  cursor: pointer;
  transition: all 0.2s;
  width: fit-content;
}
.add-btn:hover {
  border-color: #409eff;
  color: #409eff;
  background: #ecf5ff;
}
.upload-tip {
  font-size: 12px;
  color: #909399;
}
</style>