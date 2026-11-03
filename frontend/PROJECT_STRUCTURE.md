# RBAC 权限管理系统（前端）文件与路径说明

> 本文档逐个说明项目中的每个文件/目录「是什么、做什么用、什么时候需要改它」，并附启动方式、核心运行链路与新增页面的标准做法。新人读完即可上手开发。

---

## 一、项目简介

基于 **Vue 3 + TypeScript + Vite + Element Plus + Pinia** 的 RBAC（基于角色的访问控制）后台管理系统前端，配合 Spring Boot 后端使用。

核心能力：

- 登录 / 注册 / 退出，JWT 鉴权
- 用户管理、角色管理、菜单管理、权限管理
- **动态路由 + 动态菜单**：菜单由后端下发，前端按菜单树自动生成路由和侧边栏
- **按钮级权限**：通过 `v-hasPermi` 指令控制页面元素显隐

## 二、技术栈与环境要求

| 项 | 版本/说明 |
|---|---|
| Node.js | 建议 20 LTS 或 22+（Vite 6 要求 `^18 || ^20 || >=22`；当前开发机为 v24.21.0） |
| 包管理 | npm（随 Node 安装，当前 11.x） |
| 核心框架 | Vue 3.5（`<script setup>` 组合式 API） |
| 构建工具 | Vite 6.4 |
| 语言 | TypeScript 5.6 |
| UI 组件库 | Element Plus 2.8（中文语言包） |
| 状态管理 | Pinia 2.2 |
| 路由 | Vue Router 4.4（History 模式） |
| HTTP | Axios 1.7 |

后端默认地址：`http://localhost:8080`，后端 context-path 为 `/api`，前端通过 Vite 代理转发（见下文 `vite.config.ts`）。

## 三、常用命令（在项目根目录执行）

| 命令 | 作用 | 何时使用 |
|---|---|---|
| `npm install` | 安装/同步依赖 | 首次拉取代码或 `package.json` 有更新时 |
| `npm run dev` | 启动开发服务器（端口 6662，自动开浏览器，热更新） | 日常开发 |
| `npm run build` | 类型无关的生产构建，产物输出到 `dist/` | 打包发布前 |
| `npm run preview` | 本地预览 `dist/` 构建产物 | 验证打包结果 |
| `npm run type-check` | 用 vue-tsc 做全量 TypeScript 类型检查（不产出文件） | 提交代码前自查类型错误 |

> 说明：Windows PowerShell 下若 `npm` 被策略拦截，可用 `npm.cmd` 代替。
> 项目已在 `package.json` 的 `allowScripts` 中授权 `esbuild`、`vue-demi` 的安装脚本，正常 `npm install` 不应再有 install-scripts 警告。

## 四、完整目录结构

