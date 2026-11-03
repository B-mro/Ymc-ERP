package com.example.rbac.controller;

import com.example.rbac.common.PageResult;
import com.example.rbac.common.Result;
import com.example.rbac.entity.SysDataScope;
import com.example.rbac.entity.SysMenu;
import com.example.rbac.mapper.SysMenuMapper;
import com.example.rbac.service.SysDataScopeService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@Tag(name = "数据权限规则")
@RestController
@RequestMapping("/data-scope")
@RequiredArgsConstructor
public class SysDataScopeController {

    private final SysDataScopeService scopeService;
    private final SysMenuMapper menuMapper;
    private final ObjectMapper objectMapper;

    @Operation(summary = "菜单权限标识下拉选项")
    @GetMapping("/menu-perms")
    public Result<List<Map<String, String>>> menuPerms() {
        List<SysMenu> menus = menuMapper.selectList(null);
        List<Map<String, String>> options = menus.stream()
                .filter(m -> "C".equals(m.getMenuType()))
                .filter(m -> m.getPerms() != null && !m.getPerms().isEmpty())
                .map(m -> {
                    Map<String, String> opt = new LinkedHashMap<>();
                    opt.put("perms", m.getPerms());
                    opt.put("menuName", m.getMenuName());
                    opt.put("menuType", m.getMenuType());
                    return opt;
                })
                .collect(Collectors.toList());
        return Result.ok(options);
    }

    @Operation(summary = "列表查询")
    @PostMapping("/list")
    public Result<List<SysDataScope>> list(@RequestBody(required = false) Map<String, Object> params) {
        String tableName = params == null ? null : (String) params.get("tableName");
        String perms = params == null ? null : (String) params.get("perms");
        return Result.ok(scopeService.list(tableName, perms));
    }

    @Operation(summary = "分页查询")
    @PostMapping("/page")
    public Result<PageResult<SysDataScope>> page(@RequestBody(required = false) Map<String, Object> params) {
        int pageNum = params == null || params.get("pageNum") == null ? 1 : (int) params.get("pageNum");
        int pageSize = params == null || params.get("pageSize") == null ? 10 : (int) params.get("pageSize");
        String tableName = params == null ? null : (String) params.get("tableName");
        String perms = params == null ? null : (String) params.get("perms");
        return Result.ok(scopeService.page(pageNum, pageSize, tableName, perms));
    }

    @Operation(summary = "详情")
    @PostMapping("/detail")
    public Result<SysDataScope> detail(@RequestBody Map<String, Object> params) {
        Long id = Long.valueOf(params.get("id").toString());
        return Result.ok(scopeService.detail(id));
    }

    @Operation(summary = "新增")
    @PostMapping("/save")
    public Result<Long> save(@RequestBody Map<String, Object> params) {
        SysDataScope scope = objectMapper.convertValue(
                params.get("scope"), SysDataScope.class);
        Set<Long> roleIds = parseRoleIds(params.get("roleIds"));
        Long id = scopeService.saveAndBind(scope, roleIds);
        return Result.ok(id);
    }

    @Operation(summary = "修改")
    @PostMapping("/update")
    public Result<Void> update(@RequestBody Map<String, Object> params) {
        SysDataScope scope = objectMapper.convertValue(
                params.get("scope"), SysDataScope.class);
        Set<Long> roleIds = parseRoleIds(params.get("roleIds"));
        scopeService.updateAndBind(scope, roleIds);
        return Result.ok();
    }

    private Set<Long> parseRoleIds(Object raw) {
        if (raw == null) return null;
        List<Integer> ids = objectMapper.convertValue(raw,
                new TypeReference<List<Integer>>() {});
        if (ids == null || ids.isEmpty()) return null;
        return ids.stream().map(Long::valueOf).collect(Collectors.toSet());
    }

    @Operation(summary = "删除")
    @PostMapping("/delete")
    public Result<Void> delete(@RequestBody Map<String, Object> params) {
        Long id = Long.valueOf(params.get("id").toString());
        scopeService.delete(id);
        return Result.ok();
    }

    @Operation(summary = "为规则绑定角色")
    @PostMapping("/bindRoles")
    public Result<Void> bindRoles(@RequestBody Map<String, Object> params) {
        Long scopeId = Long.valueOf(params.get("scopeId").toString());
        @SuppressWarnings("unchecked")
        List<Integer> ids = (List<Integer>) params.get("roleIds");
        Set<Long> roleIds = ids == null ? Set.of() : ids.stream().map(Long::valueOf).collect(Collectors.toSet());
        scopeService.bindRoles(scopeId, roleIds);
        return Result.ok();
    }

    @Operation(summary = "查询规则已绑定的角色ID")
    @PostMapping("/boundRoles")
    public Result<Set<Long>> boundRoles(@RequestBody Map<String, Object> params) {
        Long scopeId = Long.valueOf(params.get("scopeId").toString());
        return Result.ok(scopeService.getBoundRoleIds(scopeId));
    }
}