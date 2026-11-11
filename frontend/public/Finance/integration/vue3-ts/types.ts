export type ModuleId = 'ontrac-cost' | 'ontrac-billing' | 'fedex-billing' | 'ups-billing' | 'ups-audit';
export interface ModuleStatus {
  moduleId: ModuleId; version: string; ready: boolean; busy: boolean;
  error: string; summary: Record<string, unknown> | null;
}
export interface ModuleMessage {
  channel: 'shipgrid-finance-v1'; moduleId: ModuleId;
  type: 'ready' | 'status' | 'get-status'; requestId?: string;
  payload?: ModuleStatus;
}
export const moduleNames: Record<ModuleId, string> = {
  'ontrac-cost': 'OnTrac A/B成本测算', 'ontrac-billing': 'OnTrac账单生成',
  'fedex-billing': 'FedEx账单生成', 'ups-billing': 'UPS账单生成', 'ups-audit': 'UPS账单审核',
};
