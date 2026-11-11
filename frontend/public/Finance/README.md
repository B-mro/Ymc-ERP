# ShipGrid IT独立模块交付包 · V3.76

本包供IT分别发布和绑定，原本地一体版继续使用。

- `modules/`：5个独立模块，各自包含完整所需源码与依赖。
- `integration/vue3-ts/`：Vue3+TS路由与iframe接入组件。
- `docs/IT_Integration.md`：部署、数据接口、源码入口、已知限制及验收说明。
- `docs/Verification.md`：本次实际验证结果。
- `checksums.json`：交付文件校验值。
- `index.html`：静态模块目录页，可在测试服务器打开。

优先阅读 `docs/IT_Integration.md`，再复制单个模块目录。模块应通过HTTP/HTTPS发布。不要只复制一个engine文件；不要把5个模块的classic脚本混在同一个window。

源码中的业务引擎保留JavaScript；Vue3+TS接入组件已单独提供。本包没有Java后端，也没有替你部署线上服务。
