// ============================================================================
// config.js —— 运行时全局配置
// ----------------------------------------------------------------------------
// 被挂在 window.ShipGridModuleConfig 上，模块加载顺序里排在第一位。
//   moduleId           唯一标识，和 module.json 里的 id 一致
//   version            版本号，和 module.json 里的 version 一致
//   serverBase         服务器根路径（为空则用当前页面 origin）
//   fileApi            Excel 文件上传接口路径
//   allowedParentOrigins 允许 postMessage 通信的父窗口来源白名单
// ============================================================================
/* Server-specific settings. Do not put passwords or private API keys in this file. */
window.ShipGridModuleConfig = {
	moduleId: "ontrac-cost",
	version: "3.76-modular.1",
	carrier: null,
	serverBase: "",
	fileApi: "/api/excel/files",
	allowedParentOrigins: [],
};