```
frontend/
├── index.html                  # Vite 应用 HTML 入口
├── package.json                # 依赖清单、npm 脚本、安装脚本授权
├── package-lock.json           # 依赖版本锁定文件
├── tsconfig.json               # TypeScript 编译配置（含 @ 路径别名）
├── vite.config.ts              # Vite 配置（别名、端口、后端代理）
├── PROJECT_STRUCTURE.md        # 本文档
├── dist/                       # 【自动生成】npm run build 的产物
├── node_modules/               # 【自动生成】npm install 的依赖
└── src/
    ├── main.ts                 # 应用启动入口
    ├── App.vue                 # 根组件
    ├── vite-env.d.ts           # Vite/TS 类型声明（.vue 模块等）
    ├── api/                    # 后端接口封装层
    │   ├── request.ts          #   axios 实例、拦截器、token 管理
    │   ├── auth.ts             #   认证相关接口
    │   ├── user.ts             #   用户管理接口
    │   ├── role.ts             #   角色管理接口
    │   ├── menu.ts             #   菜单管理接口
    │   └── permission.ts       #   权限管理接口
    ├── router/
    │   └── index.ts            # 路由表、动态路由生成、登录守卫
    ├── stores/
    │   └── user.ts             # 用户状态仓库（token/角色/权限/菜单）
    ├── directive/
    │   └── permission.ts       # v-hasPermi 按钮权限指令
    ├── types/
    │   └── index.ts            # 全局 TypeScript 类型定义
    ├── styles/
    │   └── index.css           # 全局基础样式与通用工具类
    ├── layout/                 # 后台主框架（登录后的外壳）
    │   ├── index.vue           #   整体布局：侧边栏 + 顶栏 + 内容区
    │   └── components/
    │       ├── Sidebar.vue         # 侧边栏（Logo + 菜单容器）
    │       ├── SidebarItem.vue     # 递归菜单项（目录/菜单）
    │       └── HeaderBar.vue       # 顶栏（折叠按钮/面包屑/用户区）
    └── views/                  # 页面组件（按后端 component 字段动态加载）
        ├── login/index.vue          # 登录页
        ├── register/index.vue       # 注册页
        ├── dashboard/index.vue      # 工作台首页
        ├── error/404.vue            # 404 页
        └── system/                  # 系统管理模块
            ├── user/index.vue          # 用户管理
            ├── role/index.vue          # 角色管理
            ├── menu/index.vue          # 菜单管理
            └── permission/index.vue     # 权限管理
        └── finance/                  # 财务管理模块
            ├── quoteOptions.vue      # 成本选择
        └── functionalDesign/         # 功能设计模块
            ├── costAllocation.vue      # 成本选择

```

> 注意：项目目前**没有** `public/` 目录与 `src/assets/` 目录。`index.html` 引用的 `/favicon.ico` 实际不存在（浏览器控制台会有一个 404，不影响功能）；需要网站图标时，新建 `public/favicon.ico` 即可。

---

## 五、根目录文件逐个说明

### 1. `index.html` —— HTML 入口

Vite 项目的唯一 HTML 模板。内容很简单：

- `<div id="app">`：Vue 应用挂载点
- `<script type="module" src="/src/main.ts">`：以 ES Module 方式加载真正的程序入口
- 设置了页面标题「RBAC 权限管理系统」、中文语言、视口

**何时改**：改浏览器标题、引入全局 CDN 脚本、加 favicon、加埋点等。

### 2. `package.json` —— 项目清单

包含四块内容：

- `scripts`：`dev` / `build` / `preview` / `type-check` 四个命令（见上表）
- `dependencies`：运行时依赖 —— vue、vue-router、pinia、element-plus、`@element-plus/icons-vue`、axios
- `devDependencies`：开发期依赖 —— vite、`@vitejs/plugin-vue`、typescript、vue-tsc、`@types/node`
- `allowScripts`：npm 11 的安装脚本白名单，已授权 `esbuild`（平台二进制）与 `vue-demi`（Vue 版本切换）的 postinstall

**何时改**：安装新依赖时由 npm 自动更新；一般不手写。切勿随意把 vite 升到 7/8 大版本。

### 3. `package-lock.json` —— 依赖版本锁

锁定整棵依赖树的精确版本与完整性哈希，保证团队/CI 安装结果一致。

**何时改**：执行 install/update 后自动变化。**应提交到 Git，不要手改，不要删除。**

### 4. `tsconfig.json` —— TypeScript 配置

关键项：

- `strict: true`：开启严格类型检查
- `moduleResolution: "bundler"`：适配 Vite 的模块解析方式
- `paths`：`"@/*": ["src/*"]` —— 代码里的 `@/xxx` 等价于 `src/xxx`（如 `@/api/user` → `src/api/user.ts`）
- `types: ["node"]`：允许在 TS 中使用 Node 类型
- `include`：只检查 `src/` 与 `vite.config.ts`

**何时改**：新增路径别名、调整严格度、纳入新的检查目录时。

### 5. `vite.config.ts` —— Vite 配置

做了三件事：

