import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as authApi from '@/api/auth'
import type { LoginData, RegisterData, SysMenu, SysUser } from '@/types'
import { clearToken, getToken, setToken } from '@/api/request'

export const useUserStore = defineStore('user', () => {
  const token = ref<string>(getToken() || '')
  const userInfo = ref<SysUser>({})
  const roles = ref<string[]>([])
  const permissions = ref<string[]>([])
  const menus = ref<SysMenu[]>([])
  /** 用户信息是否已加载（动态路由是否已注册） */
  const loaded = ref(false)

  const isAdmin = computed(() => roles.value.includes('admin'))

  function login(data: LoginData) {
    return authApi.login(data).then((res) => {
      token.value = res.token
      setToken(res.token)
    })
  }

  function register(data: RegisterData) {
    return authApi.register(data)
  }

  async function getInfo() {
    const info = await authApi.getInfo()
    userInfo.value = info.user || {}
    roles.value = info.roles || []
    permissions.value = info.permissions || []
    menus.value = info.menus || []
    loaded.value = true
    return info
  }

  /** 按钮级权限判断，admin 直接放行 */
  function hasPermi(code: string): boolean {
    return isAdmin.value || permissions.value.includes(code)
  }

  function logout() {
    authApi.logout().catch(() => undefined)
    reset()
    window.location.href = '/login'
  }

  function reset() {
    token.value = ''
    userInfo.value = {}
    roles.value = []
    permissions.value = []
    menus.value = []
    loaded.value = false
    clearToken()
  }

  return {
    token,
    userInfo,
    roles,
    permissions,
    menus,
    loaded,
    isAdmin,
    login,
    register,
    getInfo,
    hasPermi,
    logout,
    reset
  }
})
