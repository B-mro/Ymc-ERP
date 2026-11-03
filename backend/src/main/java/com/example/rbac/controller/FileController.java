package com.example.rbac.controller;

import com.example.rbac.common.PageResult;
import com.example.rbac.common.Result;
import com.example.rbac.entity.SysFile;
import com.example.rbac.security.UserContext;
import com.example.rbac.service.SysFileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@Tag(name = "文件管理")
@RestController
@RequestMapping("/file")
@RequiredArgsConstructor
public class FileController {

    private final SysFileService fileService;

    @Operation(summary = "上传文件")
    @PostMapping("/upload")
    public Result<SysFile> upload(@RequestParam("file") MultipartFile file) {
        Long userId = UserContext.getUserId();
        return Result.ok(fileService.upload(file, userId));
    }

    @Operation(summary = "文件分页列表")
    @GetMapping("/page")
    public Result<PageResult<SysFile>> page(
            @RequestParam(defaultValue = "1") Integer pageNum,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String fileType) {
        return Result.ok(fileService.page(pageNum, pageSize, keyword, fileType));
    }

    @Operation(summary = "文件列表")
    @GetMapping("/list")
    public Result<List<SysFile>> list() {
        return Result.ok(fileService.list());
    }

    @Operation(summary = "文件详情")
    @GetMapping("/{id}")
    public Result<SysFile> get(@PathVariable Long id) {
        return Result.ok(fileService.getById(id));
    }

    @Operation(summary = "编辑文件信息")
    @PutMapping("/update")
    public Result<Void> update(@RequestBody SysFile sysFile) {
        fileService.update(sysFile);
        return Result.ok();
    }

    @Operation(summary = "删除文件")
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        fileService.delete(id);
        return Result.ok();
    }
}