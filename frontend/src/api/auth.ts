import { get, post } from './request'
import type { LoginData, RegisterData, UserInfo } from '@/types'

/** 登录 */
export function login(data: LoginData) {
  return post<{ token: string }>('/auth/login', data)
}

/** 注册 */
export function register(data: RegisterData) {
  return post<void>('/auth/register', data)
}

/** 当前用户信息（角色、权限、动态菜单） */
export function getInfo() {
  return get<UserInfo>('/auth/info')
}

/** 退出登录 */
export function logout() {
  return post<void>('/auth/logout')
}
