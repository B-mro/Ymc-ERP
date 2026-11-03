<template>
  <div class="image-upload">
    <div v-if="files.length" class="upload-list">
      <div
        v-for="(url, index) in files"
        :key="'db-' + index"
        class="upload-item"
      >
        <el-image
          :src="url"
          fit="cover"
          class="preview-img"
          :preview-src-list="files"
          :initial-index="index"
        />
        <span v-if="!hideDbRemove" class="remove-btn" @click="removeDb(index)">×</span>
      </div>
    </div>

    <div v-if="localFiles.length" class="upload-list">
      <div v-for="(item, index) in localFiles" :key="'local-' + index" class="upload-item">
        <el-image 
          :src="item.localUrl"
          fit="cover"
          class="preview-img"
          :preview-src-list="localUrls"
        />
        <span class="remove-btn" @click="removeLocal(index)">×</span>
        <div v-if="item.uploading" class="uploading-mask">
          <el-icon class="is-loading" :size="20"><Loading /></el-icon>
          <span>上传中</span>
        </div>
      </div>
    </div>

    <el-upload
      v-if="!max || totalCount < max"
      :auto-upload="false"
      :show-file-list="false"
      :accept="accept"
      :limit="max"
      :multiple="max > 1"
      :disabled="disabled"
      :on-change="handleChange"
    >
      <div class="add-btn">
        <el-icon :size="28"><Plus /></el-icon>
        <span>{{ files.length ? '继续添加' : '点击上传' }}</span>
      </div>
    </el-upload>

    <div v-if="tip" class="upload-tip">{{ tip }}</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Loading } from '@element-plus/icons-vue'
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
  tip: '支持 jpg/png/gif/webp/svg，单张最大 100MB',
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
  localUrl: string
  uploading: boolean
}

const localFiles = ref<LocalFile[]>([])
const accept = 'image/jpeg,image/png,image/gif,image/webp,image/svg+xml,image/bmp,image/ico'

const totalCount = computed(() => files.value.length + localFiles.value.length)
const localUrls = computed(() => localFiles.value.map(f => f.localUrl))

function handleChange(file: any) {
  let raw: File = file.raw
  if (/\s/.test(raw.name)) {
    raw = new File([raw], raw.name.replace(/\s+/g, ''), { type: raw.type, lastModified: raw.lastModified })
  }
  if (!raw.type.startsWith('image/')) {
    ElMessage.warning('只能上传图片文件')
    return
  }
  if (raw.size > 100 * 1024 * 1024) {
    ElMessage.warning('图片不能超过 100MB')
    return
  }
  if (totalCount.value >= props.max) {
    ElMessage.warning(`最多上传 ${props.max} 张图片`)
    return
  }
  localFiles.value.push({
    file: raw,
    localUrl: URL.createObjectURL(raw),
    uploading: false
  })
}

function removeLocal(index: number) {
  URL.revokeObjectURL(localFiles.value[index].localUrl)
  localFiles.value.splice(index, 1)
}

function removeDb(index: number) {
  const next = [...files.value]
  next.splice(index, 1)
  emit('update:modelValue', next.join(','))
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

  localFiles.value.forEach(f => URL.revokeObjectURL(f.localUrl))
  localFiles.value = []

  return merged
}

function cancelUpload() {
  localFiles.value.forEach(f => URL.revokeObjectURL(f.localUrl))
  localFiles.value = []
}

defineExpose({ confirmUpload, cancelUpload })
</script>

<style scoped>
.image-upload {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.upload-list {
  display: contents;
}
.upload-item {
  position: relative;
  width: 100px;
  height: 100px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  overflow: hidden;
  background: #fafafa;
}
.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.remove-btn {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  line-height: 18px;
  text-align: center;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.2s;
}
.remove-btn:hover {
  background: rgba(0, 0, 0, 0.85);
}
.uploading-mask {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  color: #409eff;
}
.add-btn {
  width: 100px;
  height: 100px;
  border: 1px dashed #dcdfe6;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
  background: #fafafa;
}
.add-btn:hover {
  border-color: #409eff;
  color: #409eff;
  background: #ecf5ff;
}
.add-btn span {
  margin-top: 6px;
  font-size: 12px;
}
.upload-tip {
  width: 100%;
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
</style>