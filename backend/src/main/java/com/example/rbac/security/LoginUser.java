package com.example.rbac.security;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Set;

/**
 * 当前登录用户上下文信息
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoginUser {

    private Long userId;
    private String username;
    /** 角色编码集合 */
    private Set<String> roles;
    /** 权限标识集合 */
    private Set<String> permissions;
    /** 超级管理员放行所有权限 */
    private boolean admin;
}