1. 注册 Vue 插件 `@vitejs/plugin-vue`
2. 配置别名 `@` → `./src`（与 tsconfig 的别名保持一致，缺一不可）
3. 开发服务器：端口 **5173**、启动自动打开浏览器、把 `/api` 开头的请求**代理**到 `http://localhost:8080`（不重写路径，即 `/api/user/page` 原样转发）

**何时改**：

- 后端端口/地址变了 → 改 `server.proxy['/api'].target`
- 端口冲突 → 改 `server.port`
- 需要部署子路径、改构建输出 → 加 `base` / `build` 配置

### 6. `dist/`（自动生成）

`npm run build` 的产物：压缩后的 `index.html` + `assets/` 下带哈希的 js/css。交给 Nginx 等静态服务器部署即可，**不要手改、不提交 Git**。

### 7. `node_modules/`（自动生成）

依赖安装目录。体积大、不可手改，不提交 Git。出问题时可删除后重新 `npm install`。

---

## 六、`src` 源码文件逐个说明

### 6.1 应用入口

#### `src/main.ts` —— 启动入口

整个程序第一个执行的 TS 文件，启动顺序：

1. `createApp(App)` 创建应用
2. **全量注册** Element Plus 所有图标为全局组件（后端菜单的 `icon` 字段存图标名，如 `Setting`，模板里用 `<component :is="iconName">` 渲染，所以必须全局注册）
3. 注册 Pinia（`createPinia()`）
4. 注册路由
5. 注册 Element Plus 并传入**中文语言包**
6. 注册自定义权限指令插件
7. 引入全局样式 `styles/index.css`
8. 挂载到 `#app`

**何时改**：引入新的全局插件（如状态持久化、图表库）、全局错误处理时在这里 `app.use()`。

#### `src/App.vue` —— 根组件

用 `el-config-provider` 再包一层中文配置，内部只有一个 `<router-view />`，即所有页面都渲染在这里。登录页与后台框架的切换由路由控制。

#### `src/vite-env.d.ts` —— 类型声明

- `/// <reference types="vite/client" />`：提供 `import.meta.glob`、环境变量等 Vite 特有类型
- 声明 `*.vue` 模块类型，让 TS 能识别 `.vue` 导入

**不需要改**，除非要增加 `import.meta.env` 自定义环境变量类型。

### 6.2 类型定义

#### `src/types/index.ts` —— 全局类型中心

定义前后端交互的全部接口（interface），所有 API 与页面共用：

| 类型 | 含义 |
|---|---|
| `SysUser` | 用户：账号、密码、昵称、邮箱、手机、状态(`0`正常`1`停用)、`roleIds` 角色 ID 数组等 |
| `SysRole` | 角色：角色名、角色编码、`menuIds`、`permissionIds` 等 |
| `SysMenu` | 菜单/目录/按钮：`menuType`（`M`目录 `C`菜单 `F`按钮）、`path` 路由、`component` 组件路径、`perms` 权限标识、`icon`、排序、可见/状态、`children` 树 |
| `SysPermission` | 权限点：名称、编码（如 `system:user:add`）、类型(menu/button/api) |
| `PageResult<T>` | 分页返回：`{ total, list }` |
| `Result<T>` | 后端统一返回：`{ code, msg, data }`，`code === 200` 为成功 |
| `LoginData` / `RegisterData` | 登录/注册入参 |
| `UserInfo` | 登录后用户信息：用户对象 + 角色编码数组 + 权限编码数组 + 菜单树 |

**何时改**：后端字段增减时，先改这里，全项目类型同步生效。

### 6.3 接口层 `src/api/`

统一约定：所有函数返回 `Promise<业务数据>`（响应拦截器已剥掉外层 `Result`）。

#### `src/api/request.ts` —— HTTP 基础设施（最重要的基础设施文件）

- 创建 axios 实例：`baseURL: '/api'`（走 Vite 代理）、超时 15 秒
- **请求拦截器**：从 `localStorage` 读取 key 为 `rbac_token` 的 JWT，加到请求头 `Authorization: Bearer xxx`
- **响应拦截器**：
  - `code === 200`：直接返回 `data`
  - `code === 401` 或 HTTP 401：清 token 并跳转 `/login`（带防重复跳转锁）
  - 其他错误：`ElMessage.error` 统一弹错误提示，业务代码无需重复弹错
