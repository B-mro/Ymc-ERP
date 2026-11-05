package com.example.rbac.controller;

import com.example.rbac.common.Result;
import com.example.rbac.dto.OnTracFuelSurchargeRate;
import com.example.rbac.dto.OnTracFuelSurchargeResponse;
import com.example.rbac.service.FedexRyfService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.List;

@Slf4j
@Tag(name = "FedEx附加费查询")
@RestController
@RequestMapping("/fedex")
@RequiredArgsConstructor
public class FedexSurchargeController {

    private final FedexRyfService fedexRyfService;

    private static final String FEDEX_SURCHARGE_URL =
            "https://www.fedex.com/en-us/shipping/historical-fuel-surcharge.html";

    private static final String SERIES = "FedEx Fuel Surcharge";

    @Operation(summary = "查询FedEx燃油附加费历史")
    @GetMapping("/surcharge/weekly")
    public Result<OnTracFuelSurchargeResponse> getWeeklySurcharge(
            @RequestParam(required = false) String date) {
        OffsetDateTime fetchedAt = OffsetDateTime.now();

        List<OnTracFuelSurchargeRate> rates = fedexRyfService.queryAllRates();

        OnTracFuelSurchargeResponse response = new OnTracFuelSurchargeResponse();
        response.setSource(FEDEX_SURCHARGE_URL);
        response.setSeries(SERIES);
        response.setFetchedAt(fetchedAt.toString());
        response.setRates(rates);

        return Result.ok(response);
    }

    @Operation(summary = "同步FedEx燃油附加费数据到fedex_ryf表")
    @GetMapping("/surcharge/sync")
    public Result<Integer> syncSurchargeToDb() {
        try {
            int count = fedexRyfService.syncSurchargeData();
            return Result.ok(count);
        } catch (Exception e) {
            log.error("同步FedEx燃油附加费数据失败", e);
            return Result.fail("同步失败: " + e.getMessage());
        }
    }

    @Operation(summary = "查询FedEx官网历史燃油附加费（Previous Rates表格）")
    @GetMapping("/surcharge/previous")
    public Result<OnTracFuelSurchargeResponse> getPreviousSurcharge() {
        OffsetDateTime fetchedAt = OffsetDateTime.now();

        List<OnTracFuelSurchargeRate> rates = fedexRyfService.fetchPreviousRatesFromFedex();

        OnTracFuelSurchargeResponse response = new OnTracFuelSurchargeResponse();
        response.setSource(FEDEX_SURCHARGE_URL);
        response.setSeries(SERIES);
        response.setFetchedAt(fetchedAt.toString());
        response.setRates(rates);

        log.info("查询FedEx官网历史费率，共{}条记录", rates.size());
        return Result.ok(response);
    }
}