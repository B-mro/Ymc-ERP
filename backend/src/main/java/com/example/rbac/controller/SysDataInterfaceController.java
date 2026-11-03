package com.example.rbac.controller;

import com.example.rbac.common.PageResult;
import com.example.rbac.common.Result;
import com.example.rbac.entity.SysDataInterface;
import com.example.rbac.service.DataInterfaceService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@Slf4j
@Tag(name = "动态接口-配置管理")
@RestController
@RequestMapping("/dynamic-interface")
@RequiredArgsConstructor
public class SysDataInterfaceController {

    private final DataInterfaceService apiService;
    private final ObjectMapper objectMapper;

    private static final String BASE64_FIELD = "_b64";

    private Object decodeBody(Map<String, Object> body) {
        if (body == null) return null;
        if (body.containsKey(BASE64_FIELD)) {
            Object b64Val = body.get(BASE64_FIELD);
            if (b64Val != null) {
                try {
                    String json = new String(Base64.getDecoder().decode(b64Val.toString()), StandardCharsets.UTF_8);
                    return objectMapper.readValue(json, new TypeReference<>() {});
                } catch (Exception e) {
                    log.warn("[dynamic-interface] base64 decode failed, fallback to raw body: {}", e.getMessage());
                }
            }
        }
        return body;
    }

    @Operation(summary = "接口分页列表")
    @GetMapping("/page")
    public Result<PageResult<SysDataInterface>> page(@RequestParam(required = false) Integer pageNum,
                                                    @RequestParam(required = false) Integer pageSize,
                                                    @RequestParam(required = false) String name,
                                                    @RequestParam(required = false) String method,
                                                    @RequestParam(required = false) Long categoryId) {
        return Result.ok(apiService.page(pageNum, pageSize, name, method, categoryId));
    }

    @Operation(summary = "接口详情(含参数)")
    @GetMapping("/{id}")
    public Result<SysDataInterface> detail(@PathVariable Long id) {
        return Result.ok(apiService.detail(id));
    }

    @Operation(summary = "新增接口")
    @PostMapping
    public Result<Void> save(@RequestBody Map<String, Object> body) {
        Object decoded = decodeBody(body);
        SysDataInterface api = objectMapper.convertValue(decoded, SysDataInterface.class);
        apiService.save(api);
        return Result.ok();
    }

    @Operation(summary = "修改接口")
    @PutMapping
    public Result<Void> update(@RequestBody Map<String, Object> body) {
        Object decoded = decodeBody(body);
        SysDataInterface api = objectMapper.convertValue(decoded, SysDataInterface.class);
        apiService.update(api);
        return Result.ok();
    }

    @Operation(summary = "删除接口")
    @DeleteMapping("/{ids}")
    public Result<Void> delete(@PathVariable Long[] ids) {
        apiService.delete(ids);
        return Result.ok();
    }

    @Operation(summary = "获取当前数据库所有表")
    @GetMapping("/meta/tables")
    public Result<List<Map<String, Object>>> listTables() {
        return Result.ok(apiService.listTables());
    }

    @Operation(summary = "获取指定表的字段列表")
    @GetMapping("/meta/table/{tableName}")
    public Result<List<Map<String, Object>>> listTableColumns(@PathVariable String tableName) {
        return Result.ok(apiService.listTableColumns(tableName));
    }
}