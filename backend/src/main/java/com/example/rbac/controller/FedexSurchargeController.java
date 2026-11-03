package com.example.rbac.controller;

import cn.hutool.http.HttpResponse;
import cn.hutool.http.HttpUtil;
import com.example.rbac.common.Result;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

@Slf4j
@Tag(name = "FedEx附加费查询")
@RestController
@RequestMapping("/fedex")
@RequiredArgsConstructor
public class FedexSurchargeController {

    private static final String FEDEX_SURCHARGE_URL =
            "https://www.fedex.com/etc/services/dynamic.express_weekly.apac.%s.zh_cn.false.false.13.jsonp";

    private static final DateTimeFormatter DATE_FORMATTER =
            DateTimeFormatter.ofPattern("dd MMMM, yyyy", Locale.ENGLISH);

    private final ObjectMapper objectMapper;

    @Operation(summary = "查询FedEx亚太区国际快递附加费")
    @GetMapping("/surcharge/weekly")
    public Result<JsonNode> getWeeklySurcharge(
            @RequestParam(required = false) String date) {
        try {
            String dateStr;
            if (date != null && !date.isBlank()) {
                dateStr = date;
            } else {
                dateStr = LocalDate.now().format(DATE_FORMATTER);
            }

            String url = String.format(FEDEX_SURCHARGE_URL, dateStr);

            log.info("调用FedEx附加费接口: {}", url);

            HttpResponse response = HttpUtil.createGet(url)
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36")
                    .header("Accept", "application/json, text/javascript, */*; q=0.01")
                    .header("Referer", "https://www.fedex.com/zh-cn/shipping/surcharges.html")
                    .header("X-Requested-With", "XMLHttpRequest")
                    .execute();

            String body = response.body();

            String jsonStr = extractJsonFromJsonp(body);

            JsonNode jsonNode = objectMapper.readTree(jsonStr);

            return Result.ok(jsonNode);
        } catch (Exception e) {
            log.error("获取FedEx附加费失败", e);
            return Result.fail("获取FedEx附加费失败: " + e.getMessage());
        }
    }

    private String extractJsonFromJsonp(String jsonp) {
        if (jsonp == null || jsonp.isBlank()) {
            return "{}";
        }
        String trimmed = jsonp.trim();
        int start = trimmed.indexOf('(');
        int end = trimmed.lastIndexOf(')');
        if (start >= 0 && end > start) {
            return trimmed.substring(start + 1, end).trim();
        }
        return trimmed;
    }
}