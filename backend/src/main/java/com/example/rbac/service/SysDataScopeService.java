package com.example.rbac.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.example.rbac.common.PageResult;
import com.example.rbac.entity.SysDataScope;
import com.example.rbac.entity.SysRoleDataScope;
import com.example.rbac.mapper.SysDataScopeMapper;
import com.example.rbac.mapper.SysRoleDataScopeMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SysDataScopeService {

    private final SysDataScopeMapper scopeMapper;
    private final SysRoleDataScopeMapper roleScopeMapper;

    public List<SysDataScope> list(String tableName, String perms) {
        LambdaQueryWrapper<SysDataScope> w = new LambdaQueryWrapper<>();
        w.eq(StringUtils.hasText(tableName), SysDataScope::getTableName, tableName)
         .eq(StringUtils.hasText(perms), SysDataScope::getPerms, perms)
         .orderByAsc(SysDataScope::getPerms)
         .orderByAsc(SysDataScope::getTableName)
         .orderByAsc(SysDataScope::getScopeType);
        return scopeMapper.selectList(w);
    }

    public PageResult<SysDataScope> page(Integer pageNum, Integer pageSize, String tableName, String perms) {
        Page<SysDataScope> page = new Page<>(pageNum == null ? 1 : pageNum, pageSize == null ? 10 : pageSize);
        LambdaQueryWrapper<SysDataScope> w = new LambdaQueryWrapper<>();
        w.like(StringUtils.hasText(tableName), SysDataScope::getTableName, tableName)
         .eq(StringUtils.hasText(perms), SysDataScope::getPerms, perms)
         .orderByDesc(SysDataScope::getCreateTime);
        Page<SysDataScope> result = scopeMapper.selectPage(page, w);
        return new PageResult<>(result.getTotal(), result.getRecords());
    }

    public SysDataScope detail(Long id) {
        return scopeMapper.selectById(id);
    }

    @Transactional
    public void save(SysDataScope scope) {
        scopeMapper.insert(scope);
    }

    @Transactional
    public Long saveAndBind(SysDataScope scope, Set<Long> roleIds) {
        scopeMapper.insert(scope);
        if (roleIds != null && !roleIds.isEmpty()) {
            bindRoles(scope.getId(), roleIds);
        }
        return scope.getId();
    }

    @Transactional
    public void update(SysDataScope scope) {
        scopeMapper.updateById(scope);
    }

    @Transactional
    public void updateAndBind(SysDataScope scope, Set<Long> roleIds) {
        scopeMapper.updateById(scope);
        if (roleIds != null) {
            bindRoles(scope.getId(), roleIds);
        }
    }

    @Transactional
    public void delete(Long id) {
        scopeMapper.deleteById(id);
        LambdaQueryWrapper<SysRoleDataScope> w = new LambdaQueryWrapper<>();
        w.eq(SysRoleDataScope::getScopeId, id);
        roleScopeMapper.delete(w);
    }

    @Transactional
    public void bindRoles(Long scopeId, Set<Long> roleIds) {
        LambdaQueryWrapper<SysRoleDataScope> w = new LambdaQueryWrapper<>();
        w.eq(SysRoleDataScope::getScopeId, scopeId);
        roleScopeMapper.delete(w);
        if (roleIds != null && !roleIds.isEmpty()) {
            for (Long roleId : roleIds) {
                SysRoleDataScope rs = new SysRoleDataScope();
                rs.setScopeId(scopeId);
                rs.setRoleId(roleId);
                roleScopeMapper.insert(rs);
            }
        }
    }

    public Set<Long> getBoundRoleIds(Long scopeId) {
        LambdaQueryWrapper<SysRoleDataScope> w = new LambdaQueryWrapper<>();
        w.eq(SysRoleDataScope::getScopeId, scopeId);
        return roleScopeMapper.selectList(w).stream()
                .map(SysRoleDataScope::getRoleId)
                .collect(Collectors.toSet());
    }
}