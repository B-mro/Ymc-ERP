package com.example.rbac.service;

import com.example.rbac.mapper.FedexRyfRecordMapper;
import com.example.rbac.mapper.OnTracRyfRecordMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class RyfRecordSyncService {

    private final FedexRyfRecordMapper fedexRyfRecordMapper;
    private final OnTracRyfRecordMapper onTracRyfRecordMapper;

    @Scheduled(cron = "0 0 17 * * 5")
    @Transactional
    public void syncRyfRecordData() {
        log.info("定时任务触发：每周五下午5点同步RYF记录数据");

        try {
            int fedexCount = fedexRyfRecordMapper.insertFromFedexRyf();
            log.info("FedEx RYF记录同步完成，新增{}条记录到fedex_ryf_record表", fedexCount);
        } catch (Exception e) {
            log.error("FedEx RYF记录同步失败", e);
        }

        try {
            int onTracCount = onTracRyfRecordMapper.insertFromOnTracRyf();
            log.info("OnTrac RYF记录同步完成，新增{}条记录到ontrac_ryf_record表", onTracCount);
        } catch (Exception e) {
            log.error("OnTrac RYF记录同步失败", e);
        }
    }
}