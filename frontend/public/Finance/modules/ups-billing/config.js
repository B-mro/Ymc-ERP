/*
 * ============================================================================
 * ShipGrid UPS Billing 模块元信息配置
 * 文件: config.js
 * ----------------------------------------------------------------------------
 * 本文件是 ShipGrid 平台 UPS Ground 账单计费模块的入口配置文件。
 * 在浏览器加载时通过 window.ShipGridModuleConfig 暴露模块身份标识，
 * 宿主平台（ShipGrid）通过此对象识别模块类型、版本号及后端接口地址。
 *
 * 字段说明：
 *   moduleId           — 模块唯一标识，宿主平台根据此值路由到对应模块
 *   version            — 模块语义化版本号，用于前端缓存和兼容性检查
 *   carrier            — 承运商标识（ups / fedex / ontrac），影响报价解析逻辑
 *   serverBase         — 后端服务基础地址，空字符串表示相对路径
 *   fileApi            — Excel 文件上传接口路径
 *   allowedParentOrigins — postMessage 通信时允许的宿主来源白名单
 *
 * 注意：本文件不得存放密码或私有 API Key，仅用于静态配置。
 * ============================================================================
 */
window.ShipGridModuleConfig = {
	moduleId: "ups-billing",
	version: "3.76-modular.1",
	carrier: "ups",
	serverBase: "",
	fileApi: "/api/excel/files",
	allowedParentOrigins: [],
};
