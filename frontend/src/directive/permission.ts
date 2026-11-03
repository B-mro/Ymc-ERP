import type { App, Directive } from 'vue'
import { useUserStore } from '@/stores/user'

/**
 * 按钮级权限指令
 * 用法：v-hasPermi="['system:user:add']" 或 v-hasPermi="['a','b']"（满足其一即可）
 */
const hasPermi: Directive = {
  mounted(el, binding) {
    const userStore = useUserStore()
    const codes: string[] = binding.value || []
    const has = codes.some((code) => userStore.hasPermi(code))
    if (!has) {
      el.parentNode?.removeChild(el)
    }
  }
}

export default {
  install(app: App) {
    app.directive('hasPermi', hasPermi)
  }
}
