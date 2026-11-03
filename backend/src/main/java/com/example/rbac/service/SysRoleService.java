package com.example.rbac.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.example.rbac.common.BusinessException;
import com.example.rbac.common.PageResult;
import com.example.rbac.entity.SysRole;
import com.example.rbac.entity.SysRoleMenu;
import com.example.rbac.entity.SysRolePermission;
import com.example.rbac.mapper.SysRoleMapper;
import com.example.rbac.mapper.SysRoleMenuMapper;
import com.example.rbac.mapper.SysRolePermissionMapper;
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
public class SysRoleService {

    private final SysRoleMapper roleMapper;
    private final SysRoleMenuMapper roleMenuMapper;
    private final SysRolePermissionMapper rolePermissionMapper;
    private final SysUserRoleMapper userRoleMapper;

    /**
     * 全部正常角色（下拉选择用）
     */
    public List<SysRole> listAll() {
        return roleMapper.selectList(new LambdaQueryWrapper<SysRole>()
                .eq(SysRole::getStatus, "0")
                .orderByAsc(SysRole::getId));
    }

    public PageResult<SysRole> page(Integer pageNum, Integer pageSize, String roleName) {
        Page<SysRole> page = new Page<>(pageNum == null ? 1 : pageNum, pageSize == null ? 10 : pageSize);
        LambdaQueryWrapper<SysRole> wrapper = new LambdaQueryWrapper<>();
        wrapper.like(StringUtils.hasText(roleName), SysRole::getRoleName, roleName)
                .orderByDesc(SysRole::getCreateTime);
        Page<SysRole> result = roleMapper.selectPage(page, wrapper);
        return new PageResult<>(result.getTotal(), result.getRecords());
    }

    /**
     * 角色详情（含已关联菜单 ID、权限 ID）
     */
    public SysRole detail(Long id) {
        SysRole role = roleMapper.selectById(id);
        if (role == null) {
            throw new BusinessException("角色不存在");
        }
        role.setMenuIds(roleMenuMapper.selectMenuIdsByRoleId(id));
        role.setPermissionIds(rolePermissionMapper.selectPermissionIdsByRoleId(id));
        return role;
    }

    @Transactional(rollbackFor = Exception.class)
    public void save(SysRole role) {
        checkCode(role.getRoleCode(), null);
        role.setId(null);
        if (!StringUtils.hasText(role.getStatus())) {
            role.setStatus("0");
        }
        roleMapper.insert(role);
    }

    @Transactional(rollbackFor = Exception.class)
    public void update(SysRole role) {
        if (role.getId() == null) {
            throw new BusinessException("角色 ID 不能为空");
        }
        if (StringUtils.hasText(role.getRoleCode())) {
            checkCode(role.getRoleCode(), role.getId());
        }
        roleMapper.updateById(role);
    }

    private void checkCode(String code, Long excludeId) {
        if (!StringUtils.hasText(code)) {
            throw new BusinessException("角色编码不能为空");
        }
        Long id = excludeId == null ? 0L : excludeId;
        if (roleMapper.countByCode(code, id) > 0) {
            throw new BusinessException("角色编码已存在：" + code);
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long[] ids) {
        List<Long> idList = Arrays.asList(ids);
        for (Long id : idList) {
            roleMenuMapper.deleteByRoleId(id);
            rolePermissionMapper.deleteByRoleId(id);
            userRoleMapper.deleteByRoleId(id);
        }
        roleMapper.deleteByIds(idList);
    }

    /**
     * 为角色分配菜单
     */
    @Transactional(rollbackFor = Exception.class)
    public void assignMenus(Long roleId, List<Long> menuIds) {
        if (roleMapper.selectById(roleId) == null) {
            throw new BusinessException("角色不存在");
        }
        roleMenuMapper.deleteByRoleId(roleId);
        if (!CollectionUtils.isEmpty(menuIds)) {
            for (Long menuId : menuIds.stream().distinct().collect(Collectors.toList())) {
                SysRoleMenu rm = new SysRoleMenu();
                rm.setRoleId(roleId);
                rm.setMenuId(menuId);
                roleMenuMapper.insert(rm);
            }
        }
    }

    /**
     * 为角色分配权限
     */
    @Transactional(rollbackFor = Exception.class)
    public void assignPermissions(Long roleId, List<Long> permissionIds) {
        if (roleMapper.selectById(roleId) == null) {
            throw new BusinessException("角色不存在");
        }
        rolePermissionMapper.deleteByRoleId(roleId);
        if (!CollectionUtils.isEmpty(permissionIds)) {
            for (Long permissionId : permissionIds.stream().distinct().collect(Collectors.toList())) {
                SysRolePermission rp = new SysRolePermission();
                rp.setRoleId(roleId);
                rp.setPermissionId(permissionId);
                rolePermissionMapper.insert(rp);
            }
        }
    }
}
