package com.example.rbac.vo;

import com.example.rbac.entity.SysMenu;
import com.example.rbac.entity.SysUser;
import lombok.Data;

import java.util.List;
import java.util.Set;

/**
 * 登录后返回的当前用户信息（角色、权限、动态菜单）
 */
@Data
public class UserInfoVO {

    private SysUser user;

    /** 角色编码集合 */
    private List<String> roles;

    /** 权限标识集合（菜单 perms + 权限表 code，覆盖菜单与按钮） */
    private Set<String> permissions;

    /** 动态菜单树（仅目录 M / 菜单 C） */
    private List<SysMenu> menus;
}
