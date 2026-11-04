/** 用户 */
export interface SysUser {
  id?: number
  username?: string
  password?: string
  nickname?: string
  email?: string
  phone?: string
  /** 0 正常 1 停用 */
  status?: string
  createTime?: string
  roleIds?: number[]
}

/** 角色 */
export interface SysRole {
  id?: number
  roleName?: string
  roleCode?: string
  status?: string
  remark?: string
  createTime?: string
  menuIds?: number[]
  permissionIds?: number[]
}

/** 菜单 / 目录 / 按钮 */
export interface SysMenu {
  id?: number
  parentId?: number
  menuName?: string
  /** M 目录 C 菜单 F 按钮 */
  menuType?: string
  path?: string
  component?: string
  perms?: string
  icon?: string
  orderNum?: number
  visible?: string
  status?: string
  children?: SysMenu[]
}

/** 权限 */
export interface SysPermission {
  id?: number
  permissionName?: string
  permissionCode?: string
  permissionType?: string
  status?: string
  remark?: string
  createTime?: string
}

/** 文件 */
export interface SysFile {
	id?: number;
	originalName?: string;
	storedName?: string;
	filePath?: string;
	fileUrl?: string;
	fileSize?: number;
	fileType?: string;
	createUser?: string;
	createTime?: string;
	updateUser?: string;
	updateTime?: string;
}

/** 分页结果 */
export interface PageResult<T> {
  total: number
  list: T[]
}

/** 理赔/客户索赔记录 */
export interface Claim {
	id?: number;
	/** 承运商：FEDEX / ONTRAC / UPS */
	claimsType?: string;
	/** 索赔类型：1 异动查询 / 2 包裹索赔 / 3 账单争议 */
	type?: string;
	/** 物流单号 */
	logisticsNo?: string;
	/** 客户名称 */
	customerName?: string;
	/** 客户编号 */
	customerNo?: string;
	/** 联系邮箱 */
	contactEmail?: string;
	/** 发货日期 YYYY-MM-DD */
	shipDate?: string;
	/** 服务类型 */
	serviceType?: string;
	/** 发件地址 */
	senderAddress?: string;
	/** 收件地址 */
	receiverAddress?: string;
	/** 问题类型 */
	issueType?: string;
	/** 申请金额 */
	applyAmount?: number;
	/** 异动查询专用：最后更新日期 */
	lastUpdateDate?: string;
	/** 账单索赔专用：发票号 */
	invoiceNo?: string;
	/** 账单索赔专用：发票日期 */
	invoiceDate?: string;
	/** 账单索赔专用：收费项目 */
	chargeItem?: string;
	/** 账单索赔专用：账单金额 */
	billAmount?: number;
	/** 账单索赔专用：应收金额 */
	receivableAmount?: number;
	/** 问题描述 */
	issueDesc?: string;
	/** 回答 */
	answer?: string;
	/** 状态 */
	status?: string;
	/** 创建时间 */
	createTime?: string;
	/** 更新时间 */
	updateTime?: string;
	/** 逻辑删除：0 未删除 / 1 已删除 */
	deleted?: number;
	/** 创建人 */
	createUser?: string;
	/** 更新人 */
	updateUser?: string;
	/** 附件URL */
	fileUrl?: string;
	/** 图片URL */
	imgUrl?: string;
}

/** 统一返回结构 */
export interface Result<T = any> {
  code: number
  msg: string
  data: T
}

/** 登录入参 */
export interface LoginData {
  username: string
  password: string
}

/** 注册入参 */
export interface RegisterData {
  username: string
  password: string
  nickname?: string
}

/** 登录后用户信息 */
export interface UserInfo {
  user: SysUser
  roles: string[]
  permissions: string[]
  menus: SysMenu[]
}

/** 定时任务 */
export interface ScheduledTask {
  taskKey: string
  taskName: string
  cronExpression: string
  cronDescription: string
  serviceName: string
  lastExecuteTime?: string
  lastExecuteSuccess?: boolean
  lastExecuteMessage?: string
}