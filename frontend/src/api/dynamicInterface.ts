import { get, post, put, del } from './request'

export interface TreeNode {
  id: number | string
  name?: string
  label?: string
  parentId?: number
  orderNum?: number
  status?: string
  createTime?: string
  children?: TreeNode[]
}

export interface ParamItem {
  id?: number
  interfaceId?: number
  paramName: string
  fieldName: string
  type: string
  position: string
  required: boolean
  defaultValue: string
  description?: string
  desc?: string
  sortOrder?: number
}

export interface DataInterface {
  id?: number
  name: string
  path: string
  method: string
  categoryId?: number | string
  categoryName?: string
  sqlContent?: string
  resultType?: string
  description?: string
  status?: string
  createTime?: string
  params?: ParamItem[]
}

export interface PageResult<T> {
  total: number
  list: T[]
}

export interface CategoryForm {
  id?: number
  parentId?: number | string
  name: string
  orderNum?: number
}

function convertCategoryTree(list: any[]): TreeNode[] {
  return list.map((item) => ({
    id: item.id,
    name: item.name,
    label: item.name,
    parentId: item.parentId,
    orderNum: item.orderNum,
    status: item.status,
    createTime: item.createTime,
    children: item.children ? convertCategoryTree(item.children) : undefined,
  }))
}

export async function getCategoryTree(): Promise<TreeNode[]> {
  const res: any = await get('/dynamic-interface/category/tree')
  return convertCategoryTree(res || [])
}

export function addCategory(data: CategoryForm) {
  return post('/dynamic-interface/category', {
    parentId: data.parentId || 0,
    name: data.name,
    orderNum: data.orderNum || 0,
  })
}

export function updateCategory(data: CategoryForm) {
  return put('/dynamic-interface/category', {
    id: data.id,
    parentId: data.parentId || 0,
    name: data.name,
    orderNum: data.orderNum || 0,
  })
}

export function deleteCategory(id: number) {
  return del(`/dynamic-interface/category/${id}`)
}

export function pageInterfaces(params: {
  pageNum?: number
  pageSize?: number
  name?: string
  method?: string
  categoryId?: number | string
}): Promise<PageResult<DataInterface>> {
  return get('/dynamic-interface/page', params as any)
}

export function getInterfaceDetail(id: number): Promise<DataInterface> {
  return get(`/dynamic-interface/${id}`)
}

export function addInterface(data: any) {
  return post('/dynamic-interface', toBase64Body(data))
}

export function updateInterface(data: any) {
  return put('/dynamic-interface', toBase64Body(data))
}

export function deleteInterface(ids: number[]) {
  return del(`/dynamic-interface/${ids.join(',')}`)
}

function encodeBase64Json(obj: Record<string, any>): string {
  const json = JSON.stringify(obj)
  return btoa(unescape(encodeURIComponent(json)))
}

function toBase64Body(data: any) {
  if (data && typeof data === 'object') {
    return { _b64: encodeBase64Json(data) }
  }
  return data
}

export async function executeDynamicApi(
  path: string,
  method: string,
  params?: Record<string, any>
) {
  const url = `/dapi${path}`
  const m = method.toUpperCase()
  if (m === 'GET' || m === 'DELETE') {
    return (await get(url, params)) as any
  } else if (m === 'POST') {
    return (await post(url, params)) as any
  } else if (m === 'PUT') {
    return (await put(url, params)) as any
  }
}

export interface TableMeta {
  name: string
  comment: string | null
  rows: number | null
}

export interface ColumnMeta {
  name: string
  type: string
  key: string
  nullable: string
  comment: string | null
  maxLength: number | null
}

export function listDatabaseTables(): Promise<TableMeta[]> {
  return get('/dynamic-interface/meta/tables') as any
}

export function listTableColumns(tableName: string): Promise<ColumnMeta[]> {
  return get(`/dynamic-interface/meta/table/${encodeURIComponent(tableName)}`) as any
}