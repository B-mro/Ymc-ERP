package com.example.rbac.controller;

import com.example.rbac.common.PageResult;
import com.example.rbac.common.Result;
import com.example.rbac.entity.ClaimsCenter;
import com.example.rbac.service.ClaimsCenterService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@Tag(name = "Claims Center 管理")
@RestController
@RequestMapping("/claims-center")
@RequiredArgsConstructor
public class ClaimsCenterController {

    private final ClaimsCenterService claimsCenterService;

    @Operation(summary = "列表查询（不分页）")
    @PostMapping("/list")
    public Result<List<ClaimsCenter>> list(@RequestBody(required = false) ClaimsCenter query) {
        return Result.ok(claimsCenterService.list(query == null ? new ClaimsCenter() : query));
    }

    @Operation(summary = "分页查询")
    @PostMapping("/page")
    public Result<PageResult<ClaimsCenter>> page(@RequestBody Map<String, Object> params) {
        ClaimsCenter query = new ClaimsCenter();
        if (params.get("logisticsNo") != null) query.setLogisticsNo((String) params.get("logisticsNo"));
        if (params.get("claimsType") != null) query.setClaimsType((String) params.get("claimsType"));
        if (params.get("type") != null) query.setType((String) params.get("type"));
        if (params.get("customerName") != null) query.setCustomerName((String) params.get("customerName"));
        if (params.get("customerNo") != null) query.setCustomerNo((String) params.get("customerNo"));
        if (params.get("issueType") != null) query.setIssueType((String) params.get("issueType"));
        if (params.get("serviceType") != null) query.setServiceType((String) params.get("serviceType"));
        Integer pageNum = params.get("pageNum") == null ? null : ((Number) params.get("pageNum")).intValue();
        Integer pageSize = params.get("pageSize") == null ? null : ((Number) params.get("pageSize")).intValue();
        return Result.ok(claimsCenterService.page(query, pageNum, pageSize));
    }

    @Operation(summary = "详情")
    @PostMapping("/detail")
    public Result<ClaimsCenter> detail(@RequestBody Map<String, Integer> params) {
        Integer id = params.get("id");
        if (id == null) {
            return Result.fail("id 不能为空");
        }
        return Result.ok(claimsCenterService.detail(id));
    }

    @Operation(summary = "新增")
    @PostMapping("/save")
    public Result<Void> save(@RequestBody ClaimsCenter claims) {
        claimsCenterService.save(claims);
        return Result.ok();
    }

    @Operation(summary = "修改")
    @PostMapping("/update")
    public Result<Void> update(@RequestBody ClaimsCenter claims) {
        claimsCenterService.update(claims);
        return Result.ok();
    }

    @Operation(summary = "删除，多个 ID 以数组形式传入")
    @PostMapping("/delete")
    public Result<Void> delete(@RequestBody Integer[] ids) {
        claimsCenterService.delete(ids);
        return Result.ok();
    }
}