package com.example.rbac.controller;

import com.example.rbac.common.PageResult;
import com.example.rbac.common.Result;
import com.example.rbac.entity.SysPermission;
import com.example.rbac.security.RequiresPermission;
import com.example.rbac.service.SysPermissionService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "权限管理")
@RestController
@RequestMapping("/permission")
@RequiredArgsConstructor
public class SysPermissionController {

    private final SysPermissionService permissionService;

    @Operation(summary = "权限分页列表")
    @GetMapping("/page")
    @RequiresPermission("system:permission:list")
    public Result<PageResult<SysPermission>> page(@RequestParam(required = false) Integer pageNum,
                                                  @RequestParam(required = false) Integer pageSize,
                                                  @RequestParam(required = false) String permissionName,
                                                  @RequestParam(required = false) String permissionCode) {
        return Result.ok(permissionService.page(pageNum, pageSize, permissionName, permissionCode));
    }

    @Operation(summary = "全部正常权限（穿梭框用）")
    @GetMapping("/list")
    @RequiresPermission("system:permission:list")
    public Result<List<SysPermission>> list() {
        return Result.ok(permissionService.listAll());
    }

    @Operation(summary = "新增权限")
    @PostMapping
    @RequiresPermission("system:permission:add")
    public Result<Void> save(@RequestBody SysPermission permission) {
        permissionService.save(permission);
        return Result.ok();
    }

    @Operation(summary = "修改权限")
    @PutMapping
    @RequiresPermission("system:permission:edit")
    public Result<Void> update(@RequestBody SysPermission permission) {
        permissionService.update(permission);
        return Result.ok();
    }

    @Operation(summary = "删除权限，多个 ID 逗号分隔")
    @DeleteMapping("/{ids}")
    @RequiresPermission("system:permission:remove")
    public Result<Void> delete(@PathVariable Long[] ids) {
        permissionService.delete(ids);
        return Result.ok();
    }
}
