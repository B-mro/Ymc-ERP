// 公共接口
import { post } from './request'

/** 数据字典项（后端 /sys-dict-item/listByCode 返回结构） */
export interface DictData {
  id?: number
  dictCode?: string
  label?: string
  value?: string
}

/**
 * 根据 dictCode 查询启用的字典项
 * 后端接口：POST /sys-dict-item/listByCode，body 传 { dictCode }
 * 返回：[{ id, dictCode, label, value }]
 */
export function getDictData(dictCode: string) {
  return post<DictData[]>('/sys-dict-item/listByCode', { dictCode })
}
