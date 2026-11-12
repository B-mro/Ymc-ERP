/**
 * FedEx Billing 模块配置文件
 * =========================================
 * 作用：定义模块的元信息、服务器接口地址和跨域白名单
 * 使用方式：全局变量 window.ShipGridModuleConfig 被 module-runtime.js 读取
 * 注意：不要在此文件中放置密码或私密 API 密钥
 *
 * 字段说明：
 * - moduleId:     模块唯一标识，宿主框架通过此ID识别消息来源
 * - version:      模块版本号，用于状态上报和调试
 * - carrier:      承运商标识（fedex/ontrac/ups），决定核心算法分支
 * - serverBase:   后端服务器基础地址，留空则使用当前域名
 * - fileApi:      文件上传/下载接口路径前缀
 * - allowedParentOrigins: 允许嵌入此模块的父页面域名白名单
 */
window.ShipGridModuleConfig = {
	moduleId: "fedex-billing",
	version: "3.76-modular.1",
	carrier: "fedex",
	serverBase: "",
	fileApi: "/api/excel/files",
	allowedParentOrigins: [],
};
