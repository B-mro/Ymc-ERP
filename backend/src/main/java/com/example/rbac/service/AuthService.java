package com.example.rbac.service;

import cn.hutool.crypto.digest.BCrypt;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.example.rbac.common.BusinessException;
import com.example.rbac.dto.LoginDTO;
import com.example.rbac.dto.RegisterDTO;
import com.example.rbac.entity.*;
import com.example.rbac.mapper.*;
import com.example.rbac.security.JwtUtil;
import com.example.rbac.security.LoginUser;
import com.example.rbac.security.UserContext;
import com.example.rbac.security.UserPermissionCache;
import com.example.rbac.vo.UserInfoVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final SysUserMapper userMapper;
    private final SysMenuMapper menuMapper;
    private final SysUserRoleMapper userRoleMapper;
    private final SysMenuService menuService;
    private final JwtUtil jwtUtil;
    private final UserPermissionCache permissionCache;

    /**
     * 登录，校验 BCrypt 密文
     */
    public String login(LoginDTO dto) {
        SysUser user = userMapper.selectByUsername(dto.getUsername());
        if (user == null) {
            throw new BusinessException("用户名或密码错误");
        }
        if ("1".equals(user.getStatus())) {
            throw new BusinessException("账号已被停用，请联系管理员");
        }
        if (!BCrypt.checkpw(dto.getPassword(), user.getPassword())) {
            throw new BusinessException("用户名或密码错误");
        }
        permissionCache.evict(user.getId());
        return jwtUtil.createToken(user.getId(), user.getUsername());
    }

    /**
     * 注册：密码以 BCrypt 密文存储，默认绑定普通用户角色
     */
    @Transactional(rollbackFor = Exception.class)
    public void register(RegisterDTO dto) {
        if (userMapper.selectByUsername(dto.getUsername()) != null) {
            throw new BusinessException("用户名已存在");
        }
        SysUser user = new SysUser();
        user.setUsername(dto.getUsername());
        user.setPassword(BCrypt.hashpw(dto.getPassword()));
        user.setNickname(StringUtils.hasText(dto.getNickname()) ? dto.getNickname() : dto.getUsername());
        user.setStatus("0");
        userMapper.insert(user);

        SysUserRole userRole = new SysUserRole();
        userRole.setUserId(user.getId());
        userRole.setRoleId(4L);
        userRoleMapper.insert(userRole);
    }

    /**
     * 获取当前登录用户信息：用户、角色、权限标识、动态菜单树
     */
    public UserInfoVO getInfo(Long userId) {
        SysUser user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(401, "用户不存在");
        }
        user.setPassword(null);

        LoginUser cached = UserContext.get();
        List<String> roleCodes;
        Set<String> permissions;
        if (cached != null) {
            roleCodes = new ArrayList<>(cached.getRoles());
            permissions = cached.getPermissions();
        } else {
            LoginUser fresh = permissionCache.getOrLoad(userId);
            roleCodes = new ArrayList<>(fresh.getRoles());
            permissions = fresh.getPermissions();
        }

        List<SysMenu> userMenus = menuMapper.selectByUserId(userId);
        List<SysMenu> routeMenus = userMenus.stream()
                .filter(m -> ("M".equals(m.getMenuType()) || "C".equals(m.getMenuType()))
                        && "0".equals(m.getVisible()))
                .collect(Collectors.toList());
        List<SysMenu> menuTree = menuService.buildTree(routeMenus);

        UserInfoVO vo = new UserInfoVO();
        vo.setUser(user);
        vo.setRoles(roleCodes);
        vo.setPermissions(permissions);
        vo.setMenus(menuTree);
        return vo;
    }
}