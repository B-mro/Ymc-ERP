import { get, post, put, del } from './request'
import type { PageResult, SysFile } from '@/types'

export function uploadFile(data: FormData) {
  return post<SysFile>('/file/upload', data)
}

export function pageFiles(params: {
  pageNum: number
  pageSize: number
  keyword?: string
  fileType?: string
}) {
  return get<PageResult<SysFile>>('/file/page', params)
}
// 功能设计-文件上传-文件列表
export function listFiles() {
  return get<SysFile[]>('/file/list')
}
// 功能设计-文件上传-上传文件详情
export function getFile(id: number) {
  return get<SysFile>(`/file/${id}`)
}
// 功能设计-文件上传-文件更新
export function updateFile(data: Partial<SysFile>) {
  return put<void>('/file/update', data)
}
// 功能设计-文件上传-文件删除
export function deleteFile(id: number) {
  return del<void>(`/file/${id}`)
}