package com.example.rbac.service;

import cn.hutool.crypto.digest.BCrypt;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.example.rbac.common.BusinessException;
import com.example.rbac.common.PageResult;
import com.example.rbac.entity.SysUser;
import com.example.rbac.entity.SysUserRole;
import com.example.rbac.mapper.SysUserMapper;
import com.example.rbac.mapper.SysUserRoleMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SysUserService {

    private final SysUserMapper userMapper;
    private final SysUserRoleMapper userRoleMapper;

    /**
     * 分页查询（附带角色 ID）
     */
    public PageResult<SysUser> page(Integer pageNum, Integer pageSize, String username) {
        Page<SysUser> page = new Page<>(pageNum == null ? 1 : pageNum, pageSize == null ? 10 : pageSize);
        LambdaQueryWrapper<SysUser> wrapper = new LambdaQueryWrapper<>();
        wrapper.like(StringUtils.hasText(username), SysUser::getUsername, username)
                .orderByDesc(SysUser::getCreateTime);
        Page<SysUser> result = userMapper.selectPage(page, wrapper);
        result.getRecords().forEach(this::fillRoleIds);
        return new PageResult<>(result.getTotal(), result.getRecords());
    }

    public SysUser get(Long id) {
        SysUser user = userMapper.selectById(id);
        if (user == null) {
            throw new BusinessException("用户不存在");
        }
        user.setPassword(null);
        fillRoleIds(user);
        return user;
    }

    private void fillRoleIds(SysUser user) {
        user.setPassword(null);
        user.setRoleIds(userRoleMapper.selectRoleIds(user.getId()));
    }

    /**
     * 新增用户：密码 BCrypt 加密存储 + 绑定角色
     */
    @Transactional(rollbackFor = Exception.class)
    public void save(SysUser user) {
        if (!StringUtils.hasText(user.getUsername())) {
            throw new BusinessException("用户名不能为空");
        }
        if (userMapper.selectByUsername(user.getUsername()) != null) {
            throw new BusinessException("用户名已存在");
        }
        if (!StringUtils.hasText(user.getPassword())) {
            throw new BusinessException("初始密码不能为空");
        }
        user.setId(null);
        user.setPassword(BCrypt.hashpw(user.getPassword()));
        if (!StringUtils.hasText(user.getStatus())) {
            user.setStatus("0");
        }
        userMapper.insert(user);
        saveUserRoles(user.getId(), user.getRoleIds());
    }

    /**
     * 修改用户；密码为空则保持原密码不变
     */
    @Transactional(rollbackFor = Exception.class)
    public void update(SysUser user) {
        if (user.getId() == null) {
            throw new BusinessException("用户 ID 不能为空");
        }
        SysUser dbUser = userMapper.selectById(user.getId());
        if (dbUser == null) {
            throw new BusinessException("用户不存在");
        }

        LambdaUpdateWrapper<SysUser> wrapper = new LambdaUpdateWrapper<>();
        wrapper.eq(SysUser::getId, user.getId());

        if (StringUtils.hasText(user.getNickname())) {
            wrapper.set(SysUser::getNickname, user.getNickname());
        }
        if (StringUtils.hasText(user.getEmail())) {
            wrapper.set(SysUser::getEmail, user.getEmail());
        }
        if (StringUtils.hasText(user.getPhone())) {
            wrapper.set(SysUser::getPhone, user.getPhone());
        }
        if (StringUtils.hasText(user.getStatus())) {
            wrapper.set(SysUser::getStatus, user.getStatus());
        }
        if (StringUtils.hasText(user.getPassword())) {
            wrapper.set(SysUser::getPassword, BCrypt.hashpw(user.getPassword()));
        }

        if (wrapper.getSqlSet() != null && !wrapper.getSqlSet().isEmpty()) {
            userMapper.update(null, wrapper);
        }

        if (user.getRoleIds() != null) {
            userRoleMapper.deleteByUserId(user.getId());
            saveUserRoles(user.getId(), user.getRoleIds());
        }
    }

    private void saveUserRoles(Long userId, List<Long> roleIds) {
        if (CollectionUtils.isEmpty(roleIds)) {
            return;
        }
        for (Long roleId : roleIds.stream().distinct().collect(Collectors.toList())) {
            SysUserRole ur = new SysUserRole();
            ur.setUserId(userId);
            ur.setRoleId(roleId);
            userRoleMapper.insert(ur);
        }
    }

    /**
     * 单独分配角色
     */
    @Transactional(rollbackFor = Exception.class)
    public void assignRoles(Long userId, List<Long> roleIds) {
        if (userMapper.selectById(userId) == null) {
            throw new BusinessException("用户不存在");
        }
        userRoleMapper.deleteByUserId(userId);
        saveUserRoles(userId, roleIds);
    }

    /**
     * 批量查询用户（仅返回 id/nickname/username，轻量）
     */
    public List<SysUser> batchGet(List<Long> ids) {
        if (CollectionUtils.isEmpty(ids)) {
            return List.of();
        }
        return userMapper.selectBatchIds(ids);
    }

    /**
     * 删除用户（同时清理用户-角色关联）
     */
    @Transactional(rollbackFor = Exception.class)
    public void delete(Long[] ids) {
        List<Long> idList = Arrays.asList(ids);
        userRoleMapper.deleteByUserIds(idList);
        userMapper.deleteByIds(idList);
    }
}