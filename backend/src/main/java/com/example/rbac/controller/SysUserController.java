package com.example.rbac.controller;

import com.example.rbac.common.PageResult;
import com.example.rbac.common.Result;
import com.example.rbac.entity.SysUser;
import com.example.rbac.security.RequiresPermission;
import com.example.rbac.service.SysUserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "用户管理")
@RestController
@RequestMapping("/user")
@RequiredArgsConstructor
public class SysUserController {

    private final SysUserService userService;

    @Operation(summary = "用户分页列表")
    @GetMapping("/page")
    @RequiresPermission("system:user:list")
    public Result<PageResult<SysUser>> page(@RequestParam(required = false) Integer pageNum,
                                            @RequestParam(required = false) Integer pageSize,
                                            @RequestParam(required = false) String username) {
        return Result.ok(userService.page(pageNum, pageSize, username));
    }

    @Operation(summary = "用户详情（含角色 ID）")
    @GetMapping("/{id}")
    @RequiresPermission("system:user:list")
    public Result<SysUser> detail(@PathVariable Long id) {
        return Result.ok(userService.get(id));
    }

    @Operation(summary = "新增用户")
    @PostMapping
    @RequiresPermission("system:user:add")
    public Result<Void> save(@RequestBody SysUser user) {
        userService.save(user);
        return Result.ok();
    }

    @Operation(summary = "修改用户")
    @PutMapping
    @RequiresPermission("system:user:edit")
    public Result<Void> update(@RequestBody SysUser user) {
        userService.update(user);
        return Result.ok();
    }

    @Operation(summary = "批量查询用户（仅返回昵称等元数据，前端全局映射用）")
    @GetMapping("/batch")
    @RequiresPermission("system:user:list")
    public Result<List<SysUser>> batch(@RequestParam Long[] ids) {
        List<SysUser> users = userService.batchGet(List.of(ids));
        users.forEach(u -> u.setPassword(null));
        return Result.ok(users);
    }

    @Operation(summary = "删除用户，多个 ID 逗号分隔")
    @DeleteMapping("/{ids}")
    @RequiresPermission("system:user:remove")
    public Result<Void> delete(@PathVariable Long[] ids) {
        userService.delete(ids);
        return Result.ok();
    }

    @Operation(summary = "为用户分配角色")
    @PutMapping("/assign-roles")
    @RequiresPermission("system:user:assignRole")
    public Result<Void> assignRoles(@RequestBody SysUser body) {
        userService.assignRoles(body.getId(), body.getRoleIds());
        return Result.ok();
    }
}