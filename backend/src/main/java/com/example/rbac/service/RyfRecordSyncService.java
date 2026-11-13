package com.example.rbac.service;

import com.example.rbac.entity.SysTaskLog;
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
    private final ScheduledTaskLogService scheduledTaskLogService;

    @Scheduled(cron = "0 0 17 * * 5")
    @Transactional
    public void syncRyfRecordData() {
        SysTaskLog taskLog = scheduledTaskLogService.start("ryf-record-sync", "RYF费率记录同步");
        log.info("定时任务触发：每周五下午5点同步RYF记录数据");

        String resultMsg = "";
        boolean allSuccess = true;
        int fedexCount = 0;
        int onTracCount = 0;

        try {
            fedexCount = fedexRyfRecordMapper.insertFromFedexRyf();
            log.info("FedEx RYF记录同步完成，新增{}条记录到fedex_ryf_record表", fedexCount);
        } catch (Exception e) {
            allSuccess = false;
            resultMsg += "FedEx同步失败(" + e.getMessage() + ") ";
            log.error("FedEx RYF记录同步失败", e);
        }

        try {
            onTracCount = onTracRyfRecordMapper.insertFromOnTracRyf();
            log.info("OnTrac RYF记录同步完成，新增{}条记录到ontrac_ryf_record表", onTracCount);
        } catch (Exception e) {
            allSuccess = false;
            resultMsg += "OnTrac同步失败(" + e.getMessage() + ")";
            log.error("OnTrac RYF记录同步失败", e);
        }

        if (allSuccess) {
            scheduledTaskLogService.success(taskLog,
                    "执行成功，FedEx新增" + fedexCount + "条，OnTrac新增" + onTracCount + "条");
        } else {
            scheduledTaskLogService.fail(taskLog,
                    "部分失败：FedEx=" + fedexCount + "条, OnTrac=" + onTracCount + "条, " + resultMsg, null);
        }
    }
}