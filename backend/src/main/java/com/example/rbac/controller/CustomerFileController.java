package com.example.rbac.controller;

import com.example.rbac.common.Result;
import com.example.rbac.service.CustomerFileService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@Tag(name = "客户文件上传")
@RestController
@RequestMapping("/customer-file")
@RequiredArgsConstructor
public class CustomerFileController {

    private final CustomerFileService customerFileService;

    @Operation(summary = "上传单个文件")
    @PostMapping("/upload")
    public Result<Map<String, Object>> upload(@RequestParam("file") MultipartFile file) {
        return Result.ok(customerFileService.upload(file));
    }

    @Operation(summary = "批量上传文件")
    @PostMapping("/upload-batch")
    public Result<List<Map<String, Object>>> uploadBatch(@RequestParam("files") MultipartFile[] files) {
        return Result.ok(customerFileService.uploadBatch(files));
    }
}