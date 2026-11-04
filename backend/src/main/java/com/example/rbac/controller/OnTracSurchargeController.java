package com.example.rbac.controller;

import com.example.rbac.common.Result;
import com.example.rbac.dto.OnTracFuelSurchargeRate;
import com.example.rbac.dto.OnTracFuelSurchargeResponse;
import com.example.rbac.service.OnTracRyfService;
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
@Tag(name = "OnTrac附加费查询")
@RestController
@RequestMapping("/ontrac")
@RequiredArgsConstructor
public class OnTracSurchargeController {

    private final OnTracRyfService onTracRyfService;

    private static final String ONTRAC_SURCHARGE_URL =
            "https://www.ontrac.com/surchargesandrates/";

    private static final String SERIES = "National U.S. Average";

    @Operation(summary = "获取OnTrac燃油附加费历史(ShipGrid格式)")
    @GetMapping("/surcharge/history")
    public Result<OnTracFuelSurchargeResponse> getFuelSurchargeHistory() {
        try {
            OffsetDateTime fetchedAt = OffsetDateTime.now();

            List<OnTracFuelSurchargeRate> rates = onTracRyfService.queryAllRates();

            OnTracFuelSurchargeResponse response = new OnTracFuelSurchargeResponse();
            response.setSource(ONTRAC_SURCHARGE_URL);
            response.setSeries(SERIES);
            response.setFetchedAt(fetchedAt.toString());
            response.setRates(rates);

            log.info("查询OnTrac燃油附加费历史数据，共{}条记录", rates.size());
            return Result.ok(response);
        } catch (Exception e) {
            log.error("获取OnTrac燃油附加费历史数据失败", e);
            return Result.fail("获取OnTrac燃油附加费历史数据失败: " + e.getMessage());
        }
    }

    @Operation(summary = "同步OnTrac燃油附加费数据到ontrac_ryf表")
    @GetMapping("/surcharge/sync")
    public Result<Integer> syncSurchargeToDb() {
        try {
            int count = onTracRyfService.syncSurchargeData();
            return Result.ok(count);
        } catch (Exception e) {
            log.error("同步OnTrac燃油附加费数据失败", e);
            return Result.fail("同步失败: " + e.getMessage());
        }
    }
}