- 导出 token 工具：`setToken` / `getToken` / `clearToken`
- 导出语义化方法：`get / post / put / del`，泛型参数即返回数据类型

**何时改**：后端返回结构变化、加加密签名、改 token 存储方式、加文件上传封装时。

其余五个文件是各模块的接口集合，函数名即业务动作，修改接口 URL/参数时按模块查找：

| 文件 | 提供的函数（对应后端接口） |
|---|---|
| `auth.ts` | `login`(POST `/auth/login`)、`register`、`getInfo`(GET `/auth/info`，取角色/权限/菜单)、`logout` |
| `user.ts` | `pageUsers`(分页)、`getUser`、`addUser`、`updateUser`、`deleteUsers`(ID 逗号拼接)、`assignRoles`(分配角色) |
| `role.ts` | `listRoles`(全量，给下拉用)、`pageRoles`、`getRole`、`addRole`、`updateRole`、`deleteRoles`、`assignRoleMenus`、`assignRolePermissions` |
| `menu.ts` | `listMenus`(平铺)、`treeMenus`(**树形**，侧边栏/表格/分配树都用它)、`addMenu`、`updateMenu`、`deleteMenu` |
| `permission.ts` | `pagePermissions`、`listPermissions`(全量，穿梭框用)、`addPermission`、`updatePermission`、`deletePermissions` |

### 6.4 路由 `src/router/index.ts` —— 路由与登录守卫（核心链路）

包含四部分：

1. **`constantRoutes` 静态路由**：登录页 `/login`、注册页 `/register`、根路径 `/`（使用 Layout 外壳，重定向到 `/dashboard`，含工作台子路由）
2. **`generateRoutes(menuTree)`**：把后端菜单树转成路由
   - 目录 `M` → 父路由 `component = Layout`，其下类型为 `C` 的子项生成子路由
   - 顶级菜单 `C` → 单独包一层 Layout
   - 页面组件通过 `import.meta.glob('../views/**/*.vue')` 预扫描，用菜单的 `component` 字段（如 `system/user/index`）动态匹配；匹配不到则落到 404
3. **全局前置守卫 `beforeEach`**：
   - 自动设置浏览器标签标题
   - 有 token：首次进入时拉取用户信息 → 生成并注册动态路由 → 最后注册 404 兜底（**顺序很重要**）→ 重新跳转一次目标页；拉取失败则清空状态回登录页并带 `redirect` 参数
   - 无 token：仅允许访问白名单 `/login`、`/register`，其余一律重定向登录页
4. 使用 `createWebHistory()`（History 模式，部署时需 Nginx 配置 history 回退）

**何时改**：新增不需要后端菜单的固定页面时，往 `constantRoutes` 加；改免登录白名单改 `WHITE_LIST`。

### 6.5 状态管理 `src/stores/user.ts` —— 用户仓库（Pinia）

全局唯一的用户状态中心，采用组合式写法（`ref` + 函数 + return）：

- **状态**：`token`、`userInfo`、`roles`(角色编码数组)、`permissions`(权限编码数组)、`menus`(菜单树)、`loaded`(信息是否已加载，等价于动态路由是否已注册)
- **计算属性**：`isAdmin` —— 角色包含 `admin` 即为超管
- **动作**：
  - `login`：调登录接口并持久化 token
  - `register`：注册
  - `getInfo`：拉取并写入用户全套信息
  - `hasPermi(code)`：**按钮权限判断核心**，admin 直接放行，否则检查权限数组
  - `logout`：通知后端 + 清空 + 跳登录页
  - `reset`：清空所有状态与本地 token

任何组件用 `const userStore = useUserStore()` 访问。

### 6.6 权限指令 `src/directive/permission.ts`

注册全局指令 **`v-hasPermi`**：

