/**
 * ============================================================
 * ontrac-billing 模块配置文件
 * ============================================================
 * 职责：定义 OnTrac 承运商账单测算模块的元信息，宿主平台
 *       通过此对象识别模块身份、版本与后端接口地址。
 *
 * 字段说明：
 *   moduleId        模块唯一标识（ontrac-billing），宿主通过
 *                   此 ID 路由到对应模块的 index.html
 *   version         模块版本号（与 fedex-billing 同步的模块化版本）
 *   carrier         承运商标识 "ontrac"，供引擎内 switch/if 分支
 *                   选择 OnTrac 专属的燃油费率、分区分组和尺寸政策
 *   serverBase      后端服务基础地址，空字符串表示同源部署
 *   fileApi         Excel 文件上传/下载接口前缀，供 UI 层调用
 *   allowedParentOrigins  postMessage 允许的父窗口 origin 白名单，
 *                   空数组表示关闭跨域通信（单文件模式使用）
 *
 * 注意：此文件只放公开配置，不要写入密码或私钥。
 */
window.ShipGridModuleConfig = {
	moduleId: "ontrac-billing",
	version: "3.76-modular.1",
	carrier: "ontrac",
	serverBase: "",
	fileApi: "/api/excel/files",
	allowedParentOrigins: [],
};
