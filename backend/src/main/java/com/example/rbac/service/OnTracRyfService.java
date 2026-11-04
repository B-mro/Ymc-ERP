package com.example.rbac.service;

import cn.hutool.http.HttpUtil;
import com.example.rbac.dto.OnTracFuelSurchargeRate;
import com.example.rbac.entity.OnTracRyf;
import com.example.rbac.mapper.OnTracRyfMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class OnTracRyfService {

    private final OnTracRyfMapper onTracRyfMapper;

    private static final String ONTRAC_SURCHARGE_URL =
            "https://www.ontrac.com/surchargesandrates/";

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

    @Transactional
    public int syncSurchargeData() {
        log.info("开始同步OnTrac燃油附加费数据到ontrac_ryf表");

        onTracRyfMapper.delete(null);
        log.info("已清空ontrac_ryf表");

        log.info("开始获取OnTrac燃油附加费页面: {}", ONTRAC_SURCHARGE_URL);
        String html = HttpUtil.createGet(ONTRAC_SURCHARGE_URL)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36")
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .execute()
                .body();

        List<OnTracRyf> records = parseFuelSurchargeTable(html);

        if (!records.isEmpty()) {
            for (OnTracRyf record : records) {
                onTracRyfMapper.insert(record);
            }
        }

        log.info("同步完成，共导入{}条记录到ontrac_ryf表", records.size());
        return records.size();
    }

    private List<OnTracRyf> parseFuelSurchargeTable(String html) {
        List<OnTracRyf> records = new ArrayList<>();

        html = removeHtmlComments(html);

        int headingIndex = html.indexOf("<h3>Fuel Surcharge History</h3>");
        if (headingIndex == -1) {
            log.warn("未找到 'Fuel Surcharge History' 标题");
            return records;
        }

        int tbodyStart = html.indexOf("<tbody>", headingIndex);
        int tbodyEnd = html.indexOf("</tbody>", tbodyStart);
        if (tbodyStart == -1 || tbodyEnd == -1) {
            log.warn("未找到表格 tbody 标签");
            return records;
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

                OnTracRyf record = buildRecord(effectiveDate, surcharge);
                if (record != null) {
                    records.add(record);
                }
            }
        }

        return records;
    }

    private OnTracRyf buildRecord(String effectiveDate, String surchargeStr) {
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

            OnTracRyf record = new OnTracRyf();
            record.setStart(startDate.format(DATE_OUT_FORMAT));
            record.setEnd(endDate.format(DATE_OUT_FORMAT));
            record.setRate(rate);
            return record;
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

    public List<OnTracFuelSurchargeRate> queryAllRates() {
        List<OnTracRyf> records = onTracRyfMapper.selectList(null);
        return records.stream()
                .map(r -> new OnTracFuelSurchargeRate(r.getStart(), r.getEnd(), r.getRate()))
                .collect(Collectors.toList());
    }

    @Scheduled(cron = "0 0 9 * * 3")
    public void scheduledSyncSurchargeData() {
        log.info("定时任务触发：每周三上午9点同步OnTrac燃油附加费数据");
        try {
            int count = syncSurchargeData();
            log.info("定时任务完成，共导入{}条记录", count);
        } catch (Exception e) {
            log.error("定时任务同步失败", e);
        }
    }
}