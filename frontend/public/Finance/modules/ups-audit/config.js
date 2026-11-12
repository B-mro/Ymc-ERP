/**
 * ups-audit/config.js —— UPS 审核模块元信息配置
 *
 * 由宿主 runtime（module-runtime.js）在加载模块时读取，用于：
 *   - 模块注册（moduleId + version）
 *   - 文件 API 路径拼接（fileApi 指向后端 Excel 文件服务）
 *   - 跨域安全校验（allowedParentOrigins 白名单）
 *
 * 字段说明：
 *   moduleId          : 唯一模块标识（"ups-audit"），宿主用它建立模块注册表
 *   version           : 模块版本号，格式 "主版本.次版本-构建标识"
 *                       与 engine 层各文件 /*SG-AUDIT:finance-XX.js*\/ 标记对应
 *                       用于追踪哪个 engine 变更属于哪个模块版本
 *   carrier           : 承运商标识（null 表示模块内自有，未在宿主 carrierMap 注册）
 *                       ups-billing 模块对应 "UPS"，ups-audit 是独立审核器
 *   serverBase        : 后端 API 基础路径（空字符串 = 相对当前宿主域名）
 *                       多租户部署时可改为 "https://finance.ymc-erp.com"
 *   fileApi           : 后端 Excel 文件上传/下载 API 端点
 *                       前端 fetch(`${serverBase}${fileApi}/...`) 拼接使用
 *   allowedParentOrigins : postMessage 安全白名单
 *     空数组 = 仅允许同源宿主调用（默认安全配置）
 *     填入 ["https://finance.ymc-erp.com"] 允许跨域宿主挂载本模块
 *
 * 注意：本文件只包含公开配置。**不** 应放入任何 API Key、密码、私密凭据——
 * 这些应走后端 → 前端 fetch 的加密通道传递，永远不硬编码在 JS 中。
 *
 * 赋值到 window.ShipGridModuleConfig，全局唯一，被宿主 module-runtime.js 读取。
 */
/* Server-specific settings. Do not put passwords or private API keys in this file. */
window.ShipGridModuleConfig = {
	moduleId: "ups-audit",
	version: "3.76-modular.1",
	carrier: null,
	serverBase: "",
	fileApi: "/api/excel/files",
	allowedParentOrigins: [],
};
