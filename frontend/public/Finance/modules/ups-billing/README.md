# UPS账单生成

独立目录：`ups-billing`，入口 `index.html`，版本 `3.76-modular.1`。

将整个目录发布到服务器的任意静态子路径，访问该路径的 index.html 即可。只发布本目录即可，不依赖其他模块目录。不要只复制 engine 文件而漏掉 data/shared/vendor/ui。

- `engine/`：业务计算源码；核心入口 `UPSBilling`。
- `ui/`：Vue3页面状态、上传、计算、下载逻辑。
- `shared/`：本模块固定版本的共用工具，修改不会自动影响其他目录。
- `data/`：成本、燃油、报价模板或审核规则数据（按本模块需要提供）。
- `vendor/`：随包本地加载的Vue/SheetJS，运行不依赖CDN。
- `assets/module.css`：本模块页面样式。
- `config.js`：服务器地址、文件接口及允许的父页面来源。
- `module.json`：加载次序与源码版本。

Vue3+TS接入示例在总包 `integration/vue3-ts/`。使用 iframe 路由组件隔离现有全局变量及样式；本包计算引擎保留现有JavaScript源码，不是逐行TypeScript重写。若要改为原生Vue SFC，可在后续按本目录 engine/ui 边界迁移，不应把5个目录的classic脚本同时加载到同一个window。

业务行为继承V3.76；多件根据GTS件数识别，缺少完整多件合并报价规则的账单仍进入异常。本次拆分不新增多件计价。所有资料缺失提示及审核规则继续生效。
