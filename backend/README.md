# Rbac-Admin 后端

基于 Spring Boot 3 + MyBatis-Plus + JWT 的 RBAC 权限管理系统。

## 技术栈

| 分类 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 语言 | Java | 17 | pom.xml 中指定 |
| 框架 | Spring Boot | 3.2.5 | 父工程依赖 |
| ORM | MyBatis-Plus | 3.5.7 | mybatis-plus-spring-boot3-starter |
| 数据库 | MySQL | 8.x | mysql-connector-j (runtime) |
| 认证 | JWT (jjwt) | 0.12.6 | jjwt-api / jjwt-impl / jjwt-jackson |
| 工具库 | Hutool | 5.8.27 | hutool-all（BCrypt 密码加密等） |
| API 文档 | Knife4j | 4.5.0 | knife4j-openapi3-jakarta-spring-boot-starter |
| 代码简化 | Lombok | (继承自 Spring Boot) | 编译时生成 getter/setter 等 |
| 校验 | Spring Boot Starter Validation | (继承自 Spring Boot) | Jakarta Validation 参数校验 |
| 构建工具 | Maven | - | pom.xml 构建 |

## 需要的工具

| 工具 | 版本要求 | 用途 |
|------|----------|------|
| JDK | 17+ | 项目指定 Java 17 |
| Maven | 3.6+ | 依赖管理与构建 |
| MySQL | 8.x | 数据库（SQL 使用 utf8mb4） |
| IDE | IntelliJ IDEA / Eclipse | 开发（需装 Lombok 插件） |

## 项目目录结构

```
backend/
├── pom.xml                           # Maven 依赖配置
├── src/main/
│   ├── java/com/example/rbac/
│   │   ├── RbacApplication.java      # 启动类（含 @MapperScan 扫描 mapper）
│   │   ├── common/                   # 通用模块
│   │   │   ├── Result.java           #   统一响应封装
│   │   │   ├── PageResult.java       #   分页响应封装
│   │   │   ├── BusinessException.java #   业务异常
│   │   │   └── GlobalExceptionHandler.java  # 全局异常处理
│   │   ├── config/                   # 配置类
│   │   │   ├── Knife4jConfig.java    #   Knife4j 文档配置
│   │   │   ├── MybatisPlusConfig.java #  MyBatis-Plus 分页插件
│   │   │   └── WebMvcConfig.java     #   Web 拦截器注册
│   │   ├── controller/               # 控制器层
│   │   │   ├── AuthController.java   #   登录/注册/获取用户信息
│   │   │   ├── SysUserController.java
│   │   │   ├── SysRoleController.java
│   │   │   ├── SysMenuController.java
│   │   │   └── SysPermissionController.java
│   │   ├── dto/                      # 请求数据传输对象
│   │   │   ├── LoginDTO.java
│   │   │   └── RegisterDTO.java
│   │   ├── entity/                   # 数据库实体（7 个表对应）
│   │   ├── mapper/                   # MyBatis-Plus Mapper 接口
│   │   ├── security/                 # 安全模块
│   │   │   ├── JwtUtil.java          #   JWT 生成与解析
│   │   │   ├── JwtInterceptor.java   #   JWT 拦截器
│   │   │   ├── LoginUser.java        #   登录用户信息
│   │   │   ├── RequiresPermission.java #  权限注解
│   │   │   └── UserContext.java      #   用户上下文（ThreadLocal）
│   │   ├── service/                  # 业务层接口与实现
│   │   └── vo/                       # 响应视图对象
│   │       └── UserInfoVO.java
│   └── resources/
│       ├── application.yml           # 主配置文件
│       └── sql/rbac.sql              # 数据库初始化脚本
└── target/                           # Maven 编译输出（自动生成）
```

## 数据库初始化

SQL 脚本位置：`src/main/resources/sql/rbac.sql`

执行脚本（脚本会自动创建数据库、表和初始数据）：

```bash
mysql -u root -p < src/main/resources/sql/rbac.sql
```

数据库连接配置在 `application.yml`：

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/rbac_admin
    username: root
    password: 123456
```

如果你的 MySQL 密码不同，请修改 `application.yml`。

### 默认账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 超级管理员 | admin | admin123 |
| 普通用户 | test | 123456 |

密码均使用 BCrypt 加密存储。

## 启动方式

### 方式一：Maven 命令启动

```bash
cd backend
mvn spring-boot:run
```

### 方式二：打包后运行

```bash
cd backend
mvn clean package -DskipTests
java -jar target/rbac-admin.jar
```

### 方式三：IDE 中运行

直接运行启动类 `com.example.rbac.RbacApplication`

### 启动成功标志

控制台输出：

```
====================================================
  Rbac-Admin 后端启动成功
  接口文档: http://localhost:8080/api/doc.html
====================================================
```

服务端口：**8080**，context-path：**/api**

## API 文档

| 地址 | 说明 |
|------|------|
| http://localhost:8080/api/doc.html | Knife4j UI（可交互调试） |
| http://localhost:8080/api/v3/api-docs | OpenAPI 原始 JSON |

## 核心功能

- **认证模块**：登录（BCrypt 校验密码）、注册、获取当前用户信息、退出登录
- **JWT 无状态认证**：HS256 签名，默认有效期 24 小时
- **RBAC 权限模型**：用户 → 角色 → 菜单/权限（多对多，3 张关联表）
- **菜单类型**：M（目录）/ C（菜单）/ F（按钮），支持动态菜单路由
- **权限注解**：自定义 `@RequiresPermission` 做接口级权限控制
- **分页查询**：MyBatis-Plus 分页插件（MySQL 类型）
- **统一响应**：`Result<T>` 包装 + `GlobalExceptionHandler` 全局异常处理

## 数据库表结构

```
sys_user          N —— N   sys_role          (sys_user_role)
sys_role          N —— N   sys_menu           (sys_role_menu)
sys_role          N —— N   sys_permission     (sys_role_permission)
```

共 7 张表：用户表、角色表、菜单表、权限表 + 3 张关联表。

## 注意事项

1. **MySQL 密码**：`application.yml` 默认 `root/123456`，请根据实际环境修改
2. **JWT 密钥**：生产环境必须更换 secret（至少 32 字节），当前为占位密钥
3. **Lombok**：IDE 需要安装 Lombok 插件并启用注解处理，否则编译报错
4. **SQL 兼容**：SQL 脚本使用 `CREATE DATABASE IF NOT EXISTS` 和 `utf8mb4`，要求 MySQL 8.x