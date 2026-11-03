package com.example.rbac.security;

/**
 * 基于 ThreadLocal 的当前登录用户 + 请求上下文持有器
 */
public class UserContext {

    private static final ThreadLocal<LoginUser> USER_HOLDER = new ThreadLocal<>();
    private static final ThreadLocal<String> PERMS_HOLDER = new ThreadLocal<>();

    private UserContext() {
    }

    public static void set(LoginUser loginUser) {
        USER_HOLDER.set(loginUser);
    }

    public static LoginUser get() {
        return USER_HOLDER.get();
    }

    public static Long getUserId() {
        LoginUser user = USER_HOLDER.get();
        return user == null ? null : user.getUserId();
    }

    public static void setCurrentPerms(String perms) {
        PERMS_HOLDER.set(perms);
    }

    public static String getCurrentPerms() {
        return PERMS_HOLDER.get();
    }

    public static void clear() {
        USER_HOLDER.remove();
        PERMS_HOLDER.remove();
    }
}