```vue
<!-- 单个权限 -->
<el-button v-hasPermi="['system:user:add']">新增</el-button>
<!-- 多个权限满足其一即显示 -->
<el-button v-hasPermi="['system:user:edit','system:user:add']">操作</el-button>
```

原理：元素 `mounted` 时取 store 的 `hasPermi` 判断，无权限则直接从 DOM 移除该元素。在 `main.ts` 中通过插件方式安装。

### 6.7 全局样式 `src/styles/index.css`

- 重置 `html/body/#app` 为 100% 高度、零边距（后台全屏布局的基础）
- 全局字体、背景色、`box-sizing: border-box`
- 三个后台页面通用类，各列表页直接复用：
  - `.page-container`：页面内边距
  - `.search-bar`：查询/操作按钮栏（flex、自动换行、10px 间距）
  - `.table-pagination`：分页条右对齐

**何时改**：调整全站基础风格或通用工具类。页面私有样式写在各 `.vue` 的 `<style scoped>` 里。

### 6.8 后台布局 `src/layout/`

登录后所有业务页面共用的「壳」。

#### `layout/index.vue` —— 布局骨架

Element Plus 容器组合：

- 外层 `el-container`（默认左右）：左侧 `el-aside` 侧边栏（折叠 64px / 展开 210px），右侧主区域
- 内层 `el-container` **显式 `direction="vertical"`**（上下结构）：上方 `HeaderBar`，下方 `el-main` 中的 `<router-view>`（带淡入淡出过渡）
- `collapsed` 折叠状态在这里维护，通过 props / `v-model:collapse` 分发给侧边栏和顶栏

**注意**：内层容器必须写 `direction="vertical"`——因为它的直接子节点是自定义组件 `HeaderBar` 而非 `el-header`，Element Plus 无法自动识别为纵向布局，不写会变成左右排列。

#### `layout/components/Sidebar.vue` —— 侧边栏

- 顶部 Logo 区（图标 + 系统名，折叠时只显示图标）
- `el-menu`：深色主题，`router` 模式（菜单项 index 即跳转路径），当前路由高亮，手风琴展开
- 固定的「工作台」菜单项 + 用 `v-for` 渲染 `userStore.menus`，每项交给递归组件 `SidebarItem`

#### `layout/components/SidebarItem.vue` —— 递归菜单项

- 类型 `M` 且有可见子项 → `el-sub-menu`，内部递归渲染自己
- 类型 `C` → `el-menu-item`；类型 `F`（按钮）不渲染
- 自动过滤隐藏（`visible==='1'`）和停用（`status==='1'`）的子项
- `resolvePath` 负责把相对 path 与父级 path 拼成完整路由地址（以 `/` 开头的 path 视为绝对路径）

#### `layout/components/HeaderBar.vue` —— 顶栏

- 左：折叠/展开按钮（`Fold`/`Expend` 图标）、根据 `route.matched` 自动生成的面包屑
- 右：当前用户角色标签、用户头像名下拉菜单（回工作台、退出登录，退出有二次确认）
- 通过 `defineModel('collapse')` 与父组件双向绑定折叠状态

### 6.9 业务页面 `src/views/`

四个系统管理页结构高度统一：**查询卡片 + 表格卡片（含分页）+ 弹窗表单**，是开发新页面的参考模板。

#### `views/login/index.vue` —— 登录页（路由 `/login`）

居中卡片表单：用户名/密码校验、loading 防重复提交。登录成功跳到 `redirect` 参数或首页。表单默认填了 `admin/admin123` 方便开发；页面上标注了演示账号：

- `admin / admin123`：超级管理员（拥有全部权限）
- `test / 123456`：普通用户

**上线前记得清空默认账号密码。**

#### `views/register/index.vue` —— 注册页（路由 `/register`）

用户名 3-20 位、密码 6-32 位、两次密码一致性校验；注册成功跳登录页。后端默认给新用户「普通用户」角色。

#### `views/dashboard/index.vue` —— 工作台（路由 `/dashboard`）

