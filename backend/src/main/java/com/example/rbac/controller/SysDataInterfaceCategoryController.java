package com.example.rbac.controller;

import com.example.rbac.common.Result;
import com.example.rbac.entity.SysDataInterfaceCategory;
import com.example.rbac.service.DataInterfaceCategoryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "动态接口-分类管理")
@RestController
@RequestMapping("/dynamic-interface/category")
@RequiredArgsConstructor
public class SysDataInterfaceCategoryController {

    private final DataInterfaceCategoryService categoryService;

    @Operation(summary = "分类树")
    @GetMapping("/tree")
    public Result<List<SysDataInterfaceCategory>> tree() {
        return Result.ok(categoryService.tree());
    }

    @Operation(summary = "新增分类")
    @PostMapping
    public Result<Void> save(@RequestBody SysDataInterfaceCategory category) {
        categoryService.save(category);
        return Result.ok();
    }

    @Operation(summary = "修改分类")
    @PutMapping
    public Result<Void> update(@RequestBody SysDataInterfaceCategory category) {
        categoryService.update(category);
        return Result.ok();
    }

    @Operation(summary = "删除分类")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        categoryService.delete(id);
        return Result.ok();
    }
}