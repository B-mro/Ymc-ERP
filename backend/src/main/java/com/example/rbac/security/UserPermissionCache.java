package com.example.rbac.security;

import com.example.rbac.entity.SysMenu;
import com.example.rbac.entity.SysPermission;
import com.example.rbac.entity.SysRole;
import com.example.rbac.mapper.SysMenuMapper;
import com.example.rbac.mapper.SysPermissionMapper;
import com.example.rbac.mapper.SysRoleMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class UserPermissionCache {

    private final SysRoleMapper roleMapper;
    private final SysMenuMapper menuMapper;
    private final SysPermissionMapper permissionMapper;

    private static final long TTL_MS = 30 * 60 * 1000L;

    private final ConcurrentHashMap<Long, CacheEntry> cache = new ConcurrentHashMap<>();

    public LoginUser get(Long userId) {
        CacheEntry entry = cache.get(userId);
        if (entry != null && !entry.isExpired()) {
            return entry.loginUser;
        }
        return null;
    }

    public LoginUser loadAndCache(Long userId) {
        List<SysRole> roles = roleMapper.selectByUserId(userId);
        Set<String> roleCodes = roles.stream().map(SysRole::getRoleCode).collect(Collectors.toSet());
        boolean isAdmin = roleCodes.contains("admin");

        Set<String> permissions = new HashSet<>();
        for (SysMenu menu : menuMapper.selectByUserId(userId)) {
            if (StringUtils.hasText(menu.getPerms())) {
                permissions.add(menu.getPerms());
            }
        }
        for (SysPermission permission : permissionMapper.selectByUserId(userId)) {
            if (StringUtils.hasText(permission.getPermissionCode())) {
                permissions.add(permission.getPermissionCode());
            }
        }

        LoginUser loginUser = new LoginUser(userId, null, roleCodes, permissions, isAdmin);
        cache.put(userId, new CacheEntry(loginUser, System.currentTimeMillis() + TTL_MS));
        return loginUser;
    }

    public LoginUser getOrLoad(Long userId) {
        LoginUser cached = get(userId);
        if (cached != null) {
            return cached;
        }
        return loadAndCache(userId);
    }

    public void evict(Long userId) {
        cache.remove(userId);
    }

    @Scheduled(fixedRate = 10 * 60 * 1000L)
    public void cleanExpired() {
        long now = System.currentTimeMillis();
        cache.entrySet().removeIf(e -> e.getValue().expireAt < now);
        log.debug("[UserPermissionCache] cleanExpired done, size={}", cache.size());
    }

    public int size() {
        return cache.size();
    }

    private static class CacheEntry {
        final LoginUser loginUser;
        final long expireAt;

        CacheEntry(LoginUser loginUser, long expireAt) {
            this.loginUser = loginUser;
            this.expireAt = expireAt;
        }

        boolean isExpired() {
            return System.currentTimeMillis() > expireAt;
        }
    }
}