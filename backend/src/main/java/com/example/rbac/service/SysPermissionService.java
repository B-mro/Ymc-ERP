package com.example.rbac.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.example.rbac.common.BusinessException;
import com.example.rbac.common.PageResult;
import com.example.rbac.entity.SysPermission;
import com.example.rbac.mapper.SysPermissionMapper;
import com.example.rbac.mapper.SysRolePermissionMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.List;

@Service
@RequiredArgsConstructor
public class SysPermissionService {

    private final SysPermissionMapper permissionMapper;
    private final SysRolePermissionMapper rolePermissionMapper;

    public PageResult<SysPermission> page(Integer pageNum, Integer pageSize,
                                          String permissionName, String permissionCode) {
        Page<SysPermission> page = new Page<>(pageNum == null ? 1 : pageNum, pageSize == null ? 10 : pageSize);
        LambdaQueryWrapper<SysPermission> wrapper = new LambdaQueryWrapper<>();
        wrapper.like(StringUtils.hasText(permissionName), SysPermission::getPermissionName, permissionName)
                .like(StringUtils.hasText(permissionCode), SysPermission::getPermissionCode, permissionCode)
                .orderByAsc(SysPermission::getId);
        Page<SysPermission> result = permissionMapper.selectPage(page, wrapper);
        return new PageResult<>(result.getTotal(), result.getRecords());
    }

    /**
     * 全部正常权限（角色分配权限穿梭框用）
     */
    public List<SysPermission> listAll() {
        return permissionMapper.selectList(new LambdaQueryWrapper<SysPermission>()
                .eq(SysPermission::getStatus, "0")
                .orderByAsc(SysPermission::getId));
    }

    @Transactional(rollbackFor = Exception.class)
    public void save(SysPermission permission) {
        checkCode(permission.getPermissionCode(), null);
        permission.setId(null);
        if (!StringUtils.hasText(permission.getStatus())) {
            permission.setStatus("0");
        }
        if (!StringUtils.hasText(permission.getPermissionType())) {
            permission.setPermissionType("button");
        }
        permissionMapper.insert(permission);
    }

    @Transactional(rollbackFor = Exception.class)
    public void update(SysPermission permission) {
        if (permission.getId() == null) {
            throw new BusinessException("权限 ID 不能为空");
        }
        if (StringUtils.hasText(permission.getPermissionCode())) {
            checkCode(permission.getPermissionCode(), permission.getId());
        }
        permissionMapper.updateById(permission);
    }

    private void checkCode(String code, Long excludeId) {
        if (!StringUtils.hasText(code)) {
            throw new BusinessException("权限标识不能为空");
        }
        Long id = excludeId == null ? 0L : excludeId;
        if (permissionMapper.countByCode(code, id) > 0) {
            throw new BusinessException("权限标识已存在：" + code);
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long[] ids) {
        for (Long id : ids) {
            rolePermissionMapper.deleteByPermissionId(id);
        }
        permissionMapper.deleteByIds(Arrays.asList(ids));
    }
}
