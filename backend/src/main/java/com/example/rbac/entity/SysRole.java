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
 * 角色
 */
@Data
@TableName("sys_role")
public class SysRole implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 角色名称 */
    private String roleName;

    /** 角色编码，如 admin / user */
    private String roleCode;

    /** 状态：0 正常 1 停用 */
    private String status;

    private String remark;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;

    /** 关联菜单 ID 集合（非数据库字段，用于角色分配菜单） */
    @TableField(exist = false)
    private List<Long> menuIds;

    /** 关联权限 ID 集合（非数据库字段，用于角色分配权限） */
    @TableField(exist = false)
    private List<Long> permissionIds;
}
