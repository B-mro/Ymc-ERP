import service from './request'

export interface UploadResult {
  originalName: string
  storedName: string
  fileUrl: string
  filePath: string
  fileSize: number
  fileType: string
  isImage: boolean
}

export function uploadCustomerFile(file: File): Promise<UploadResult> {
  const fd = new FormData()
  fd.append('file', file)
  return service.post('/customer-file/upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export function uploadCustomerFiles(files: File[]): Promise<UploadResult[]> {
  const fd = new FormData()
  files.forEach(f => fd.append('files', f))
  return service.post('/customer-file/upload-batch', fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}