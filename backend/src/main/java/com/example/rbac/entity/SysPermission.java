package com.example.rbac.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 权限（独立权限标识注册表，可绑定到角色）
 */
@Data
@TableName("sys_permission")
public class SysPermission implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 权限名称 */
    private String permissionName;

    /** 权限标识，如 system:user:add */
    private String permissionCode;

    /** 权限类型：menu 菜单 / button 按钮 / api 接口 */
    private String permissionType;

    /** 状态：0 正常 1 停用 */
    private String status;

    private String remark;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
