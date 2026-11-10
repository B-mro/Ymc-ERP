# ShipGrid财务模块交付说明

基线：V3.76；独立发布包版本：3.76-modular.1。

## 交付边界

这次拆分的是当前财务页面已有的5个模块：

| 目录 | 功能 | 主要计算入口 | 页面状态文件 |
|---|---|---|---|
| modules/ontrac-cost | A/B成本测算取低 | OnTracEngine.calculate | ui/ontrac-cost.js |
| modules/ontrac-billing | OnTrac客户出账 | OnTracBilling.calculate | ui/ontrac-billing.js |
| modules/fedex-billing | FedEx客户出账 | FedExBilling.calculate | ui/fedex-billing.js |
| modules/ups-billing | UPS客户出账 | UPSBilling.calculate | ui/ups-billing.js |
| modules/ups-audit | UPS合约审核、Dispute及历史关联 | UPSContractDefaults / UPSReviewReports / ShipGridUPS174 | ui/ups-audit.js |

每个目录有自己的HTML、UI、计算引擎、规则数据、工具、Vue及SheetJS。各目录没有指向兄弟模块的文件引用，因此只替换一个目录即可单独升级。每个module.json列出了本目录所需文件的加载顺序。

计算引擎保留既有JavaScript函数及全局命名，Vue3+TS提供的是接入组件和类型定义，**不是把全部引擎逐行重写成TS**。5个模块不要直接把全部classic脚本一起注入宿主window；推荐用提供的iframe Vue组件隔离。同一宿主页面可同时放置多个组件，状态、全局名称、样式互不污染。

本地一体版未改动，不必切换到这些目录。

## 发布与绑定

1. 选择需要的模块，完整复制目录到服务器。如FedEx模块发布为 `/finance/modules/fedex-billing/`。
2. 访问 `/finance/modules/fedex-billing/index.html`，该页面可独立打开。
3. 在现有Vue3+TS项目复制 `integration/vue3-ts/` 下3个文件。宿主使用已有Vue3和Vue Router4；无需另外复制一体版HTML。
4. 将routes.ts中的financeRoutes合并进现有路由表；或直接在页面中使用组件：

```vue
<FinanceModule module-id="fedex-billing" base-url="/finance/modules/" @ready="onReady" />
```

5. 宿主自行绑定登录与菜单权限。后端文件、报价与燃油接口也要验证用户权限，不能只依赖前端隐藏菜单。
6. 发布新版本时先部署完整目录到临时版本路径，再切换路径或软链接；避免只更新一半脚本。不要替换其他模块目录。

所有Vue/SheetJS依赖均随包提供，运行不依赖Google/CDN。各模块的共用文件是版本快照；只升级一个模块时不会影响其他模块。如果要同步修改全平台共用计价规则，仍需由IT明确选择同步哪些目录，而非自动扩散。

## 路径、服务器与数据

各模块config.js可配置：

| 字段 | 用途 |
|---|---|
| moduleId / version | 本模块身份及版本，不应随意更改 |
| serverBase | 共享服务器基址；空字符串使用当前来源。报价管理中用户保存的配置仍优先 |
| fileApi | 现有报价文件列表接口，默认 `/api/excel/files` |
| allowedParentOrigins | 跨来源嵌入时允许的宿主来源列表；同来源不需要填写 |

原固定报价地址中的旧IP已移除，改为当前来源或serverBase下的 `/excel_files/文件名.xlsx`。报价列表、客户匹配、用户报价文件并没有自动上传或迁移。服务器需提供实际文件和数据接口。此包没有Java后端或新的用户数据库。

现有接口调用位置：

- shared/quote-manager.js：现有共享报价/客户/匹配关系及文件列表协议；服务器路径与返回数据按该源码对接。
- `/api/fuel-refresh`：OnTrac燃油更新，响应需含 rates/source 等现有结构。
- `/api/fedex-fuel-refresh`：FedEx燃油更新。
- `/api/ups-fuel-refresh`：UPS燃油更新。

各燃油按钮以本模块实际UI源文件中的fetch路径为准；接口尚未部署时使用包内历史快照，超出快照覆盖日期继续按原规则提示，不伪造新费率。公开访问前，IT需确认数据快照有效性。

本地持久化继承原有IndexedDB/localStorage命名。同一来源下5个页面可共享已保存客户/报价；跨来源不会共享。不要把本地浏览器中的账单数据等同于服务器数据库。本次不会迁移用户原先file://页面中的本地报价、历史账单到服务器来源，迁移需先导出备份，再通过对应界面恢复或导入。

UPS审核继续提供174列及270列路径、历史跨账单关联、无单号燃油续行、订单信用抵扣及原导出。大量数据的Worker采用Blob创建，因此上线CSP需允许对应worker-src；Vue运行时模板编译涉及动态函数，若公司CSP禁用动态编译，需由IT预编译模板后再发布。本包没有替企业更改CSP。

## 宿主通信

`FinanceModule.vue`仅提供模块就绪事件和按请求读取状态，不自动向宿主发送订单、地址或原始账单。

- `ready`：模块主页面完成setup；不代表文件已导入或审核完成。
- `getStatus()`：返回moduleId、version、ready、busy、error、summary。
- `status`：状态查询响应。

postMessage固定channel为`shipgrid-finance-v1`，同时检查source、origin和moduleId。组件内有超时和卸载清理。跨来源需要在模块config.js中配置allowedParentOrigins，宿主需允许模块的frame-src；服务器需允许该宿主嵌入。

这些只是前端绑定点，不能作为已付款、已审核或允许发布账单的后端凭据。如需由服务器批量审核或保存正式账单，应由IT在Java后端另行实现API及权限、持久化、幂等和确认流程。

## 计价行为与限制

- 继承V3.76子单分区、GTS件数识别、价格/重量匹配以及偏远费补入逻辑。
- 多件识别已更正，但缺少专门多件合并计价规则的订单仍进入异常，不会假装已完成MWT/HWT自动出账。
- 价格反查不唯一、子单匹配冲突、偏远类型冲突继续进入异常。
- 本次目标为拆分发布，不新增或修改合约折扣、金额、燃油或HWT资格。
- 共用报价校验已独立为shared/quote-validators.js，无需加载其他模块的账单生成页面或完整计算引擎。

## 验证记录

参见docs/Verification.md。交付包完成脚本语法、独立依赖、主页面setup、Vue模板编译和计算回归检查。本次环境限制无法启动Chromium做真实页面交互，因此服务器上线前仍需IT按验收列表测试上传、计算、导出、跨来源嵌入、报价存取和大账单内存。
