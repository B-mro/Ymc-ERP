package com.example.rbac.controller;

import com.example.rbac.common.PageResult;
import com.example.rbac.common.Result;
import com.example.rbac.entity.SysRole;
import com.example.rbac.security.RequiresPermission;
import com.example.rbac.service.SysRoleService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "角色管理")
@RestController
@RequestMapping("/role")
@RequiredArgsConstructor
public class SysRoleController {

    private final SysRoleService roleService;

    @Operation(summary = "全部正常角色（下拉框用）")
    @GetMapping("/list")
    public Result<List<SysRole>> list() {
        return Result.ok(roleService.listAll());
    }

    @Operation(summary = "角色分页列表")
    @GetMapping("/page")
    @RequiresPermission("system:role:list")
    public Result<PageResult<SysRole>> page(@RequestParam(required = false) Integer pageNum,
                                            @RequestParam(required = false) Integer pageSize,
                                            @RequestParam(required = false) String roleName) {
        return Result.ok(roleService.page(pageNum, pageSize, roleName));
    }

    @Operation(summary = "角色详情（含菜单 ID / 权限 ID）")
    @GetMapping("/{id}")
    @RequiresPermission("system:role:list")
    public Result<SysRole> detail(@PathVariable Long id) {
        return Result.ok(roleService.detail(id));
    }

    @Operation(summary = "新增角色")
    @PostMapping
    @RequiresPermission("system:role:add")
    public Result<Void> save(@RequestBody SysRole role) {
        roleService.save(role);
        return Result.ok();
    }

    @Operation(summary = "修改角色")
    @PutMapping
    @RequiresPermission("system:role:edit")
    public Result<Void> update(@RequestBody SysRole role) {
        roleService.update(role);
        return Result.ok();
    }

    @Operation(summary = "删除角色，多个 ID 逗号分隔")
    @DeleteMapping("/{ids}")
    @RequiresPermission("system:role:remove")
    public Result<Void> delete(@PathVariable Long[] ids) {
        roleService.delete(ids);
        return Result.ok();
    }

    @Operation(summary = "为角色分配菜单")
    @PutMapping("/assign-menus")
    @RequiresPermission("system:role:assignMenu")
    public Result<Void> assignMenus(@RequestBody SysRole body) {
        roleService.assignMenus(body.getId(), body.getMenuIds());
        return Result.ok();
    }

    @Operation(summary = "为角色分配权限")
    @PutMapping("/assign-permissions")
    @RequiresPermission("system:role:assignPermission")
    public Result<Void> assignPermissions(@RequestBody SysRole body) {
        roleService.assignPermissions(body.getId(), body.getPermissionIds());
        return Result.ok();
    }
}
