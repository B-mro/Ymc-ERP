# ShipGrid 财务模块 V3.54

入口覆盖 OnTrac A/B成本、OnTrac账单生成、FedEx账单生成、UPS账单生成、UPS账单审核。

## 本次修改

V3.54另外修复FedEx服务标记/可计算、以Net Charge Amount作为原始总费用依据，运输费字段0/空白不再拦截。不能将Net直接当基础费重复加附加费；客户基础费仍按报价重算。详见CHANGELOG_V3_54.md。

详见 CHANGELOG_V3_53.md。核心规则：最终计费重=max(原始最终计费重、GTS实重、GTS逐边换算INCH进位后的体积重、适用最低计费重)。GTS计费重字段不参与计算。

独立权重规则的TypeScript源代码：src/billing-weight-policy.ts。UPS净额审核TypeScript源代码：src/ups-ground-net-audit.ts。既有模块保留Vue3兼容JavaScript，不是把整站重写为TypeScript。

## 直接测试

打开 index.html 即可使用离线单文件前端。文件自身不依赖外部Vue CDN。共享文件接口仍按原共享配置访问服务器；本次不改变接口或网站权限。

## Vue3 + TypeScript项目

需要 Node.js 24，无需 npm install。

    npm run build
    npm test
    npm run preview

preview默认端口见preview.mjs。dist/为模块化前端，可部署到现有Java后端的静态资源目录；后端共享文件接口保持原实现。server/为原有兼容示例，本次没有重写Java后端。

构建时从同一份assets及TypeScript规则同步生成dist/、index.html和base.html，避免单文件与源码逻辑不同。新取重规则先于各计算引擎安装。

## 检查与限制

58项新取重计算/导出集成情形通过，涵盖GTS计费重无效/缺失不影响结果、逐边进位、单位、最低重、只更正重量、价格保护、缺失字段、多件拦截和三个承运商原生Excel导出。既有前端共享API和UPS净额审核测试通过；原94单回归申诉20单、金额1741.66保持一致。

Vue模板编译通过；环境没有浏览器可执行文件，未进行实际浏览器上传、点击和下载交互测试。请先用已知样本账单验证再正式出账。燃油快照和原报价/合约没有因本次规则修改而自动更新，仍按原模块日期覆盖及刷新机制处理。

源文件与客户数据不混存；本源码包不包含用于回归的真实账单明细。