登录后首页：欢迎卡（昵称 + 超管标识）、三张统计卡（角色数 / 权限数 / 可见菜单数，菜单数由前端递归统计）、按 `v-hasPermi` 显隐的四个系统管理快捷入口。可作为带权限按钮的写法示例。

#### `views/error/404.vue` —— 404 页

访问不存在的路由时展示，提供返回首页按钮。动态路由里匹配不到组件的菜单也会落到此页。

#### `views/system/user/index.vue` —— 用户管理（动态路由 `/system/user`）

- 查询：用户名模糊查询 + 分页（10/20/50 每页）
- 表格：用户信息、角色标签（红色为 admin）、`el-switch` 直接切换启停状态、创建时间
- 操作（均带权限指令）：
  - 新增/修改用户（用户名编辑时禁用；新增必填密码，修改留空表示不改密码；必须分配角色）
  - **分配角色**：复用同一弹窗的精简模式（只显示角色多选），提交 `updateUser`
  - 删除（二次确认，支持批量 ID 接口，当前页面传单 ID）
- 需要的权限码：`system:user:list/add/edit/remove/assignRole`

#### `views/system/role/index.vue` —— 角色管理（`/system/role`）

- 角色分页查询、新增/修改（角色名、角色编码如 `admin`、状态、备注）
- **分配菜单**：`el-tree` 带复选框展示完整菜单树（节点标注目录/菜单/按钮类型和权限码），保存时同时提交「选中 + 半选」节点，保证父级菜单不丢
- **分配权限**：`el-transfer` 穿梭框，左未拥有/右已拥有，支持搜索
- 删除提示会说明关联关系一并解除
- 权限码：`system:role:list/add/edit/remove/assignMenu/assignPermission`

#### `views/system/menu/index.vue` —— 菜单管理（`/system/menu`）

- 树形表格（`row-key="id"` + `children`），默认全部展开，展示图标、类型、权限标识、路由地址、组件路径、排序、可见、状态
- 新增/修改弹窗是理解动态路由约定的关键：
  - **上级菜单**：顶级目录 `parentId=0` 或选已有目录/菜单
  - **菜单类型**：`M 目录`（组件固定 `Layout`）、`C 菜单`（填路由地址与组件路径）、`F 按钮`（只填权限标识，无路由）
  - **路由地址**：目录填 `/system` 这种绝对路径；菜单填 `user` 这种相对路径
  - **组件路径**：填 `src/views` 下的相对路径，**不带 `.vue`**，如 `system/user/index`——必须与实际文件位置一致，否则该菜单打开是 404
  - **图标**：从内置图标列表选或手输图标名（即 Element Plus 图标组件名）
- 「新增子项」按钮：目录下默认建菜单、菜单下默认建按钮
- 权限码：`system:menu:list/add/edit/remove`

#### `views/system/permission/index.vue` —— 权限管理（`/system/permission`）

- 按权限名称/标识双条件分页查询
- 新增/修改：权限名称（如「用户新增」）、权限标识（如 `system:user:add`，与 `v-hasPermi` 的值一一对应）、类型（menu/button/api）、状态、备注
- 权限码用等宽字体样式突出显示
- 权限码：`system:permission:list/add/edit/remove`

---

## 七、核心运行链路（把文件串起来）

### 启动与登录链路

```
浏览器打开
  → index.html → src/main.ts（注册 Pinia/路由/ElementPlus/图标/指令/样式）
  → App.vue 的 <router-view>
  → router.beforeEach 守卫（src/router/index.ts）
      ├─ 无 token 且非白名单 → 重定向 /login
      └─ 有 token 且首次加载
           → stores/user.ts 的 getInfo()
                → api/auth.ts getInfo() → GET /api/auth/info（经 request.ts 自动带 JWT）
           → generateRoutes(菜单树) 注册动态路由
           → 进入 Layout（Sidebar 读 userStore.menus 渲染菜单）
```

### 一次带权限的请求链路

