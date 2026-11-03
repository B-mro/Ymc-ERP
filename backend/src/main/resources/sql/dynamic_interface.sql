-- =====================================================================
-- 动态接口配置（SQL 可配置化）- 增量脚本
-- 【注意】本脚本不会 DROP 已有表，仅在表不存在时创建
-- 用途：把后端硬编码的 SQL 提炼为可配置接口，前端新增页面即可管理
-- =====================================================================

-- ---------------------------------------------------------------------
-- 接口分类（树形结构）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys_data_interface_category (
    id          BIGINT      NOT NULL AUTO_INCREMENT COMMENT '分类ID',
    parent_id   BIGINT      NOT NULL DEFAULT 0 COMMENT '父分类ID(0为顶级)',
    name        VARCHAR(64) NOT NULL COMMENT '分类名称',
    order_num   INT                  DEFAULT 0 COMMENT '排序',
    status      CHAR(1)              DEFAULT '0' COMMENT '状态: 0 正常 1 停用',
    create_time DATETIME             DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME             DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT ='动态接口分类';

-- ---------------------------------------------------------------------
-- 接口配置（核心表，存 SQL）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys_data_interface (
    id              BIGINT       NOT NULL AUTO_INCREMENT COMMENT '接口ID',
    name            VARCHAR(128) NOT NULL COMMENT '接口名称',
    path            VARCHAR(256) NOT NULL COMMENT '请求路径(如 /user/detail)',
    method          VARCHAR(16)  NOT NULL COMMENT '请求方式: GET/POST/PUT/DELETE',
    category_id     BIGINT                DEFAULT NULL COMMENT '所属分类',
    description     VARCHAR(512)          DEFAULT '' COMMENT '接口描述',
    sql_content     TEXT         NOT NULL COMMENT 'SQL 内容, #{paramName} 占位, ${paramName} 动态片段',
    result_type     VARCHAR(16)           DEFAULT 'LIST' COMMENT '返回类型: SINGLE/LIST/PAGE',
    status          CHAR(1)               DEFAULT '0' COMMENT '状态: 0 正常 1 停用',
    create_time     DATETIME              DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time     DATETIME              DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_path_method (path, method)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT ='动态接口配置';

-- ---------------------------------------------------------------------
-- 接口参数配置（一个接口对应多个参数）
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sys_data_interface_param (
    id              BIGINT       NOT NULL AUTO_INCREMENT COMMENT '参数ID',
    interface_id    BIGINT       NOT NULL COMMENT '所属接口',
    param_name      VARCHAR(128) NOT NULL COMMENT '参数名(同时是SQL占位符名)',
    field_name      VARCHAR(128)          DEFAULT '' COMMENT '对应的数据库字段名',
    type            VARCHAR(16)           DEFAULT 'String' COMMENT '参数类型: String/Number/Boolean/Date',
    position        VARCHAR(16)           DEFAULT 'query' COMMENT '参数位置: query/path/body/header',
    required        TINYINT(1)            DEFAULT 0 COMMENT '是否必填',
    default_value   VARCHAR(256)          DEFAULT NULL COMMENT '默认值',
    description     VARCHAR(256)          DEFAULT '' COMMENT '参数说明',
    sort_order      INT                   DEFAULT 0 COMMENT '排序',
    PRIMARY KEY (id),
    KEY idx_interface (interface_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT ='动态接口参数配置';

-- ---------------------------------------------------------------------
-- 示例数据 (使用 INSERT IGNORE 避免重复导入时报错)
-- ---------------------------------------------------------------------
INSERT IGNORE INTO sys_data_interface_category (id, parent_id, name, order_num) VALUES
(1, 0, '用户中心', 1),
(2, 1, '用户管理', 1),
(3, 1, '角色管理', 2),
(4, 0, '系统管理', 2),
(5, 4, '基础数据', 1);

INSERT IGNORE INTO sys_data_interface (id, name, path, method, category_id, sql_content, result_type, description) VALUES
(1, '用户分页列表', '/user/page', 'GET', 2,
 'SELECT id, username, nickname, email, phone, status, create_time FROM sys_user WHERE 1=1 AND (#{username} IS NULL OR username LIKE CONCAT(''%'', #{username}, ''%'')) ORDER BY create_time DESC',
 'PAGE', '用户分页查询,支持用户名模糊搜索'),
(2, '用户详情', '/user/detail', 'GET', 2,
 'SELECT id, username, nickname, email, phone, status, create_time FROM sys_user WHERE id = #{userId}',
 'SINGLE', '根据ID查询单个用户'),
(3, '角色列表', '/role/list', 'GET', 3,
 'SELECT id, role_name, role_code, status, remark, create_time FROM sys_role WHERE status = 0',
 'LIST', '查询所有启用的角色'),
(4, '系统统计', '/system/stats', 'GET', 5,
 'SELECT (SELECT COUNT(*) FROM sys_user) AS userCount, (SELECT COUNT(*) FROM sys_role) AS roleCount, (SELECT COUNT(*) FROM sys_menu) AS menuCount',
 'SINGLE', '系统基础数据统计');

INSERT IGNORE INTO sys_data_interface_param (interface_id, param_name, field_name, type, position, required, default_value, description, sort_order) VALUES
(1, 'pageNum', '', 'Number', 'query', 0, '1', '页码', 1),
(1, 'pageSize', '', 'Number', 'query', 0, '10', '每页条数', 2),
(1, 'username', 'username', 'String', 'query', 0, NULL, '用户名(模糊搜索)', 3),
(2, 'userId', 'id', 'Number', 'query', 1, NULL, '用户ID', 1);