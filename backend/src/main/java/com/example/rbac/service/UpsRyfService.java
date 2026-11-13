package com.example.rbac.service;

import cn.hutool.http.HttpResponse;
import cn.hutool.http.HttpUtil;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.example.rbac.dto.UpsFuelSurchargeRate;
import com.example.rbac.entity.SysTaskLog;
import com.example.rbac.entity.UpsRyf;
import com.example.rbac.mapper.UpsRyfMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class UpsRyfService {

    private final UpsRyfMapper upsRyfMapper;
    private final ScheduledTaskLogService scheduledTaskLogService;
    private final ObjectMapper objectMapper;

    private static final String UPS_SURCHARGE_URL =
            "https://assets.ups.com/adobe/assets/urn:aaid:aem:f4fc31f7-6059-4bb0-bb22-b1bb1b02211b/original/as/us.json";

    private static final DateTimeFormatter IN_FMT = DateTimeFormatter.ofPattern("MM/dd/yyyy");
    private static final DateTimeFormatter OUT_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    @Scheduled(cron = "0 0 9 * * 2")
    public void scheduledSyncSurchargeData() {
        SysTaskLog taskLog = scheduledTaskLogService.start("ups-sync", "UPS燃油附加费同步");
        log.info("定时任务触发：每周二上午9点同步UPS燃油附加费数据");
        try {
            int count = syncRates();
            log.info("定时任务完成，共新增{}条记录", count);
            scheduledTaskLogService.success(taskLog, "执行成功，共新增" + count + "条记录");
        } catch (Exception e) {
            log.error("定时任务同步失败", e);
            scheduledTaskLogService.fail(taskLog, "执行失败：" + e.getMessage(), e);
        }
    }

    public List<UpsFuelSurchargeRate> fetchSurchargeRates() {
        String raw = fetchRawJson();
        try {
            List<UpsFuelSurchargeRate> rates = parseToRates(raw);
            log.info("转换UPS附加费数据完成，共{}条记录", rates.size());
            return rates;
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            log.error("解析UPS附加费JSON失败", e);
            throw new RuntimeException("解析UPS附加费JSON失败: " + e.getMessage(), e);
        }
    }

    @Transactional
    public int syncRates() {
        List<UpsFuelSurchargeRate> rates = fetchSurchargeRates();

        QueryWrapper<UpsRyf> wrapper = new QueryWrapper<>();
        wrapper.select("start", "end");
        List<UpsRyf> existing = upsRyfMapper.selectList(wrapper);
        Set<String> existingKeys = existing.stream()
                .map(r -> r.getStart() + "|" + r.getEnd())
                .collect(Collectors.toSet());

        List<UpsRyf> toInsert = new ArrayList<>();
        for (UpsFuelSurchargeRate rate : rates) {
            String key = rate.getStart() + "|" + rate.getEnd();
            if (!existingKeys.contains(key)) {
                UpsRyf entity = new UpsRyf();
                entity.setStart(rate.getStart());
                entity.setEnd(rate.getEnd());
                entity.setRate(rate.getRate());
                toInsert.add(entity);
            }
        }

        if (!toInsert.isEmpty()) {
            for (UpsRyf entity : toInsert) {
                upsRyfMapper.insert(entity);
            }
        }

        log.info("UPS附加费同步完成：新增{}条，已存在跳过{}条", toInsert.size(), rates.size() - toInsert.size());
        return toInsert.size();
    }

    public List<UpsFuelSurchargeRate> queryAllRates() {
        List<UpsRyf> records = upsRyfMapper.selectList(null);
        return records.stream()
                .map(r -> new UpsFuelSurchargeRate(r.getStart(), r.getEnd(), r.getRate()))
                .sorted(Comparator.comparing(UpsFuelSurchargeRate::getStart))
                .collect(Collectors.toList());
    }

    private List<UpsFuelSurchargeRate> parseToRates(String raw) throws Exception {
        JsonNode root = objectMapper.readTree(raw);
        JsonNode history = root.path("FuelSurchargeResponse")
                .path("SurchargeHistory_es")
                .path("RevenueSurchargeHistory");

        List<UpsFuelSurchargeRate> rates = new ArrayList<>();
        for (JsonNode item : history) {
            String startStr = item.path("Field1").asText();
            String field2 = item.path("Field2").asText();

            LocalDate start = LocalDate.parse(startStr, IN_FMT);
            LocalDate end = start.plusDays(6);

            double rateVal = Double.parseDouble(field2.replace("%", "")) / 100.0;

            rates.add(new UpsFuelSurchargeRate(
                    start.format(OUT_FMT),
                    end.format(OUT_FMT),
                    rateVal
            ));
        }
        rates.sort(Comparator.comparing(UpsFuelSurchargeRate::getStart));
        return rates;
    }

    public String fetchRawJson() {
        log.info("开始请求UPS燃油附加费接口: {}", UPS_SURCHARGE_URL);

        try (HttpResponse response = HttpUtil.createGet(UPS_SURCHARGE_URL)
                .header("accept", "*/*")
                .header("accept-language", "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6")
                .header("cache-control", "no-cache")
                .header("origin", "https://www.ups.com")
                .header("pragma", "no-cache")
                .header("referer", "https://www.ups.com/")
                .header("user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0")
                .timeout(15000)
                .execute()) {

            int status = response.getStatus();
            String body = response.body();

            log.info("UPS接口响应状态: {}, body长度: {}", status, body != null ? body.length() : 0);

            if (!response.isOk()) {
                throw new RuntimeException("UPS接口返回非成功状态码: " + status + ", body: " + body);
            }

            return body;
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            log.error("请求UPS燃油附加费接口失败", e);
            throw new RuntimeException("请求UPS接口失败: " + e.getMessage(), e);
        }
    }
}