```
页面调用 api/xxx.ts 的函数
  → request.ts：加 baseURL=/api + Authorization 头
  → Vite 代理（vite.config.ts）→ http://localhost:8080/api/...
  → 响应拦截器：code=200 取 data；401 清登录；其他弹 ElMessage
  → 页面拿到业务数据
```

### 权限控制的两层实现

1. **菜单/路由级（页面能不能看到、能不能进）**：后端在 `/auth/info` 只返回该用户有权的菜单树，前端动态生成路由与侧边栏；手输 URL 也只会命中 404。
2. **按钮级（页面内元素显隐）**：后端返回 `permissions` 编码数组存入 user store，模板用 `v-hasPermi="['system:user:add']"` 控制；`admin` 角色在 `hasPermi()` 中直接放行。

权限标识命名约定：`模块:资源:动作`，如 `system:user:add`，三处必须保持一致：

- 后端权限表的 `permission_code`
- 菜单管理中按钮(F)类型节点的 `perms`
- 前端代码里 `v-hasPermi` 的字符串

## 八、如何新增一个业务页面（标准步骤）

以新增「部门管理」为例：

1. **建文件**：创建 `src/views/system/dept/index.vue`，复制 `permission/index.vue` 改造最快（查询 + 表格 + 分页 + 弹窗骨架与通用 CSS 类都是现成的）。
2. **建 API**：新建 `src/api/dept.ts`，从 `request.ts` 导入 `get/post/put/del` 封装接口；类型加到 `src/types/index.ts`。
3. **配菜单（无需改路由代码）**：用 admin 登录 → 菜单管理：
   - 在「系统管理」目录下新增菜单，类型 `C`，路由地址如 `dept`，组件路径填 `system/dept/index`
   - 在该菜单下新增若干按钮（类型 `F`），权限标识如 `system:dept:add`
4. **配权限与角色**：权限管理中确认权限点存在；角色管理给对应角色勾选新菜单和新权限。
5. **页面内控制按钮**：操作按钮加 `v-hasPermi="['system:dept:add']"`。
6. 用该角色用户重新登录即可看到菜单；开发期可 `npm run type-check` 自查类型。

只有**不需要出现在菜单里的固定页**（如登录页）才需要手写进 `router/index.ts` 的 `constantRoutes`。

## 九、部署要点

1. `npm run build` 后把 `dist/` 交给 Nginx。
2. 项目是 History 路由模式，Nginx 需要把找不到的路径回退到 `index.html`：

   ```nginx
   location / {
     try_files $uri $uri/ /index.html;
   }
   ```

3. 生产环境没有 Vite 代理，需要在 Nginx 配置 `/api` 反向代理到真实后端，并处理跨域由后端或网关负责。
4. JWT 存在浏览器 `localStorage`（key：`rbac_token`），换设备/退出即清除。

## 十、已知细节与注意事项

- `index.html` 引用的 `/favicon.ico` 暂无对应文件（无 `public/` 目录），控制台会有图标 404，不影响运行。
- 构建时主 chunk 超过 500 kB 会有一条体积提示（Element Plus 全量引入所致），属正常；如需优化可后续改按需引入或配置 `manualChunks` 分包。
- Element Plus 图标在 `main.ts` 全量全局注册，菜单图标名必须使用官方图标组件名（如 `Setting`、`UserFilled`、`HomeFilled`）。
- 状态值统一用字符串：`status` / `visible` 均为 `'0'` 正常/显示、`'1'` 停用/隐藏，与后端保持一致。
- 删除接口支持批量：路径为逗号拼接的 ID（如 `/user/1,2,3`），页面当前都以单 ID 调用。


## 十一、GIT说明


- type	含义
- feat	新增功能
- fix	bug 修复
- refactor	代码重构（不修复 bug、不新增功能）
- docs	文档修改
- style	格式调整（空格、缩进、分号，无代码逻辑变更）
- test	新增 / 修改测试代码
- chore	构建、工具、配置、依赖更新，业务代码无改动
- perf	性能优化
- revert	回滚某次提交
