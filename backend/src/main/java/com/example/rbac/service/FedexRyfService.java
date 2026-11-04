package com.example.rbac.service;

import cn.hutool.http.HttpUtil;
import com.example.rbac.dto.OnTracFuelSurchargeRate;
import com.example.rbac.entity.FedexRyf;
import com.example.rbac.mapper.FedexRyfMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoField;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class FedexRyfService {

    private final FedexRyfMapper fedexRyfMapper;

    private static final String FEDEX_SURCHARGE_URL =
            "https://www.fedex.com/en-us/shipping/historical-fuel-surcharge.html";

    private static final Pattern TR_PATTERN =
            Pattern.compile("<tr[^>]*>\\s*(.*?)\\s*</tr>", Pattern.DOTALL);

    private static final Pattern TD_PATTERN =
            Pattern.compile("<td[^>]*>\\s*(.*?)\\s*</td>", Pattern.DOTALL);

    private static final Pattern HTML_COMMENT_PATTERN =
            Pattern.compile("<!--.*?-->", Pattern.DOTALL);

    private static final Pattern SCRIPT_PATTERN =
            Pattern.compile("<script[^>]*>.*?</script>", Pattern.DOTALL);

    private static final Pattern STYLE_PATTERN =
            Pattern.compile("<style[^>]*>.*?</style>", Pattern.DOTALL);

    private static final Pattern SURCHARGE_PCT_PATTERN =
            Pattern.compile("(\\d+\\.?\\d*)\\s*%");

    private static final Pattern INCIDENT_NO_PATTERN =
            Pattern.compile("Incident Number:\\s*([\\d.]+)");

    private static final DateTimeFormatter DATE_OUT_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private static final DateTimeFormatter[] DATE_IN_FORMATS = {
            DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("MMMM dd, yyyy", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("MMM dd, yyyy", Locale.ENGLISH),
            new DateTimeFormatterBuilder()
                    .appendPattern("MMMM")
                    .appendLiteral(' ')
                    .appendValue(ChronoField.DAY_OF_MONTH)
                    .appendLiteral(',')
                    .appendLiteral(' ')
                    .appendValue(ChronoField.YEAR)
                    .toFormatter(Locale.ENGLISH)
    };

    @Transactional
    public int syncSurchargeData() {
        log.info("开始同步FedEx燃油附加费数据到fedex_ryf表");

        fedexRyfMapper.delete(null);
        log.info("已清空fedex_ryf表");

        log.info("开始获取FedEx燃油附加费页面: {}", FEDEX_SURCHARGE_URL);
        String html = HttpUtil.createGet(FEDEX_SURCHARGE_URL)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36")
                .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                .execute()
                .body();

        if (html.contains("We're sorry, we can't process your request right now")
                && html.contains("Incident Number:")) {
            log.error("FedEx WAF拦截，事件号：{}", extractIncidentNo(html));
            throw new RuntimeException("FedEx网站拒绝访问，出口IP被风控拦截");
        }

        List<FedexRyf> records = parseFuelSurchargeTable(html);

        if (!records.isEmpty()) {
            for (FedexRyf record : records) {
                fedexRyfMapper.insert(record);
            }
        }

        log.info("同步完成，共导入{}条记录到fedex_ryf表", records.size());
        return records.size();
    }

    private List<FedexRyf> parseFuelSurchargeTable(String html) {
        List<FedexRyf> records = new ArrayList<>();

        html = removeScriptsAndStyles(html);
        html = removeHtmlComments(html);

        int headingIndex = findHeadingIndex(html);
        int searchFrom = headingIndex;
        if (headingIndex == -1) {
            log.warn("未找到特定标题，回退到全局搜索第一个 <tbody>");
            searchFrom = 0;
        }

        int tbodyStart = html.indexOf("<tbody>", searchFrom);
        int tbodyEnd = tbodyStart >= 0 ? html.indexOf("</tbody>", tbodyStart) : -1;

        if (tbodyStart == -1 || tbodyEnd == -1) {
            log.warn("未找到表格 tbody 标签，尝试直接解析 <tr>");
            tbodyStart = html.indexOf("<tr", searchFrom);
            tbodyEnd = html.lastIndexOf("</tr>");
            if (tbodyStart == -1 || tbodyEnd == -1) {
                log.warn("未找到任何表格行");
                return records;
            }
            tbodyEnd = html.indexOf("</table>", tbodyStart);
            if (tbodyEnd == -1) {
                tbodyEnd = html.length();
            }
        }

        String tableContent = html.substring(tbodyStart, tbodyEnd);

        Matcher trMatcher = TR_PATTERN.matcher(tableContent);
        while (trMatcher.find()) {
            String rowContent = trMatcher.group(1).trim();
            if (rowContent.isEmpty()) {
                continue;
            }

            Matcher tdMatcher = TD_PATTERN.matcher(rowContent);
            List<String> tdValues = new ArrayList<>();
            while (tdMatcher.find()) {
                String cellText = stripHtmlTags(tdMatcher.group(1)).trim();
                tdValues.add(cellText);
            }

            if (tdValues.size() >= 2) {
                String effectiveDate = tdValues.get(0);
                String surchargeStr = tdValues.get(1);

                if (isHeaderRow(effectiveDate) || effectiveDate.isEmpty() || surchargeStr.isEmpty()) {
                    continue;
                }

                Matcher surchargeMatcher = SURCHARGE_PCT_PATTERN.matcher(surchargeStr);
                if (surchargeMatcher.find()) {
                    String pct = surchargeMatcher.group(1);
                    String dateStr = parseFedexDate(effectiveDate);
                    if (dateStr != null) {
                        FedexRyf record = new FedexRyf();
                        record.setStart(dateStr);
                        record.setEnd(dateStr);
                        record.setRate(Double.parseDouble(pct) / 100.0);
                        records.add(record);
                    }
                }
            }
        }

        return records;
    }

    private int findHeadingIndex(String html) {
        String lower = html.toLowerCase();
        int idx = lower.indexOf("<h3>previous fedex package and express freight fuel surcharge rates</h3>");
        if (idx == -1) {
            idx = lower.indexOf("<h3>fuel surcharge history</h3>");
        }
        if (idx == -1) {
            idx = lower.indexOf("<h3>fuel surcharge rates</h3>");
        }
        return idx;
    }

    private boolean isHeaderRow(String text) {
        String lower = text.toLowerCase();
        return lower.contains("effective date")
                || lower.contains("surcharge")
                || lower.contains("fuel surcharge")
                || lower.contains("percentage");
    }

    private String parseFedexDate(String rawDate) {
        String cleaned = rawDate.replaceAll("\\s+", " ").trim();
        for (DateTimeFormatter fmt : DATE_IN_FORMATS) {
            try {
                LocalDate date = LocalDate.parse(cleaned, fmt);
                return date.format(DATE_OUT_FORMAT);
            } catch (DateTimeParseException ignored) {
            }
        }
        log.warn("无法解析FedEx日期: {}", rawDate);
        return null;
    }

    private String removeHtmlComments(String html) {
        if (html == null || html.isEmpty()) {
            return html;
        }
        return HTML_COMMENT_PATTERN.matcher(html).replaceAll("");
    }

    private String removeScriptsAndStyles(String html) {
        if (html == null || html.isEmpty()) {
            return html;
        }
        html = SCRIPT_PATTERN.matcher(html).replaceAll("");
        html = STYLE_PATTERN.matcher(html).replaceAll("");
        return html;
    }

    private String stripHtmlTags(String text) {
        if (text == null || text.isEmpty()) {
            return text;
        }
        return text.replaceAll("<[^>]+>", "").trim();
    }

    private String extractIncidentNo(String html) {
        Matcher m = INCIDENT_NO_PATTERN.matcher(html);
        return m.find() ? m.group(1) : "unknown";
    }

    public List<OnTracFuelSurchargeRate> queryAllRates() {
        List<FedexRyf> records = fedexRyfMapper.selectList(null);
        return records.stream()
                .map(r -> new OnTracFuelSurchargeRate(r.getStart(), r.getEnd(), r.getRate()))
                .collect(Collectors.toList());
    }

    @Scheduled(cron = "0 0 9 * * 1")
    public void scheduledSyncSurchargeData() {
        log.info("定时任务触发：每周一上午9点同步FedEx燃油附加费数据");
        try {
            int count = syncSurchargeData();
            log.info("定时任务完成，共导入{}条记录", count);
        } catch (Exception e) {
            log.error("定时任务同步失败", e);
        }
    }
}