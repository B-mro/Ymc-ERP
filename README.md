# 企业管理系统 · 完整使用说明

> 本文档覆盖整个系统的前端页面、后端接口、数据库结构与运行架构，
> 供团队成员快速上手与二次开发参考。

---

## 目录

- [一、系统总览](#一系统总览)
  - 1.1 技术栈
  - 1.2 目录结构
  - 1.3 启动方式
- [二、前端页面详解](#二前端页面详解)
  - 2.1 登录 / 注册
  - 2.2 工作台 Dashboard
  - 2.3 系统管理（RBAC）
  - 2.4 数据权限规则
  - 2.5 接口管理（动态 SQL 配置）
  - 2.6 文件管理
  - 2.7 理赔中心（业务模块）
  - 2.8 财务发票
  - 2.9 404 错误页
- [三、后端接口清单](#三后端接口清单)
  - 3.1 认证 `/auth`
  - 3.2 用户 `/user`
  - 3.3 角色 `/role`
  - 3.4 菜单 `/menu`
  - 3.5 权限 `/permission`
  - 3.6 数据权限 `/data-scope`
  - 3.7 动态接口配置 `/dynamic-interface`
  - 3.8 动态接口运行时 `/dapi/**`
  - 3.9 理赔中心 `/claims-center`
  - 3.10 字典项 `/sys-dict-item`
  - 3.11 文件 `/file`
  - 3.12 Excel 文件浏览 `/excel`
- [四、安全架构](#四安全架构)
  - 4.1 JWT 认证流程
  - 4.2 权限拦截机制
  - 4.3 数据权限拦截器
  - 4.4 动态接口安全
- [五、数据库表结构](#五数据库表结构)
  - 5.1 RBAC 核心表
  - 5.2 数据权限表
  - 5.3 动态接口表
  - 5.4 业务表
- [六、典型使用流程](#六典型使用流程)
  - 6.1 新增一个业务角色并授权
  - 6.2 通过动态接口快速上线一个 API
  - 6.3 配置数据行级权限

---

## 一、系统总览

### 1.1 技术栈

| 层次 | 技术 | 版本 |
|---|---|---|
| 前端框架 | Vue 3 + TypeScript | 3.5 / 5.6 |
| 构建工具 | Vite | 6.4 |
| UI 组件库 | Element Plus | 2.8 |
| 状态管理 | Pinia | 2.2 |
| 路由 | Vue Router | 4.4 |
| HTTP | Axios | 1.7 |
| 后端框架 | Spring Boot | 3.2.5 |
| JDK | OpenJDK | 17 |
| ORM | MyBatis-Plus | 3.5.7 |
| 数据库 | MySQL | 8.x |
| 认证 | JJWT | 0.12.6 |
| API 文档 | Knife4j (OpenAPI 3) | 4.5 |
| 工具库 | Hutool | 5.8.27 |

### 1.2 目录结构

```
ymc-admin-dev/
├── backend/                         # 后端工程
│   ├── src/main/java/com/example/rbac/
│   │   ├── controller/              # 13 个 REST Controller
│   │   ├── service/                 # 业务层（RBAC / 业务模块 / 动态接口）
│   │   ├── mapper/                  # MyBatis-Plus Mapper
│   │   ├── entity/                  # 15 个数据库实体
│   │   ├── dto/ / vo/              # 数据传输 / 视图对象
│   │   ├── security/                # JwtInterceptor / DataPermissionInterceptor / UserContext / @RequiresPermission
│   │   ├── config/                  # WebMvcConfig / MybatisPlusConfig / Knife4jConfig / JacksonConfig
│   │   ├── common/                  # Result<T> / PageResult<T> / BusinessException
│   │   └── RbacAdminApplication.java
│   └── src/main/resources/
│       ├── application*.yml         # dev / test / prod 三套配置
│       └── sql/                     # rbac.sql / dynamic_interface.sql / dynamic_interface_README.md
│
└── frontend/                        # 前端工程
    ├── src/
    │   ├── api/                     # 11 个接口模块 (auth / user / role / menu / permission / dataScope / dynamicInterface / customer / publicInterface / flie / request)
    │   ├── views/
    │   │   ├── login/ register/     # 认证页面
    │   │   ├── dashboard/           # 工作台
    │   │   ├── system/              # RBAC 5 个子模块
    │   │   ├── functionalDesign/    # 动态接口 + 文件上传
    │   │   ├── customer/info/       # 理赔中心 (FedexPage / UpsPage / OntracPage)
    │   │   ├── finance/             # 财务发票（iframe 嵌入）
    │   │   └── error/404.vue
    │   ├── layout/                  # 后台主框架 (侧边栏 + 顶栏 + TagsView)
    │   ├── router/index.ts          # 静态路由 + 动态菜单生成
    │   ├── stores/                  # user / tagsView Pinia Store
    │   └── utils/                   # request.ts (axios 实例) / dict.ts / directive.ts (v-hasPermi)
    ├── vite.config.ts
    └── package.json
```

### 1.3 启动方式

```bash
# === 后端 ===
cd backend
mvn clean install -DskipTests
mvn spring-boot:run                    # 默认 application-dev.yml
# 访问 API 文档:  http://localhost:8080/doc.html (Knife4j)
# 访问 Swagger:   http://localhost:8080/swagger-ui/index.html

# === 前端 ===
cd frontend
npm install
npm run dev                            # 默认 http://localhost:5173
# 构建生产包: npm run build
```

**数据库初始化**（首次启动必做）：
1. 执行 `backend/src/main/resources/sql/rbac.sql` — RBAC 基础表 + admin 账号
2. 执行 `backend/src/main/resources/sql/dynamic_interface.sql` — 动态接口表

---

## 二、前端页面详解

### 2.1 登录 / 注册

| 路径 | 说明 |
|---|---|
| `/login` | 账号密码登录页，BCrypt 校验，登录成功返回 JWT |
| `/register` | 自助注册页，注册后默认分配"客户"角色 |

**登录流程**：
1. 前端 `POST /auth/login` → 返回 `{ token: "xxx" }`
2. 前端将 token 存入 localStorage
3. 全局 axios 请求拦截器自动在 Header 加上 `Authorization: Bearer xxx`
4. 访问任意业务页时，前端调 `GET /auth/info` 拉取用户信息 + 菜单树 + 权限标识

**默认账号**（来自 `rbac.sql`）：
- 管理员：`admin / 123456`

---

### 2.2 工作台 Dashboard

**路由**：`/dashboard`（固定 affix，不可关闭）

**页面内容**：
- 欢迎卡片：展示当前用户昵称 + "超级管理员"标签
- 三张统计卡片：我的角色数 / 我的权限标识数 / 可见菜单数
- 快捷入口按钮组：按权限指令 `v-hasPermi` 动态显示
- 最近操作列表（预留扩展区）

---

### 2.3 系统管理（RBAC 5 模块）

#### 2.3.1 用户管理 `/system/user`

| 功能 | 操作 | 所需权限 |
|---|---|---|
| 列表查询 | 输入用户名模糊搜索 | `system:user:list` |
| 新增用户 | 弹窗表单 (用户名/昵称/密码/手机/邮箱/角色多选) | `system:user:add` |
| 修改用户 | 同弹窗，密码留空不更新 | `system:user:edit` |
| 删除用户 | 批量删除，多个 ID 逗号分隔 | `system:user:remove` |
| 状态开关 | 表格行内 Switch，启用/停用 | `system:user:edit` |
| 分配角色 | 编辑弹窗内"角色"标签多选 | `system:user:assignRole` |

**核心字段**：`username`（登录名，唯一） / `password`（BCrypt 加密） / `status`（0启用 1停用） / `roleIds[]`（关联中间表）

#### 2.3.2 角色管理 `/system/role`

| 功能 | 操作 | 所需权限 |
|---|---|---|
| 角色分页查询 | 按角色名称搜索 | `system:role:list` |
| 新增/修改角色 | 角色名称 / 编码 / 描述 | `system:role:add` / `edit` |
| 分配菜单 | 穿梭框：可用菜单 ↔ 已授权菜单 | `system:role:assignMenu` |
| 分配权限 | 穿梭框：可用权限标识 ↔ 已授权权限 | `system:role:assignPermission` |
| 删除角色 | 批量 | `system:role:remove` |

**角色与菜单/权限的关系**：
```
SysRole ──(中间表 SysRoleMenu)──▶ SysMenu   (决定左侧菜单树)
SysRole ──(中间表 SysRolePermission)──▶ SysPermission  (决定 @RequiresPermission 放行)
SysUser ──(中间表 SysUserRole)──▶ SysRole
```

#### 2.3.3 菜单管理 `/system/menu`

**树形表格**（`el-table` tree-props + 默认展开）

| 字段 | 说明 |
|---|---|
| `menuName` | 菜单名称（目录名 / 页面名） |
| `menuType` | `M`=目录 / `C`=页面按钮 |
| `path` | 路由路径 |
| `component` | 组件路径，相对 `src/views/`，如 `system/user/index` |
| `perms` | 权限标识，如 `system:user:list` |
| `icon` | Element Plus 图标名 |
| `orderNum` | 同级排序 |
| `visible` | `0`=显示 / `1`=隐藏 |
| `parentId` | 父菜单 ID（0=顶级） |

**动态路由原理**：后端 `GET /menu/tree` 返回菜单树 → 前端 `router/generateRoutes()` 递归生成 `RouteRecordRaw` → `router.addRoute()` 动态注册。

#### 2.3.4 权限管理 `/system/permission`

独立于菜单的"细粒度按钮/API 权限标识"。

| 字段 | 说明 |
|---|---|
| `permissionName` | 权限名称（中文） |
| `permissionCode` | 权限标识（唯一，如 `system:user:add`） |
| `permissionType` | API / 按钮 / 数据 等类型 |
| `sortOrder` | 排序 |

使用方式：在 Controller 方法上加 `@RequiresPermission("system:user:add")` 注解，后端通过 `PermissionAspect` 切面校验当前登录用户是否拥有该权限。

#### 2.3.5 数据权限规则 `/system/dataScope`

行级数据权限（区别于菜单/按钮权限），用于控制"同一张表，不同角色能看到哪些行"。

| 字段 | 说明 |
|---|---|
| `scopeName` | 规则名称 |
| `perms` | 绑定的菜单权限标识（在哪个页面生效） |
| `scopeType` | `ALL`=全部数据 / `CUSTOM`=自定义范围 / `SELF`=仅本人 |
| `tableName` | 作用的数据库表名 |
| `fieldName` | 权限过滤字段（如 `create_by` / `dept_id`） |
| `valueSource` | `USERID`=当前用户ID / `USERNAME`=当前用户名 / `FIXED`=固定值 |
| `bindRoleIds` | 该规则适用的角色 ID 列表 |

**拦截原理**：`DataPermissionInterceptor` 是一个 MyBatis-Plus 拦截器，在 SQL 执行前自动解析 `sys_data_scope` 中绑定到当前用户角色 + 当前操作菜单的数据权限规则，然后在 WHERE 子句里动态拼接 `fieldName = 当前用户ID` 这样的条件。

---

### 2.4 接口管理（动态 SQL 配置）

#### 列表页 `/functionalDesign/Interface`

左侧分类树 + 右侧接口卡片表格：
- 顶部搜索：接口名称 / 请求方式 / 分类筛选
- 每条接口展示：方法深色标签（GET/POST/PUT/DELETE）、接口名、路径（等宽字体）、描述、参数数、状态开关
- 操作按钮：编辑 / 预览 / 删除 / 一键复制调用路径
- 支持双击名称快速编辑 / 描述行内展示

#### 新增/编辑表单 `/functionalDesign/Interface/interfaceForm`

**三步向导式**，低代码平台风格：

| 步骤 | 标题 | 核心内容 |
|---|---|---|
| Step 1 | 基本信息 | 接口名称 / 分类选择 / 请求方式 / 路径（自动 `/dapi` 前缀预览） / 返回类型（SINGLE/LIST/PAGE） / 描述 |
| Step 2 | SQL 编写 + 参数配置 | 带行号 gutter 的 SQL 编辑器 / 3 个一键模板 / 自动检测 `#{param}` / `${param}` 占位符 / 动态高亮参数卡片 |
| Step 3 | 调用预览 + 提交 | 左右分栏：左=请求信息（URL 预览 + 参数列表 + 测试值 Tab），右=响应 JSON（HTTP 状态 + 耗时 + body） |

**SQL 占位符语法**：
```sql
-- #{paramName}  → MyBatis 预编译参数（防注入，推荐 ✅）
SELECT * FROM orders WHERE id = #{orderId} AND status = #{status}

-- ${paramName}  → 字符串拼接（动态片段，谨慎使用 ⚠️）
SELECT * FROM orders ORDER BY ${sortField} ${sortOrder}
```

**三种返回类型**：
| 类型 | 含义 | SQL 写法 | 自动处理 |
|---|---|---|---|
| SINGLE | 单条对象 | `SELECT ... WHERE id = #{id}` | 取第一条返回 object |
| LIST | 列表 | `SELECT ... WHERE status = #{status}` | 直接返回数组 |
| PAGE | 自动分页列表 | 写不带 LIMIT 的全量 SQL | 后端自动加 `LIMIT offset,pageSize`，封装 `PageResult` |

**运行时调用**：保存后无需重启后端，立即可通过 `[GET|POST|PUT|DELETE] /dapi/你的路径` 调用。`DynamicApiController` 的 `/**` 通配请求会实时查库匹配接口配置，执行 SQL 并返回结果。

---

### 2.5 文件管理 `/functionalDesign/uploadFile`

| 功能 | 说明 |
|---|---|
| 上传文件 | 隐藏 `<input type="file">`，支持批量，单次 ≤50MB |
| 文件列表 | 表格展示：图标 / 原始文件名 / 大小 / 类型 / 上传人 / 上传时间 |
| 搜索过滤 | 文件名模糊 + 文件类型下拉 |
| 编辑信息 | 修改文件名/备注 |
| 下载 | 点击文件名或"下载"按钮 |
| 删除 | 批量勾选删除 |

**后端实现**：文件存本地磁盘（可配置），数据库 `sys_file` 表记录元数据（original_name / stored_name / file_path / file_size / file_type / uploader_id）。

---

### 2.6 理赔中心（业务模块）

按承运商拆为 3 个独立页面，逻辑完全对称：

| 承运商 | 页面 | claimsType 固定值 | 路径 |
|---|---|---|---|
| FedEx | `customer/info/FedexPage.vue` | `"1"` | `/customer/info/fedex` |
| OnTrac | `customer/info/OntracPage.vue` | `"2"` | `/customer/info/ontrac` |
| UPS | `customer/info/UpsPage.vue` | `"3"` | `/customer/info/ups` |

**三个页面共同功能**：
- 搜索区：物流单号 / 客户名称 / 索赔类型（字典 `claimsTypeOptions`）/ 问题类型（字典 `traceReasons` / `packageReasons` / `billingReasons`）/ 状态（字典 `claims_status`）
- 数据表格：序号 / 物流单号 / 客户名称 / 索赔类型（彩色 Tag）/ 问题类型 / 金额 / 状态 / 创建时间
- 新增/编辑弹窗：分段控件切换索赔类型，对应不同表单字段
- 详情查看：只读弹窗
- 删除 / 批量删除
- 字典项实时加载（所有下拉框从后端 `/sys-dict-item/listByCode` 获取，无需硬编码）

---

### 2.7 财务发票 `/finance/customerInvoice`

**嵌入型页面**，通过 `<iframe src="/QuoteCustomer/index.html">` 加载独立的发票报价前端应用。

**适配逻辑**：组件 `onMounted` 时自动计算 iframe 内容高度，监听 `window.resize` 实时调整，确保无滚动条溢出。

---

### 2.8 404 错误页

**路径**：`/:pathMatch(.*)*`（动态路由全部注册完成后由 `router.addRoute` 注册）

访问不存在的菜单 / 手动输入错误 URL → 统一跳到 404 页面。

---

## 三、后端接口清单

### 3.1 认证 `/auth`

| 方法 | 路径 | 说明 | 需登录 |
|---|---|---|---|
| POST | `/auth/login` | 登录 (BCrypt 校验密码)，返回 JWT token | ❌ |
| POST | `/auth/register` | 注册 (默认分配"客户"角色) | ❌ |
| GET | `/auth/info` | 获取当前用户信息：角色 / 权限标识 / 动态菜单树 | ✅ |
| POST | `/auth/logout` | 退出（JWT 无状态，实际前端清 token） | ✅ |

### 3.2 用户 `/user`

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| GET | `/user/page` | 用户分页列表 | `system:user:list` |
| GET | `/user/{id}` | 用户详情 (含 roleIds) | `system:user:list` |
| POST | `/user` | 新增用户 | `system:user:add` |
| PUT | `/user` | 修改用户 | `system:user:edit` |
| PUT | `/user/assign-roles` | 分配角色 | `system:user:assignRole` |
| DELETE | `/user/{ids}` | 批量删除 | `system:user:remove` |
| GET | `/user/batch?ids=1,2,3` | 批量查用户昵称 (脱敏) | `system:user:list` |

### 3.3 角色 `/role`

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| GET | `/role/list` | 全部正常角色 (下拉用) | ✅ 登录即可 |
| GET | `/role/page` | 角色分页列表 | `system:role:list` |
| GET | `/role/{id}` | 角色详情 (含 menuIds + permissionIds) | `system:role:list` |
| POST | `/role` | 新增角色 | `system:role:add` |
| PUT | `/role` | 修改角色 | `system:role:edit` |
| PUT | `/role/assign-menus` | 分配菜单 | `system:role:assignMenu` |
| PUT | `/role/assign-permissions` | 分配权限 | `system:role:assignPermission` |
| DELETE | `/role/{ids}` | 批量删除 | `system:role:remove` |

### 3.4 菜单 `/menu`

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| GET | `/menu/list` | 菜单扁平列表 | `system:menu:list` |
| GET | `/menu/tree` | 菜单树形结构 (含嵌套 children) | `system:menu:list` |
| POST | `/menu` | 新增菜单 | `system:menu:add` |
| PUT | `/menu` | 修改菜单 | `system:menu:edit` |
| DELETE | `/menu/{id}` | 删除菜单 | `system:menu:remove` |

### 3.5 权限 `/permission`

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| GET | `/permission/list` | 全部正常权限 (穿梭框用) | `system:permission:list` |
| GET | `/permission/page` | 权限分页列表 | `system:permission:list` |
| POST | `/permission` | 新增权限 | `system:permission:add` |
| PUT | `/permission` | 修改权限 | `system:permission:edit` |
| DELETE | `/permission/{ids}` | 批量删除 | `system:permission:remove` |

### 3.6 数据权限 `/data-scope`

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/data-scope/menu-perms` | 获取所有菜单权限标识下拉项 |
| POST | `/data-scope/list` | 规则列表查询 |
| POST | `/data-scope/page` | 规则分页查询 |
| POST | `/data-scope/detail` | 规则详情 |
| POST | `/data-scope/save` | 新增规则 + 绑定角色 |
| POST | `/data-scope/update` | 修改规则 + 重新绑定角色 |
| POST | `/data-scope/delete` | 删除规则 |
| POST | `/data-scope/bindRoles` | 单独重新绑定角色 |
| POST | `/data-scope/boundRoles` | 查询已绑定的角色 ID |

### 3.7 动态接口配置 `/dynamic-interface`

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/dynamic-interface/page` | 接口分页 (支持 name / method / categoryId 筛选) |
| GET | `/dynamic-interface/{id}` | 接口详情 (含参数列表) |
| POST | `/dynamic-interface` | 新增接口 |
| PUT | `/dynamic-interface` | 修改接口 |
| DELETE | `/dynamic-interface/{ids}` | 批量删除 |
| GET | `/dynamic-interface/category/tree` | 分类树 |
| POST | `/dynamic-interface/category` | 新增分类 |
| PUT | `/dynamic-interface/category` | 修改分类 |
| DELETE | `/dynamic-interface/category/{id}` | 删除分类 |

### 3.8 动态接口运行时 `/dapi/**`

**通配控制器** `DynamicApiController`，根据 HTTP 方法 + 请求路径实时匹配 `sys_data_interface` 表中的启用接口配置。

| 方法 | 路径 | 说明 |
|---|---|---|
| GET / POST / PUT / DELETE | `/dapi/{path}` | 执行配置好的 SQL 并返回结果 |

返回结构：
```json
// SINGLE → { "id": 1, "name": "xxx", ... }
// LIST   → [{ "id": 1, ... }, { "id": 2, ... }]
// PAGE   → { "records": [...], "total": 100, "pageNum": 1, "pageSize": 10 }
```

### 3.9 理赔中心 `/claims-center`

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/claims-center/list` | 列表查询 (可按 logisticsNo / claimsType / type / customerName 过滤) |
| POST | `/claims-center/page` | 分页查询 |
| POST | `/claims-center/detail` | 详情 `{ "id": 1 }` |
| POST | `/claims-center/save` | 新增 |
| POST | `/claims-center/update` | 修改 |
| POST | `/claims-center/delete` | 批量删除 `[1, 2, 3]` |

### 3.10 字典项 `/sys-dict-item`

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/sys-dict-item/listByCode` | 根据 dictCode 查启用项，返回 `[{ id, dictCode, label, value }]` |

**字典使用示例**（前端）：
```typescript
const options = await getDictData("claimsTypeOptions")
// → [{ label: "丢件", value: "1" }, { label: "破损", value: "2" }, { label: "错投", value: "3" }]
```

### 3.11 文件 `/file`

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/file/upload` | 上传文件 (multipart/form-data，字段名 `file`) |
| GET | `/file/page` | 文件分页列表 (支持 keyword / fileType 过滤) |
| GET | `/file/list` | 文件全量列表 |
| GET | `/file/{id}` | 文件详情 |
| PUT | `/file/update` | 修改元信息 |
| DELETE | `/file/{id}` | 删除 |

### 3.12 Excel 文件浏览 `/excel`

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/excel/files` | 列出服务器指定目录下所有 Excel 文件 |

返回：
```json
[{
  "fileName": "claims_2026.xlsx",
  "fileUrl": "http://cdn.xxx.com/excel_files/claims_2026.xlsx",
  "fileSize": 204800,
  "fileType": "xlsx",
  "lastModified": "2026-10-27 09:15:30",
  "absolutePath": "/www/java/.../excel_files/claims_2026.xlsx"
}]
```

---

## 四、安全架构

### 4.1 JWT 认证流程

```
┌──────────┐  POST /auth/login   ┌──────────────┐
│  前端    │ ─────────────────▶ │ AuthController│
│  用户    │  {username, password}              │
└──────────┘                     └──────┬───────┘
     ▲                                    │ BCrypt 校验
     │ 返回 token                        ▼
     │                              ┌──────────────┐
     │                              │  生成 JWT    │
     │                              │ userID + role │
     │                              └──────────────┘
     │
  前端存 localStorage
  每次请求 Header:
  Authorization: Bearer <token>
     │
     ▼
┌───────────────────────┐
│ JwtInterceptor        │
│ 1. 解析 JWT 签名校验   │
│ 2. 查 Redis 黑名单?   │
│ 3. 写入 UserContext    │
│ 4. 放行 or 401         │
└───────────────────────┘
```

### 4.2 权限拦截机制

```
@RequiresPermission("system:user:add")
                │
                ▼
       PermissionAspect (AOP)
                │
                ▼
    从 UserContext 拿当前用户权限集合
                │
                ▼
    contains("system:user:add") ?
    ├─ YES → 继续执行 Controller
    └─ NO  → 抛 BusinessException "无权限" (403)
```

### 4.3 数据权限拦截器

`DataPermissionInterceptor` 是 MyBatis-Plus 的 `InnerInterceptor`，在 SQL 执行前：
1. 提取当前操作的 `tableName`
2. 根据当前用户角色 + 当前菜单 perms 查询 `sys_data_scope`
3. 按 `scopeType` 处理：
   - `ALL` → 不拼接条件
   - `SELF` → 拼接 `fieldName = 当前用户ID`
   - `CUSTOM` → 拼接自定义 value
4. 改写后的 SQL 交给数据库执行

### 4.4 动态接口安全

| 防线 | 说明 |
|---|---|
| 白名单前缀校验 | SQL 必须以 SELECT / INSERT / UPDATE / DELETE 开头，禁止 DDL（DROP/ALTER/TRUNCATE） |
| 危险关键字过滤 | 检测 DROP/ALTER/GRANT 等敏感词 |
| `#{}` 预编译 | 推荐语法自动使用 PreparedStatement 防注入 |
| `${}` 警示 | 使用字符串拼接的占位符在前端有红色提醒 |
| 接口启停状态 | `status = '1'` 的接口配置才会被执行 |

---

## 五、数据库表结构

### 5.1 RBAC 核心表

```sql
sys_user           -- 用户 (username, password, nickname, phone, email, status)
sys_role           -- 角色 (role_name, role_code, description, status)
sys_permission     -- 权限 (permission_name, permission_code, permission_type)
sys_menu           -- 菜单 (menu_name, menu_type=M/C, path, component, perms, icon, parent_id)
sys_user_role      -- 中间表: user_id ↔ role_id
sys_role_menu      -- 中间表: role_id ↔ menu_id
sys_role_permission-- 中间表: role_id ↔ permission_id
```

### 5.2 数据权限表

```sql
sys_data_scope     -- 数据权限规则 (scope_name, perms, scope_type, table_name, field_name, value_source)
sys_role_data_scope-- 中间表: role_id ↔ scope_id
```

### 5.3 动态接口表

```sql
sys_data_interface            -- 接口配置 (name, path, method, sql_content, return_type=SINGLE/LIST/PAGE, status)
sys_data_interface_param      -- 参数定义 (interface_id, param_name, field_name, type, position, required, default_value)
sys_data_interface_category   -- 分类树 (parent_id, name, order_num)
```

### 5.4 业务表

```sql
claims_center       -- 理赔中心 (logistics_no, claims_type=1/2/3, type, customer_name, customer_no, issue_type, service_type, amount, status)
sys_file            -- 文件元数据 (original_name, stored_name, file_path, file_size, file_type, uploader_id)
sys_dict_item       -- 字典项 (dict_code, label, value, sort_order, status)
```

---

## 六、典型使用流程

### 6.1 新增一个业务角色并授权

```
① 系统管理 → 角色管理 → 新增角色
   └─ 填写 role_name = "理赔专员", role_code = "claims_staff"

② 角色列表 → 该行的"分配菜单"
   └─ 穿梭框勾选：理赔中心(全部3页) + 工作台
   
③ 角色列表 → 该行的"分配权限"
   └─ 勾选：claims-center:list / claims-center:save / claims-center:update
      不勾选 claims-center:delete → 理赔专员不可删除

④ 系统管理 → 用户管理 → 新增用户
   └─ 角色下拉多选：勾上"理赔专员"
   └─ 该用户登录后 → 左侧菜单自动只看到理赔中心 + 工作台
```

### 6.2 通过动态接口快速上线一个 API

```
① 前端：功能设计 → 接口管理 → 新增接口

② Step 1 基本信息
   名称：客户发票查询
   分类：财务模块
   请求方式：GET
   路径：/customerInvoice
   返回类型：LIST
   
③ Step 2 SQL 编写
   粘贴：SELECT * FROM customer_invoice WHERE status = #{status} LIMIT 20
   → 系统自动检测到参数 status，自动生成参数卡片
   → 手动补充参数详情：status → String → Query 参数 → 非必填
   
④ Step 3 调用预览
   测试值：status = "pending" → 点"测试调用"
   → 看到响应 JSON 正确
   
⑤ 点"提交保存"
   → 立即可用：GET http://localhost:8080/dapi/customerInvoice?status=pending
```

### 6.3 配置数据行级权限

```
① 系统管理 → 数据权限规则 → 新增规则

② 填写规则
   规则名称：仅看本人创建的理赔
   所属菜单：理赔中心 → 绑定 perms = claims-center:list
   范围类型：CUSTOM
   表名：claims_center
   权限字段：create_by
   取值来源：USERID (自动取当前登录用户ID)
   
③ 绑定角色：勾选 "理赔专员"

④ 理赔专员登录 → 查 claims-center 列表
   → MyBatis-Plus 拦截器自动改写 SQL：
   SELECT * FROM claims_center WHERE create_by = 123  -- 123 为当前用户ID
   → 只能看到自己创建的数据
```

---

## 七、附：项目中所有 dictCode 清单

| dictCode | 使用位置 | 说明 |
|---|---|---|
| `claimsTypeOptions` | FedexPage / UpsPage / OntracPage | 索赔类型：丢件/破损/错投 |
| `claims_status` | 理赔中心三页 | 理赔状态 |
| `traceReasons` | 理赔中心三页 | 追踪问题原因 |
| `packageReasons` | 理赔中心三页 | 包装问题原因 |
| `billingReasons` | 理赔中心三页 | 账单问题原因 |

> 字典项需在 `sys_dict_item` 表中预先配置好 label + value，前端下拉框自动加载。

---

**文档版本**：2026-10-27  
**维护者**：项目架构组  
**对应后端版本**：rbac-admin 1.0.0  
**对应前端版本**：rbac-admin-frontend 1.0.0