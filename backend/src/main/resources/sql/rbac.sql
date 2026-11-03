-- =====================================================================
-- RBAC 权限管理系统 数据库初始化脚本 (MySQL 8.x)
-- 表关系：
--   sys_user N -- N sys_role        (sys_user_role)
--   sys_role N -- N sys_menu        (sys_role_menu)
--   sys_role N -- N sys_permission  (sys_role_permission)
-- 默认账号：
--   超级管理员  admin / admin123
--   普通用户    test  / 123456
-- 密码均为 BCrypt 密文存储
-- =====================================================================

CREATE DATABASE IF NOT EXISTS rbac_admin DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE rbac_admin;

-- ---------------------------------------------------------------------
-- 用户表
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS sys_user;
CREATE TABLE sys_user (
    id          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '用户ID',
    username    VARCHAR(64)  NOT NULL COMMENT '登录账号',
    password    VARCHAR(128) NOT NULL COMMENT 'BCrypt 密文密码',
    nickname    VARCHAR(64)           DEFAULT '' COMMENT '昵称',
    email       VARCHAR(128)          DEFAULT '' COMMENT '邮箱',
    phone       VARCHAR(20)           DEFAULT '' COMMENT '手机号',
    status      CHAR(1)               DEFAULT '0' COMMENT '状态：0 正常 1 停用',
    create_time DATETIME              DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME              DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_username (username)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT ='用户表';

-- ---------------------------------------------------------------------
-- 角色表
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS sys_role;
CREATE TABLE sys_role (
    id          BIGINT      NOT NULL AUTO_INCREMENT COMMENT '角色ID',
    role_name   VARCHAR(64) NOT NULL COMMENT '角色名称',
    role_code   VARCHAR(64) NOT NULL COMMENT '角色编码',
    status      CHAR(1)              DEFAULT '0' COMMENT '状态：0 正常 1 停用',
    remark      VARCHAR(255)         DEFAULT '' COMMENT '备注',
    create_time DATETIME             DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME             DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_role_code (role_code)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT ='角色表';

-- ---------------------------------------------------------------------
-- 菜单表（M 目录 / C 菜单 / F 按钮）
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS sys_menu;
CREATE TABLE sys_menu (
    id          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '菜单ID',
    parent_id   BIGINT       NOT NULL DEFAULT 0 COMMENT '父菜单ID(0为顶级)',
    menu_name   VARCHAR(64)  NOT NULL COMMENT '菜单名称',
    menu_type   CHAR(1)      NOT NULL COMMENT '类型：M 目录 C 菜单 F 按钮',
    path        VARCHAR(128)          DEFAULT '' COMMENT '路由地址',
    component   VARCHAR(128)          DEFAULT '' COMMENT '前端组件(目录为Layout)',
    perms       VARCHAR(128)          DEFAULT '' COMMENT '权限标识',
    icon        VARCHAR(64)           DEFAULT '' COMMENT '图标',
    order_num   INT                   DEFAULT 0 COMMENT '显示排序',
    visible     CHAR(1)               DEFAULT '0' COMMENT '是否可见：0 显示 1 隐藏',
    status      CHAR(1)               DEFAULT '0' COMMENT '状态：0 正常 1 停用',
    create_time DATETIME              DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time DATETIME              DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT ='菜单表';

-- ---------------------------------------------------------------------
-- 权限表
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS sys_permission;
CREATE TABLE sys_permission (
    id              BIGINT       NOT NULL AUTO_INCREMENT COMMENT '权限ID',
    permission_name VARCHAR(64)  NOT NULL COMMENT '权限名称',
    permission_code VARCHAR(128) NOT NULL COMMENT '权限标识',
    permission_type VARCHAR(16)           DEFAULT 'button' COMMENT '类型：menu/button/api',
    status          CHAR(1)               DEFAULT '0' COMMENT '状态：0 正常 1 停用',
    remark          VARCHAR(255)          DEFAULT '' COMMENT '备注',
    create_time     DATETIME              DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    update_time     DATETIME              DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (id),
    UNIQUE KEY uk_permission_code (permission_code)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT ='权限表';

-- ---------------------------------------------------------------------
-- 用户-角色 关联表
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS sys_user_role;
CREATE TABLE sys_user_role (
    id      BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    user_id BIGINT NOT NULL COMMENT '用户ID',
    role_id BIGINT NOT NULL COMMENT '角色ID',
    PRIMARY KEY (id),
    UNIQUE KEY uk_user_role (user_id, role_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT ='用户-角色关联表';

-- ---------------------------------------------------------------------
-- 角色-菜单 关联表
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS sys_role_menu;
CREATE TABLE sys_role_menu (
    id      BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    role_id BIGINT NOT NULL COMMENT '角色ID',
    menu_id BIGINT NOT NULL COMMENT '菜单ID',
    PRIMARY KEY (id),
    UNIQUE KEY uk_role_menu (role_id, menu_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT ='角色-菜单关联表';

-- ---------------------------------------------------------------------
-- 角色-权限 关联表
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS sys_role_permission;
CREATE TABLE sys_role_permission (
    id            BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
    role_id       BIGINT NOT NULL COMMENT '角色ID',
    permission_id BIGINT NOT NULL COMMENT '权限ID',
    PRIMARY KEY (id),
    UNIQUE KEY uk_role_permission (role_id, permission_id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COMMENT ='角色-权限关联表';

-- =====================================================================
-- 初始化数据
-- =====================================================================

-- 用户（admin/admin123, test/123456，BCrypt 密文）
INSERT INTO sys_user (id, username, password, nickname, email, phone, status) VALUES
(1, 'admin', '$2a$10$scFQrGWCtg6xHeztzjKEl.M.ICo6MR1TrT0sLOESLjKh.eLJY/kdq', '超级管理员', 'admin@example.com', '13800000000', '0'),
(2, 'test',  '$2a$10$xWY7CrrWYfTiLSsHjGM7C.XzpufVd34UZ3lMUrs2XSufQGVdIM5tS', '普通用户',   'test@example.com',  '13800000001', '0');

-- 角色
INSERT INTO sys_role (id, role_name, role_code, status, remark) VALUES
(1, '超级管理员', 'admin', '0', '拥有系统全部权限'),
(2, '普通用户',   'user',  '0', '注册用户默认角色');

-- 菜单：1 系统管理目录；2~5 四个菜单；6~21 按钮权限
INSERT INTO sys_menu (id, parent_id, menu_name, menu_type, path, component, perms, icon, order_num, visible, status) VALUES
(1,  0, '系统管理', 'M', '/system',     'Layout',                 '',                          'Setting',   1, '0', '0'),
(2,  1, '用户管理', 'C', 'user',        'system/user/index',      'system:user:list',          'User',      1, '0', '0'),
(3,  1, '角色管理', 'C', 'role',        'system/role/index',      'system:role:list',          'UserFilled', 2, '0', '0'),
(4,  1, '菜单管理', 'C', 'menu',        'system/menu/index',      'system:menu:list',          'Menu',      3, '0', '0'),
(5,  1, '权限管理', 'C', 'permission',  'system/permission/index','system:permission:list',    'Key',       4, '0', '0'),
-- 用户管理按钮
(6,  2, '用户新增',   'F', '', '', 'system:user:add',        '', 1, '0', '0'),
(7,  2, '用户修改',   'F', '', '', 'system:user:edit',       '', 2, '0', '0'),
(8,  2, '用户删除',   'F', '', '', 'system:user:remove',     '', 3, '0', '0'),
(9,  2, '重置密码',   'F', '', '', 'system:user:resetPwd',   '', 4, '0', '0'),
(10, 2, '分配角色',   'F', '', '', 'system:user:assignRole', '', 5, '0', '0'),
-- 角色管理按钮
(11, 3, '角色新增',         'F', '', '', 'system:role:add',              '', 1, '0', '0'),
(12, 3, '角色修改',         'F', '', '', 'system:role:edit',             '', 2, '0', '0'),
(13, 3, '角色删除',         'F', '', '', 'system:role:remove',           '', 3, '0', '0'),
(14, 3, '角色分配菜单',     'F', '', '', 'system:role:assignMenu',       '', 4, '0', '0'),
(15, 3, '角色分配权限',     'F', '', '', 'system:role:assignPermission', '', 5, '0', '0'),
-- 菜单管理按钮
(16, 4, '菜单新增', 'F', '', '', 'system:menu:add',    '', 1, '0', '0'),
(17, 4, '菜单修改', 'F', '', '', 'system:menu:edit',   '', 2, '0', '0'),
(18, 4, '菜单删除', 'F', '', '', 'system:menu:remove', '', 3, '0', '0'),
-- 权限管理按钮
(19, 5, '权限新增', 'F', '', '', 'system:permission:add',    '', 1, '0', '0'),
(20, 5, '权限修改', 'F', '', '', 'system:permission:edit',   '', 2, '0', '0'),
(21, 5, '权限删除', 'F', '', '', 'system:permission:remove', '', 3, '0', '0');

-- 权限（与菜单 perms 标识一致，独立注册表，可单独绑定角色）
INSERT INTO sys_permission (id, permission_name, permission_code, permission_type, status, remark) VALUES
(1,  '用户查询', 'system:user:list',            'menu',   '0', '用户管理菜单'),
(2,  '用户新增', 'system:user:add',             'button', '0', ''),
(3,  '用户修改', 'system:user:edit',            'button', '0', ''),
(4,  '用户删除', 'system:user:remove',          'button', '0', ''),
(5,  '重置密码', 'system:user:resetPwd',        'button', '0', ''),
(6,  '分配角色', 'system:user:assignRole',      'button', '0', ''),
(7,  '角色查询', 'system:role:list',            'menu',   '0', '角色管理菜单'),
(8,  '角色新增', 'system:role:add',             'button', '0', ''),
(9,  '角色修改', 'system:role:edit',            'button', '0', ''),
(10, '角色删除', 'system:role:remove',          'button', '0', ''),
(11, '分配菜单', 'system:role:assignMenu',      'button', '0', ''),
(12, '分配权限', 'system:role:assignPermission','button', '0', ''),
(13, '菜单查询', 'system:menu:list',            'menu',   '0', '菜单管理菜单'),
(14, '菜单新增', 'system:menu:add',             'button', '0', ''),
(15, '菜单修改', 'system:menu:edit',            'button', '0', ''),
(16, '菜单删除', 'system:menu:remove',          'button', '0', ''),
(17, '权限查询', 'system:permission:list',      'menu',   '0', '权限管理菜单'),
(18, '权限新增', 'system:permission:add',       'button', '0', ''),
(19, '权限修改', 'system:permission:edit',      'button', '0', ''),
(20, '权限删除', 'system:permission:remove',    'button', '0', '');

-- 用户-角色：admin -> 超级管理员；test -> 普通用户
INSERT INTO sys_user_role (user_id, role_id) VALUES (1, 1), (2, 2);

-- 角色-菜单：超级管理员拥有全部菜单（目录/菜单/按钮）
INSERT INTO sys_role_menu (role_id, menu_id)
SELECT 1, id FROM sys_menu;

-- 角色-权限：超级管理员拥有全部权限
INSERT INTO sys_role_permission (role_id, permission_id)
SELECT 1, id FROM sys_permission;