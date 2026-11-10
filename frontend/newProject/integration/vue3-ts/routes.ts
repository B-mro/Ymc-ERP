// Vue Router 4 integration example. Import into the host application's route table.
// The actual module directories should be deployed under /finance/modules/.
import type { RouteRecordRaw } from 'vue-router';
import FinanceModule from './FinanceModule.vue';
import {moduleNames, type ModuleId} from './types';
export const financeRoutes: RouteRecordRaw[] = (Object.keys(moduleNames) as ModuleId[]).map(moduleId => ({
  path: `/finance/${moduleId}`, name: `finance-${moduleId}`, component: FinanceModule,
  props: {moduleId, baseUrl: '/finance/modules/'}, meta: {title: moduleNames[moduleId]},
}));
