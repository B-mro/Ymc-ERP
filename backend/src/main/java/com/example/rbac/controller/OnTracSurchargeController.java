package com.example.rbac.controller;

import cn.hutool.http.HttpUtil;
import com.example.rbac.common.Result;
import com.example.rbac.dto.OnTracFuelSurchargeRate;
import com.example.rbac.dto.OnTracFuelSurchargeResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Tag(name = "OnTrac附加费查询")
@RestController
@RequestMapping("/ontrac")
public class OnTracSurchargeController {

    private static final String ONTRAC_SURCHARGE_URL =
            "https://www.ontrac.com/surchargesandrates/";

    private static final String SERIES = "National U.S. Average";

    private static final Pattern TR_PATTERN =
            Pattern.compile("<tr>\\s*(.*?)\\s*</tr>", Pattern.DOTALL);

    private static final Pattern TD_PATTERN =
            Pattern.compile("<td[^>]*>\\s*(.*?)\\s*</td>", Pattern.DOTALL);

    private static final Pattern DATE_RANGE_PATTERN =
            Pattern.compile("(.+?)\\s+to\\s+(.+)");

    private static final DateTimeFormatter DATE_IN_FORMAT =
            DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.ENGLISH);

    private static final DateTimeFormatter DATE_OUT_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private static final Pattern HTML_COMMENT_PATTERN =
            Pattern.compile("<!--.*?-->", Pattern.DOTALL);

    @Operation(summary = "获取OnTrac燃油附加费历史(ShipGrid格式)")
    @GetMapping("/surcharge/history")
    public Result<OnTracFuelSurchargeResponse> getFuelSurchargeHistory() {
        try {
            OffsetDateTime fetchedAt = OffsetDateTime.now();

            log.info("开始获取OnTrac燃油附加费历史数据: {}", ONTRAC_SURCHARGE_URL);

            String html = HttpUtil.createGet(ONTRAC_SURCHARGE_URL)
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36")
                    .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                    .execute()
                    .body();

            List<OnTracFuelSurchargeRate> rates = parseFuelSurchargeTable(html);

            OnTracFuelSurchargeResponse response = new OnTracFuelSurchargeResponse();
            response.setSource(ONTRAC_SURCHARGE_URL);
            response.setSeries(SERIES);
            response.setFetchedAt(fetchedAt.toString());
            response.setRates(rates);

            log.info("成功获取OnTrac燃油附加费历史数据，共{}条记录", rates.size());
            return Result.ok(response);
        } catch (Exception e) {
            log.error("获取OnTrac燃油附加费历史数据失败", e);
            return Result.fail("获取OnTrac燃油附加费历史数据失败: " + e.getMessage());
        }
    }

    private List<OnTracFuelSurchargeRate> parseFuelSurchargeTable(String html) {
        List<OnTracFuelSurchargeRate> rates = new ArrayList<>();

        html = removeHtmlComments(html);

        int headingIndex = html.indexOf("<h3>Fuel Surcharge History</h3>");
        if (headingIndex == -1) {
            log.warn("未找到 'Fuel Surcharge History' 标题");
            return rates;
        }

        int tbodyStart = html.indexOf("<tbody>", headingIndex);
        int tbodyEnd = html.indexOf("</tbody>", tbodyStart);
        if (tbodyStart == -1 || tbodyEnd == -1) {
            log.warn("未找到表格 tbody 标签");
            return rates;
        }

        String tbodyContent = html.substring(tbodyStart + "<tbody>".length(), tbodyEnd);

        Matcher trMatcher = TR_PATTERN.matcher(tbodyContent);
        while (trMatcher.find()) {
            String rowContent = trMatcher.group(1).trim();
            if (rowContent.isEmpty()) {
                continue;
            }

            Matcher tdMatcher = TD_PATTERN.matcher(rowContent);
            List<String> tdValues = new ArrayList<>();
            while (tdMatcher.find()) {
                tdValues.add(tdMatcher.group(1).trim());
            }

            if (tdValues.size() >= 2) {
                String effectiveDate = stripHtmlTags(tdValues.get(0));
                String surcharge = stripHtmlTags(tdValues.get(1));

                OnTracFuelSurchargeRate rate = buildRate(effectiveDate, surcharge);
                if (rate != null) {
                    rates.add(rate);
                }
            }
        }

        return rates;
    }

    private OnTracFuelSurchargeRate buildRate(String effectiveDate, String surchargeStr) {
        if (effectiveDate.isEmpty() || surchargeStr.isEmpty()) {
            return null;
        }

        Matcher dateMatcher = DATE_RANGE_PATTERN.matcher(effectiveDate);
        if (!dateMatcher.matches()) {
            log.warn("无法解析日期范围: {}", effectiveDate);
            return null;
        }

        String startStr = dateMatcher.group(1).trim();
        String endStr = dateMatcher.group(2).trim();

        try {
            LocalDate startDate = LocalDate.parse(startStr, DATE_IN_FORMAT);
            LocalDate endDate = LocalDate.parse(endStr, DATE_IN_FORMAT);

            String surchargeClean = surchargeStr.replace("%", "").trim();
            Double rate = Double.parseDouble(surchargeClean) / 100.0;

            return new OnTracFuelSurchargeRate(
                    startDate.format(DATE_OUT_FORMAT),
                    endDate.format(DATE_OUT_FORMAT),
                    rate
            );
        } catch (Exception e) {
            log.warn("解析日期或费率失败: effectiveDate={}, surcharge={}, error={}",
                    effectiveDate, surchargeStr, e.getMessage());
            return null;
        }
    }

    private String removeHtmlComments(String html) {
        if (html == null || html.isEmpty()) {
            return html;
        }
        return HTML_COMMENT_PATTERN.matcher(html).replaceAll("");
    }

    private String stripHtmlTags(String text) {
        if (text == null || text.isEmpty()) {
            return text;
        }
        return text.replaceAll("<[^>]+>", "").trim();
    }
}