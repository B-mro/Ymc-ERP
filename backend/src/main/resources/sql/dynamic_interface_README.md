# 动态接口管理 · 使用方法

## 一、功能概述

动态接口管理是一个**SQL 配置化接口引擎**：你不需要写 Controller/Service/Mapper，只要在界面上填一个 SQL，就能立刻对外暴露一个 REST API。

```
传统方式: Controller → Service → Mapper → SQL  (每层都要写代码)
动态方式: 前端界面填 SQL → 数据库存储 → 后端自动执行 → 返回结果
```

对外统一入口：`/dapi/**`

---

## 二、三步新增接口

### Step 1 · 基本信息

| 字段 | 说明 | 示例 |
|---|---|---|
| 接口名称 | 人类可读的名字 | 用户分页查询 |
| 请求路径 | 以 `/` 开头的相对路径 | `/user/page` |
| 请求方式 | GET / POST / PUT / DELETE | GET |
| 返回类型 | SINGLE(单条) / LIST(列表) / PAGE(分页) | PAGE |
| 所属分类 | 分类树，用于在左侧导航分组 | 用户管理 |
| 描述 | 接口用途说明 | 按用户名搜索用户 |

⚠️ **注意**：路径实际调用地址是 **`/dapi` + 你填的路径**。
比如填 `/user/page`，前端实际请求 `GET /dapi/user/page`。

### Step 2 · SQL 语句 + 参数配置

#### SQL 占位符语法

| 语法 | 用途 | 示例 |
|---|---|---|
| `#{paramName}` | 普通参数（预编译，防 SQL 注入） | `WHERE id = #{userId}` |
| `${paramName}` | 动态片段（直接替换，用于表名/排序/动态 WHERE） | `ORDER BY ${sortField}` |

#### 常用模板（界面内「📋 用户列表模板」按钮一键填充）

```sql
-- 用户列表（模糊搜索 + 状态筛选）
SELECT id, username, nickname, email, status, create_time
FROM sys_user
WHERE 1=1
  AND (#{username} IS NULL OR username LIKE CONCAT('%', #{username}, '%'))
  AND (#{status} IS NULL OR status = #{status})
ORDER BY create_time DESC
```

#### 参数配置

| 字段 | 说明 |
|---|---|
| 参数名 | SQL 里用 `#{参数名}` 引用 |
| 字段名 | 对应数据库字段（可选，用于文档） |
| 类型 | String / Number / Boolean / Date |
| 位置 | query(URL参数) / path(路径参数) / body(请求体) / header |
| 必填 | 是否必填，默认 false |
| 默认值 | 不传参时自动使用的值 |
| 描述 | 参数说明 |

💡 界面会自动检测 SQL 中的 `#{xxx}` 占位符，与参数列表对照。

### Step 3 · 调用预览 + 保存

1. 左侧点「▶ 发送请求」，输入测试值
2. 右侧查看 HTTP 状态码、耗时、响应 JSON
3. 确认无误后，点「提交接口」保存
4. 保存后立即可通过 `/dapi/**` 路径对外调用

---

## 三、三种返回类型详解

### SINGLE（单条记录）
返回 `Map<String, Object>`，适合查询单条详情。
```sql
SELECT id, username, email FROM sys_user WHERE id = #{userId}
```

### LIST（列表）
返回 `List<Map<String, Object>>`，适合不分页的列表。
```sql
SELECT id, role_name FROM sys_role WHERE status = 0
```

### PAGE（分页列表）
自动在 SQL 末尾追加 `LIMIT offset, pageSize`，同时返回 `total` 总数。
```sql
-- 你只需要写不带 LIMIT 的查询
SELECT id, username, status FROM sys_user WHERE status = #{status}
-- 后端自动加上: LIMIT 0, 10
-- 同时执行 COUNT(*) 计算总数
```

PAGE 类型自动注入两个参数：
- `pageNum`：页码，默认 1
- `pageSize`：每页条数，默认 10

---

## 四、安全机制

后端内置三层安全检查：

1. **白名单前缀校验**：只允许 `SELECT` / `INSERT` / `UPDATE` / `DELETE` 开头的 SQL
2. **危险关键字过滤**：拦截 `DROP` / `ALTER` / `GRANT` / `REVOKE` / `TRUNCATE` / `SLEEP` / `BENCHMARK` 等
3. **#{ 预编译**：所有参数值通过 `#{}` 传入时使用 JDBC PreparedStatement，天然防 SQL 注入

⚠️ `${}` 动态片段**不走预编译**，仅用于表名、排序字段这类不能用 `?` 占位的场景。请确保传入值来自受控代码，不要直接透传用户输入。

---

## 五、完整示例：新增一个「客户发票查询」接口

### 1. 基本信息
- 接口名称：客户发票查询
- 请求路径：`/finance/invoice`
- 请求方式：GET
- 返回类型：PAGE
- 所属分类：财务中心 / 客户发票
- 描述：按客户名称/发票号查询发票列表

### 2. SQL 语句
```sql
SELECT i.id, i.invoice_no, i.customer_name, i.amount, i.status, i.create_time
FROM sys_invoice i
WHERE 1=1
  AND (#{keyword} IS NULL OR i.invoice_no LIKE CONCAT('%', #{keyword}, '%')
       OR i.customer_name LIKE CONCAT('%', #{keyword}, '%'))
  AND (#{status} IS NULL OR i.status = #{status})
ORDER BY i.create_time DESC
```

### 3. 参数配置

| 参数名 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| keyword | String | 否 | — | 发票号或客户名模糊搜索 |
| status | Number | 否 | — | 发票状态 |

### 4. 调用预览
```
GET /dapi/finance/invoice?keyword=张三&pageNum=1&pageSize=10
```

返回：
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "total": 23,
    "list": [
      { "id": 1, "invoice_no": "INV-2024-001", "customer_name": "张三", "amount": 1200.00, "status": 1, "create_time": "2024-01-15 10:22:33" },
      ...
    ]
  }
}
```

### 5. 前端对接
前端直接调用 `/dapi/finance/invoice` 即可，不需要写任何后端代码。

---

## 六、数据库表结构

三张表全部在 `backend/src/main/resources/sql/dynamic_interface.sql`：

| 表 | 用途 |
|---|---|
| `sys_data_interface_category` | 分类树（支持多级） |
| `sys_data_interface` | 接口配置（SQL 存在这里） |
| `sys_data_interface_param` | 参数定义（外键关联接口） |

`dynamic_interface.sql` 使用 `CREATE TABLE IF NOT EXISTS` + `INSERT IGNORE`，可以安全重复导入，不会覆盖原有数据。

---

## 七、常见问题

**Q: 路径可以重复吗？**
A: 同一 `path + method` 组合不能重复（唯一索引）。

**Q: 一个 SQL 可以写多条语句吗？**
A: 不支持。只允许单条 SQL（安全考虑）。

**Q: ${} 和 #{} 有什么区别？**
A: `#{}` 是预编译参数，`${}` 是字符串直接拼接。**能用 `#{}` 就用 `#{}`**。

**Q: 分页查询必须自己写 LIMIT 吗？**
A: 不用。返回类型选 PAGE 后，后端自动追加 LIMIT 和 COUNT 查询。

**Q: 新增的接口需要重启后端才能生效吗？**
A: 不需要。后端每请求都实时查表配置，保存后立即生效。