package com.example.rbac.controller;

import com.example.rbac.common.Result;
import com.example.rbac.entity.SysDictItem;
import com.example.rbac.service.SysDictItemService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Tag(name = "字典项管理")
@RestController
@RequestMapping("/sys-dict-item")
@RequiredArgsConstructor
public class SysDictItemController {

    private final SysDictItemService sysDictItemService;

    @Operation(summary = "根据 dictCode 查询启用的字典项（返回 id, dictCode, label, value）")
    @PostMapping("/listByCode")
    public Result<List<Map<String, Object>>> listByCode(@RequestBody Map<String, String> params) {
        String dictCode = params.get("dictCode");
        List<SysDictItem> items = sysDictItemService.listByDictCode(dictCode);
        List<Map<String, Object>> result = items.stream().map(item -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", item.getId());
            m.put("dictCode", item.getDictCode());
            m.put("label", item.getLabel());
            m.put("value", item.getValue());
            return m;
        }).collect(Collectors.toList());
        return Result.ok(result);
    }
}