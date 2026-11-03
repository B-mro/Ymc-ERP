package com.example.rbac.controller;

import com.example.rbac.common.Result;
import com.example.rbac.entity.SysMenu;
import com.example.rbac.security.RequiresPermission;
import com.example.rbac.service.SysMenuService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "菜单管理")
@RestController
@RequestMapping("/menu")
@RequiredArgsConstructor
public class SysMenuController {

    private final SysMenuService menuService;

    @Operation(summary = "菜单列表（扁平）")
    @GetMapping("/list")
    @RequiresPermission("system:menu:list")
    public Result<List<SysMenu>> list(@RequestParam(required = false) String menuName) {
        return Result.ok(menuService.list(menuName));
    }

    @Operation(summary = "菜单树")
    @GetMapping("/tree")
    @RequiresPermission("system:menu:list")
    public Result<List<SysMenu>> tree(@RequestParam(required = false) String menuName) {
        return Result.ok(menuService.tree(menuName));
    }

    @Operation(summary = "新增菜单")
    @PostMapping
    @RequiresPermission("system:menu:add")
    public Result<Void> save(@RequestBody SysMenu menu) {
        menuService.save(menu);
        return Result.ok();
    }

    @Operation(summary = "修改菜单")
    @PutMapping
    @RequiresPermission("system:menu:edit")
    public Result<Void> update(@RequestBody SysMenu menu) {
        menuService.update(menu);
        return Result.ok();
    }

    @Operation(summary = "删除菜单")
    @DeleteMapping("/{id}")
    @RequiresPermission("system:menu:remove")
    public Result<Void> delete(@PathVariable Long id) {
        menuService.delete(id);
        return Result.ok();
    }
}
