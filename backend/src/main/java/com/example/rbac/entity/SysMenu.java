package com.example.rbac.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 菜单 / 目录 / 按钮
 * menuType：M 目录  C 菜单  F 按钮
 */
@Data
@TableName("sys_menu")
public class SysMenu implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 父菜单 ID，顶级为 0 */
    private Long parentId;

    /** 菜单名称 */
    private String menuName;

    /** 类型：M 目录 C 菜单 F 按钮 */
    private String menuType;

    /** 路由地址 */
    private String path;

    /** 前端组件路径（相对 src/views），目录固定 Layout */
    private String component;

    /** 权限标识，如 system:user:list */
    private String perms;

    /** Element Plus 图标组件名 */
    private String icon;

    /** 显示排序 */
    private Integer orderNum;

    /** 是否可见：0 显示 1 隐藏 */
    private String visible;

    /** 状态：0 正常 1 停用 */
    private String status;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;

    /** 子菜单（非数据库字段） */
    @TableField(exist = false)
    private List<SysMenu> children;
}
