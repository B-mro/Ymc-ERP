# YMC-ERP 企业管理系统

> 基于 **Spring Boot 3 + Vue 3 + TypeScript** 的全栈企业资源管理系统，涵盖 RBAC 权限管理、动态接口配置、理赔中心、财务发票等核心业务模块。

---

## 目录

- [一、项目概述](#一项目概述)
- [二、技术栈](#二技术栈)
- [三、项目目录结构](#三项目目录结构)
- [四、环境要求](#四环境要求)
- [五、项目打开方式](#五项目打开方式)
- [六、后端运行方法](#六后端运行方法)
- [七、前端运行方法](#七前端运行方法)
- [八、默认账号](#八默认账号)
- [九、系统功能模块](#九系统功能模块)
- [十、安全架构](#十安全架构)
- [十一、数据库表结构](#十一数据库表结构)
- [十二、Git 文件上传标准](#十二git-文件上传标准)

---

## 一、项目概述

本项目是一套面向企业场景的综合性后台管理系统，采用前后端分离架构：

- **后端**：Spring Boot 3 + MyBatis-Plus + JWT，提供 RESTful API，支持 RBAC 权限模型、动态 SQL 接口配置、数据行级权限控制。
- **前端**：Vue 3 + TypeScript + Element Plus + Vite，提供用户管理、角色权限分配、动态菜单路由、理赔业务、财务发票等功能页面。

核心能力包括：
- **RBAC 权限管理**：用户 → 角色 → 菜单/权限 多对多模型，支持动态菜单路由和按钮级权限控制。
- **动态接口配置**：低代码风格的 SQL 配置平台，无需重启后端即可上线新的数据查询 API。
- **数据行级权限**：MyBatis-Plus 拦截器实现，不同角色在同一张表中看到不同范围的数据。
- **业务模块**：理赔中心（FedEx / UPS / OnTrac 三大承运商）、财务发票、文件管理等。

---

## 二、技术栈

### 后端

| 技术 | 版本 | 说明 |
|------|------|------|
| Java | 17 | 运行环境 |
| Spring Boot | 3.2.5 | 核心框架 |
| MyBatis-Plus | 3.5.7 | ORM 框架 |
| MySQL | 8.x | 关系型数据库 |
| JWT (jjwt) | 0.12.6 | 无状态身份认证 |
| Knife4j | 4.5.0 | API 在线文档（OpenAPI 3） |
| Hutool | 5.8.27 | Java 工具库（BCrypt 加密等） |
| Maven | 3.6+ | 项目构建工具 |

### 前端

| 技术 | 版本 | 说明 |
|------|------|------|
| Vue | 3.5+ | 前端框架 |
| TypeScript | 5.6+ | 类型安全 |
| Vite | 6.4+ | 前端构建工具 |
| Element Plus | 2.8+ | UI 组件库 |
| Pinia | 2.2+ | 状态管理 |
| Vue Router | 4.4+ | 前端路由 |
| Axios | 1.7+ | HTTP 请求库 |
| SheetJS (xlsx) | 0.20.3 | Excel 文件处理 |

---

## 三、项目目录结构

```
ymc-erp-dev/
├── backend/                                # 后端工程 (Spring Boot)
│   ├── pom.xml                             #   Maven 依赖配置
│   └── src/main/
│       ├── java/com/example/rbac/
│       │   ├── RbacApplication.java        #   启动类
│       │   ├── common/                     #   通用模块
│       │   │   ├── Result.java             #     统一响应封装
│       │   │   ├── PageResult.java         #     分页响应封装
│       │   │   ├── BusinessException.java  #     业务异常类
│       │   │   └── GlobalExceptionHandler.java # 全局异常处理
│       │   ├── config/                     #   配置类
│       │   │   ├── JacksonConfig.java      #     Jackson 序列化配置
│       │   │   ├── Knife4jConfig.java      #     Knife4j 文档配置
│       │   │   ├── MybatisPlusConfig.java  #     MyBatis-Plus 分页插件
│       │   │   ├── RequestLogFilter.java   #     请求日志过滤器
│       │   │   └── WebMvcConfig.java       #     Web 拦截器注册
│       │   ├── controller/                 #   控制器层 (17 个 Controller)
│       │   │   ├── AuthController.java     #     认证：登录/注册/用户信息
│       │   │   ├── SysUserController.java  #     用户管理
│       │   │   ├── SysRoleController.java  #     角色管理
│       │   │   ├── SysMenuController.java  #     菜单管理
│       │   │   ├── SysPermissionController.java    # 权限管理
│       │   │   ├── SysDataScopeController.java     # 数据权限规则
│       │   │   ├── SysDataInterfaceController.java # 动态接口配置
│       │   │   ├── SysDataInterfaceCategoryController.java # 接口分类
│       │   │   ├── SysDictItemController.java      # 字典项
│       │   │   ├── DynamicApiController.java       # 动态接口运行时
│       │   │   ├── ClaimsCenterController.java     # 理赔中心
│       │   │   ├── CustomerFileController.java     # 客户文件
│       │   │   ├── ExcelFileController.java        # Excel 文件浏览
│       │   │   ├── FedexSurchargeController.java   # FedEx 附加费
│       │   │   ├── OnTracSurchargeController.java  # OnTrac 附加费
│       │   │   └── FileController.java             # 文件管理
│       │   ├── dto/                        #   数据传输对象
│       │   │   ├── LoginDTO.java           #     登录请求
│       │   │   ├── RegisterDTO.java        #     注册请求
│       │   │   └── OnTracFuelSurcharge*.java #   OnTrac 燃油附加费
│       │   ├── entity/                     #   数据库实体 (15 个)
│       │   ├── mapper/                     #   MyBatis-Plus Mapper 接口
│       │   ├── security/                   #   安全模块
│       │   │   ├── JwtUtil.java            #     JWT 生成与解析
│       │   │   ├── JwtInterceptor.java     #     JWT 请求拦截器
│       │   │   ├── LoginUser.java          #     登录用户信息
│       │   │   ├── RequiresPermission.java #     权限注解
│       │   │   ├── UserContext.java        #     用户上下文 (ThreadLocal)
│       │   │   ├── UserPermissionCache.java #    用户权限缓存
│       │   │   └── DataPermissionInterceptor.java # 数据权限拦截器
│       │   ├── service/                    #   业务层
│       │   └── vo/                         #   视图对象
│       └── resources/
│           ├── application.yml             #   主配置文件
│           ├── application-dev.yml         #   开发环境配置
│           ├── application-test.yml        #   测试环境配置
│           ├── application-prod.yml        #   生产环境配置
│           ├── logback-spring.xml          #   日志配置
│           └── sql/                        #   数据库初始化脚本
│               ├── rbac.sql                #     RBAC 基础表 + 初始数据
│               ├── dynamic_interface.sql   #     动态接口表
│               └── dynamic_interface_README.md # 动态接口使用说明
│
├── frontend/                               # 前端工程 (Vue 3 + Vite)
│   ├── package.json                        #   依赖配置
│   ├── vite.config.ts                      #   Vite 构建配置
│   ├── index.html                          #   入口 HTML
│   ├── dist/                               #   编译输出（含独立 QuoteCustomer 应用）
│   └── src/
│       ├── main.ts                         #   应用入口
│       ├── App.vue                         #   根组件
│       ├── api/                            #   接口层 (12 个 API 模块)
│       │   ├── request.ts                  #     Axios 实例封装
│       │   ├── auth.ts                     #     认证接口
│       │   ├── user.ts                     #     用户接口
│       │   ├── role.ts                     #     角色接口
│       │   ├── menu.ts                     #     菜单接口
│       │   ├── permission.ts               #     权限接口
│       │   ├── dataScope.ts                #     数据权限接口
│       │   ├── dynamicInterface.ts         #     动态接口配置
│       │   ├── customer.ts                 #     理赔中心接口
│       │   ├── customerFile.ts             #     客户文件接口
│       │   ├── flie.ts                     #     文件管理接口
│       │   └── publicInterface.ts          #     公共接口
│       ├── components/                     #   公共组件
│       │   ├── FileUpload.vue              #     文件上传组件
│       │   └── ImageUpload.vue             #     图片上传组件
│       ├── directive/                      #   自定义指令
│       │   └── permission.ts               #     v-hasPermi 权限指令
│       ├── layout/                         #   布局组件
│       │   ├── index.vue                   #     主布局
│       │   └── components/                 #     侧边栏/顶栏/TagsView
│       ├── router/                         #   路由配置
│       │   └── index.ts                    #     静态路由 + 动态菜单生成
│       ├── stores/                         #   Pinia 状态管理
│       │   ├── user.ts                     #     用户状态
│       │   ├── tagsView.ts                 #     标签页状态
│       │   └── userCache.ts                #     用户缓存
│       ├── styles/                         #   全局样式
│       ├── types/                          #   TypeScript 类型定义
│       ├── utils/                          #   工具函数
│       │   └── dict.ts                     #     字典工具
│       └── views/                          #   页面视图
│           ├── login/                      #     登录页
│           ├── register/                   #     注册页
│           ├── dashboard/                  #     工作台
│           ├── system/                     #     系统管理 (RBAC 5 模块)
│           │   ├── user/                   #       用户管理
│           │   ├── role/                   #       角色管理
│           │   ├── menu/                   #       菜单管理
│           │   ├── permission/             #       权限管理
│           │   └── dataScope/              #       数据权限规则
│           ├── functionalDesign/           #     功能设计
│           │   ├── Interface/              #       动态接口管理
│           │   └── uploadFile/             #       文件管理
│           ├── customer/info/              #     理赔中心 (FedEx/UPS/OnTrac)
│           ├── finance/                    #     财务发票
│           ├── adminBackend/               #     后台管理
│           └── error/                      #     404 错误页
│
└── .gitignore                              # Git 忽略规则
```

---

## 四、环境要求

| 工具 | 版本要求 | 用途 |
|------|----------|------|
| JDK | 17+ | 后端运行环境 |
| Maven | 3.6+ | 后端依赖管理与构建 |
| MySQL | 8.x | 数据库（需 utf8mb4 字符集） |
| Node.js | 18+ | 前端运行环境（推荐 LTS 版本） |
| npm | 9+ | 前端包管理（Node.js 自带） |
| IDE | IntelliJ IDEA / VS Code | 推荐开发工具 |

---

## 五、项目打开方式

### 5.1 使用 IntelliJ IDEA 打开（推荐，适合全栈开发）

**后端：**

1. 启动 IntelliJ IDEA，点击 **File → Open**
2. 选择 `ymc-erp-dev/backend` 目录
3. IDEA 会自动识别为 Maven 项目，等待依赖下载完成
4. 确保已安装 **Lombok 插件**：`File → Settings → Plugins → 搜索 Lombok → Install`
5. 找到 `src/main/java/com/example/rbac/RbacApplication.java`，右键 → **Run 'RbacApplication'**

**前端（可在同一窗口以模块方式打开）：**

1. 在 IDEA 中点击 **File → New → Module from Existing Sources**
2. 选择 `ymc-erp-dev/frontend` 目录
3. 或使用 IDEA 内置终端：`View → Tool Windows → Terminal`，进入 `frontend` 目录执行命令

### 5.2 使用 VS Code 打开（推荐，前端开发更友好）

1. 启动 VS Code，点击 **File → Open Folder**
2. 选择 `ymc-erp-dev` 根目录
3. 推荐安装以下插件：
   - **Vue - Official**（Vue 3 语法支持）
   - **TypeScript Vue Plugin (Volar)**
   - **ESLint**
   - **Extension Pack for Java**（如需要后端开发）
4. 使用 VS Code 内置终端分别启动前后端

### 5.3 多窗口开发模式

推荐使用两个独立的 IDE 窗口分别打开 `backend/` 和 `frontend/` 目录，便于专注开发。

---

## 六、后端运行方法

### 6.1 数据库初始化（首次启动必做）

在 MySQL 中依次执行以下 SQL 脚本：

```bash
# 1. 初始化 RBAC 基础表和数据（用户/角色/菜单/权限）
mysql -u root -p < backend/src/main/resources/sql/rbac.sql

# 2. 初始化动态接口表
mysql -u root -p < backend/src/main/resources/sql/dynamic_interface.sql
```

### 6.2 修改数据库连接配置

编辑 `backend/src/main/resources/application-dev.yml`，修改数据库连接信息：

```yaml
spring:
  datasource:
    url: jdbc:mysql://你的数据库地址:3306/rbac_admin?useUnicode=true&characterEncoding=utf8&serverTimezone=Asia/Shanghai
    username: 你的数据库用户名
    password: 你的数据库密码
```

### 6.3 方式一：IDEA 中直接运行（推荐开发使用）

1. 在 IDEA 中打开 `backend` 项目
2. 找到启动类 `com.example.rbac.RbacApplication`
3. 右键 → **Run 'RbacApplication.main()'**
4. 默认使用 `application-dev.yml` 配置启动
5. 启动成功后控制台输出启动成功标志

### 6.4 方式二：Maven 命令启动

```bash
# 进入后端目录
cd backend

# 使用 Maven 启动（默认 dev 环境）
mvn spring-boot:run

# 指定其他环境启动
mvn spring-boot:run -Dspring-boot.run.profiles=test    # 测试环境
mvn spring-boot:run -Dspring-boot.run.profiles=prod    # 生产环境
```

### 6.5 方式三：打包成 JAR 运行

```bash
# 进入后端目录
cd backend

# 编译打包（跳过测试）
mvn clean package -DskipTests

# 运行 JAR 包
java -jar target/rbac-admin.jar

# 指定环境运行
java -jar target/rbac-admin.jar --spring.profiles.active=test
```

### 6.6 启动成功验证

控制台输出类似以下信息即表示启动成功：

```
----------------------------------------------------------
  Rbac-Admin 后端启动成功
  API 接口文档: http://localhost:8080/api/doc.html
----------------------------------------------------------
```

| 地址 | 说明 |
|------|------|
| http://localhost:8080/api/doc.html | Knife4j 接口文档（可在线调试） |
| http://localhost:8080/api/swagger-ui/index.html | Swagger UI |
| http://localhost:8080/api/v3/api-docs | OpenAPI 原始 JSON |

服务端口：**8080**，Context Path：**/api**

---

## 七、前端运行方法

### 7.1 安装依赖

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install
```

### 7.2 启动开发服务器

```bash
# 启动开发模式（支持热更新）
npm run dev
```

Vite 开发服务器默认配置：
- 端口：**6662**
- 自动打开浏览器（Chrome）
- 自动代理 `/api` 请求到后端 `http://localhost:8080`

### 7.3 访问前端页面

| 地址 | 说明 |
|------|------|
| http://localhost:6662 | 前端主页面 → 自动跳转登录页 |
| http://localhost:6662/#/login | 登录页面 |
| http://localhost:6662/#/register | 注册页面 |
| http://localhost:6662/#/dashboard | 工作台（需登录） |

### 7.4 前端构建生产包

```bash
# 构建生产环境
npm run build

# 预览生产构建
npm run preview
```

构建产物输出到 `frontend/dist/` 目录。

### 7.5 前端代理配置说明

前端开发时，Vite 已配置代理将 `/api` 请求转发到后端。配置位于 `vite.config.ts`：

```typescript
server: {
  port: 6662,
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true
    }
  }
}
```

如需连接其他后端地址，修改 `target` 字段即可。

### 7.6 完整启动流程（前后端联调）

```bash
# === 终端 1：启动后端 ===
cd backend
mvn spring-boot:run

# === 终端 2：启动前端 ===
cd frontend
npm install        # 仅首次需要
npm run dev

# === 浏览器访问 ===
# 打开 http://localhost:6662
# 使用 admin / 123456 登录
```

---

## 八、默认账号

数据库初始化脚本 `rbac.sql` 预设了以下账号：

| 角色 | 用户名 | 密码 | 说明 |
|------|--------|------|------|
| 超级管理员 | admin | 123456 | 拥有全部菜单和权限 |
| 普通用户 | test | 123456 | 基础权限 |

> 密码均使用 **BCrypt** 加密存储，不可逆。

---

## 九、系统功能模块

### 9.1 认证模块

- 登录：BCrypt 密码校验，返回 JWT Token（有效期 24 小时）
- 注册：自助注册，默认分配"客户"角色
- 获取当前用户信息：角色列表、权限标识集合、动态菜单树
- 退出登录：前端清除 Token

### 9.2 系统管理（RBAC 5 大模块）

| 模块 | 路由 | 功能说明 |
|------|------|----------|
| 用户管理 | `/system/user` | 用户 CRUD、状态启停、分配角色 |
| 角色管理 | `/system/role` | 角色 CRUD、分配菜单、分配权限 |
| 菜单管理 | `/system/menu` | 树形菜单管理（目录/菜单/按钮） |
| 权限管理 | `/system/permission` | 细粒度权限标识管理 |
| 数据权限 | `/system/dataScope` | 行级数据权限规则配置 |

### 9.3 动态接口配置

低代码 SQL 配置平台，三步向导式创建数据查询 API：
1. **基本信息**：接口名称、请求方式、路径、返回类型（SINGLE/LIST/PAGE）
2. **SQL 编写**：带行号的 SQL 编辑器，自动检测 `#{param}` / `${param}` 占位符
3. **调用预览**：实时测试 SQL 执行效果，预览返回结果

保存后通过 `/dapi/{path}` 即可立即调用，无需重启后端。

### 9.4 理赔中心

按承运商分为三个独立页面，功能完全对称：

| 承运商 | 路由 | claimsType |
|--------|------|------------|
| FedEx | `/customer/info/fedex` | 1 |
| UPS | `/customer/info/ups` | 3 |
| OnTrac | `/customer/info/ontrac` | 2 |

功能包括：物流单号搜索、索赔类型筛选、金额管理、状态流转等。

### 9.5 其他模块

- **工作台 Dashboard**：欢迎卡片、统计概览、快捷入口
- **文件管理**：文件上传/下载/搜索/删除，支持批量操作
- **财务发票**：iframe 嵌入独立发票报价应用
- **字典管理**：统一字典项配置，前端下拉框动态加载
- **404 错误页**：未匹配路由自动跳转

---

## 十、安全架构

### 10.1 JWT 认证流程

```
用户登录 → BCrypt 校验密码 → 生成 JWT Token → 返回前端
前端存储 Token → 每次请求 Header 携带 Authorization: Bearer <token>
后端 JwtInterceptor 拦截 → 解析 JWT → 写入 UserContext → 放行
```

### 10.2 权限拦截机制

Controller 方法上使用 `@RequiresPermission("system:user:add")` 注解声明所需权限。AOP 切面在方法执行前校验当前用户的权限集合是否包含该标识，不包含则返回 403 无权限。

### 10.3 数据行级权限

`DataPermissionInterceptor` 是 MyBatis-Plus 拦截器，在 SQL 执行前自动拼接行级过滤条件（如 `WHERE create_by = 当前用户ID`），实现不同角色的数据隔离。

### 10.4 动态接口安全

- SQL 必须以 SELECT/INSERT/UPDATE/DELETE 开头，禁止 DDL 操作
- 检测并过滤 DROP/ALTER/GRANT 等危险关键字
- `#{}` 占位符使用 PreparedStatement 预编译防注入
- 接口配置启用状态开关，停用接口不可调用

---

## 十一、数据库表结构

### RBAC 核心表

| 表名 | 说明 |
|------|------|
| `sys_user` | 用户表 |
| `sys_role` | 角色表 |
| `sys_menu` | 菜单表（M=目录 / C=菜单 / F=按钮） |
| `sys_permission` | 权限表 |
| `sys_user_role` | 用户-角色 关联表 |
| `sys_role_menu` | 角色-菜单 关联表 |
| `sys_role_permission` | 角色-权限 关联表 |

### 数据权限表

| 表名 | 说明 |
|------|------|
| `sys_data_scope` | 数据权限规则表 |
| `sys_role_data_scope` | 角色-数据权限 关联表 |

### 动态接口表

| 表名 | 说明 |
|------|------|
| `sys_data_interface` | 接口配置表 |
| `sys_data_interface_param` | 接口参数定义表 |
| `sys_data_interface_category` | 接口分类表 |

### 业务表

| 表名 | 说明 |
|------|------|
| `claims_center` | 理赔中心数据表 |
| `sys_file` | 文件元数据表 |
| `sys_dict_item` | 字典项表 |

---

## 十二、Git 文件上传标准

### 12.1 提交规范

本项目采用 **约定式提交**（Conventional Commits）规范，格式如下：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**type 类型说明：**

| type | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(backend): 添加用户批量导入功能` |
| `fix` | 修复 Bug | `fix(frontend): 修复菜单折叠后子路由不显示问题` |
| `docs` | 文档更新 | `docs: 更新 README 启动说明` |
| `style` | 代码格式（不影响功能） | `style(frontend): 统一缩进为 2 空格` |
| `refactor` | 代码重构 | `refactor(backend): 优化 JWT 拦截器逻辑` |
| `perf` | 性能优化 | `perf(backend): 添加用户权限缓存` |
| `test` | 测试相关 | `test(backend): 补充 AuthController 单元测试` |
| `chore` | 构建/工具变动 | `chore: 升级 Vite 到 6.4 版本` |
| `ci` | CI/CD 变更 | `ci: 添加自动构建流水线` |

**scope 范围说明：**

| scope | 说明 |
|-------|------|
| `backend` | 后端相关改动 |
| `frontend` | 前端相关改动 |
| `all` | 前后端都涉及 |

### 12.2 分支管理规范

| 分支 | 说明 | 保护策略 |
|------|------|----------|
| `main` | 生产分支，保持稳定可发布 | 禁止直接推送，仅通过 MR/PR 合入 |
| `dev` | 开发分支，日常开发汇聚 | 禁止直接推送，通过 MR/PR 合入 |
| `feat/xxx` | 功能分支，从 `dev` 拉出 | 开发完成后合入 `dev` |
| `fix/xxx` | 修复分支，从 `dev` 或 `main` 拉出 | 修复完成后合入对应分支 |
| `hotfix/xxx` | 紧急修复分支，从 `main` 拉出 | 修复后同时合入 `main` 和 `dev` |

### 12.3 .gitignore 规则

项目已配置 `.gitignore` 文件，以下文件和目录**不会被提交**到 Git：

| 忽略项 | 说明 |
|--------|------|
| `node_modules/` | 前端依赖目录 |
| `target/` | Maven 编译输出 |
| `*.class` / `*.jar` / `*.war` | Java 编译产物 |
| `dist/` / `dist-ssr/` | 前端构建输出 |
| `logs/` / `*.log` | 日志文件 |
| `.idea/` / `*.iml` | IntelliJ IDEA 配置 |
| `.vscode/` | VS Code 配置 |
| `.env.local` / `*.local` | 本地环境变量 |
| `.DS_Store` / `Thumbs.db` | 操作系统垃圾文件 |
| `mvnw` / `mvnw.cmd` / `.mvn/` | Maven Wrapper（如不使用） |

### 12.4 提交前自检清单

在提交代码前，请确认以下事项：

- [ ] 代码已在本地通过编译（后端 `mvn compile`，前端 `npm run build`）
- [ ] 无控制台报错或 warning
- [ ] 无调试用的 `console.log` / `System.out.println` 残留
- [ ] 敏感信息（数据库密码、密钥等）未硬编码在代码中
- [ ] 新增依赖已在 `pom.xml` 或 `package.json` 中声明
- [ ] 不相关的文件未包含在本次提交中（使用 `git status` 检查）
- [ ] Commit Message 符合约定式提交规范
- [ ] 大文件（>10MB）确认是否需要 Git LFS 管理

### 12.5 常见操作示例

```bash
# 查看当前状态
git status

# 添加指定文件到暂存区
git add backend/src/main/java/com/example/rbac/controller/AuthController.java
git add frontend/src/views/login/index.vue

# 添加整个模块
git add backend/src/main/java/com/example/rbac/service/
git add frontend/src/views/system/

# 提交（遵循约定式提交）
git commit -m "feat(backend): 添加用户登录日志记录功能"

# 推送到远程
git push origin dev

# 拉取最新代码
git pull origin dev

# 查看提交历史
git log --oneline -20
```

### 12.6 禁止提交的内容

以下内容**绝对禁止**提交到 Git 仓库：

- 数据库密码、API 密钥、Token 等敏感凭证
- 编译产物（`target/`、`dist/`、`*.class`、`*.jar`）
- 依赖目录（`node_modules/`）
- IDE 个人配置文件（`.idea/`、`.vscode/` 中的个人设置）
- 日志文件和大体积临时文件
- 用户上传的文件和业务附件

---

**文档版本**：2026-11-03  
**后端版本**：rbac-admin 1.0.0  
**前端版本**：rbac-admin-frontend 1.0.0