package com.example.rbac.controller;

import com.example.rbac.common.Result;
import com.example.rbac.dto.UpsFuelSurchargeRate;
import com.example.rbac.dto.UpsFuelSurchargeResponse;
import com.example.rbac.service.UpsRyfService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.List;

@Slf4j
@Tag(name = "UPS附加费查询")
@RestController
@RequestMapping("/ups")
@RequiredArgsConstructor
public class UpsSurchargeController {

    private final UpsRyfService upsRyfService;

    private static final String UPS_SURCHARGE_URL =
            "https://assets.ups.com/adobe/assets/urn:aaid:aem:f4fc31f7-6059-4bb0-bb22-b1bb1b02211b/original/as/us.json";

    @Operation(summary = "获取UPS Ground燃油附加费历史(ShipGrid格式)")
    @GetMapping("/surcharge/history")
    public Result<UpsFuelSurchargeResponse> getFuelSurchargeHistory() {
        try {
            OffsetDateTime fetchedAt = OffsetDateTime.now();

            List<UpsFuelSurchargeRate> rates = upsRyfService.queryAllRates();

            UpsFuelSurchargeResponse response = new UpsFuelSurchargeResponse();
            response.setSource(UPS_SURCHARGE_URL);
            response.setFetchedAt(fetchedAt.toString());
            response.setRates(rates);

            log.info("查询UPS燃油附加费历史数据，共{}条记录", rates.size());
            return Result.ok(response);
        } catch (Exception e) {
            log.error("获取UPS燃油附加费历史数据失败", e);
            return Result.fail("获取UPS燃油附加费历史数据失败: " + e.getMessage());
        }
    }

    @Operation(summary = "获取UPS Ground燃油附加费历史(实时抓取)")
    @GetMapping("/surcharge/raw")
    public Result<List<UpsFuelSurchargeRate>> getGroundSurchargeRates() {
        try {
            List<UpsFuelSurchargeRate> rates = upsRyfService.fetchSurchargeRates();
            return Result.ok(rates);
        } catch (Exception e) {
            log.error("获取UPS附加费历史失败", e);
            return Result.fail("获取UPS附加费历史失败: " + e.getMessage());
        }
    }

    @Operation(summary = "查询数据库中UPS附加费记录")
    @GetMapping("/surcharge/list")
    public Result<List<UpsFuelSurchargeRate>> listFromDb() {
        try {
            List<UpsFuelSurchargeRate> rates = upsRyfService.queryAllRates();
            return Result.ok(rates);
        } catch (Exception e) {
            log.error("查询UPS附加费失败", e);
            return Result.fail("查询UPS附加费失败: " + e.getMessage());
        }
    }

    @Operation(summary = "同步UPS附加费到ups_ryf表(去重)")
    @GetMapping("/surcharge/sync")
    public Result<Integer> syncSurchargeToDb() {
        try {
            int count = upsRyfService.syncRates();
            return Result.ok(count);
        } catch (Exception e) {
            log.error("同步UPS附加费失败", e);
            return Result.fail("同步失败: " + e.getMessage());
        }
    }
}