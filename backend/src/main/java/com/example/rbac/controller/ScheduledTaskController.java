package com.example.rbac.controller;

import com.example.rbac.common.Result;
import com.example.rbac.dto.ScheduledTaskVO;
import com.example.rbac.entity.SysTaskLog;
import com.example.rbac.mapper.SysTaskLogMapper;
import com.example.rbac.security.UserContext;
import com.example.rbac.security.UserPermissionCache;
import com.example.rbac.service.FedexRyfService;
import com.example.rbac.service.OnTracRyfService;
import com.example.rbac.service.RyfRecordSyncService;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Tag(name = "定时任务管理")
@RestController
@RequestMapping("/scheduled-task")
@RequiredArgsConstructor
public class ScheduledTaskController {

    private final OnTracRyfService onTracRyfService;
    private final FedexRyfService fedexRyfService;
    private final RyfRecordSyncService ryfRecordSyncService;
    private final UserPermissionCache userPermissionCache;
    private final SysTaskLogMapper sysTaskLogMapper;

    private static final String TASK_ONTRAC_SYNC = "ontrac-sync";
    private static final String TASK_FEDEX_SYNC = "fedex-sync";
    private static final String TASK_RYF_RECORD_SYNC = "ryf-record-sync";
    private static final String TASK_CACHE_CLEAN = "cache-clean";

    private List<ScheduledTaskVO> buildTaskList() {
        List<ScheduledTaskVO> tasks = new ArrayList<>();

        tasks.add(ScheduledTaskVO.builder()
                .taskKey(TASK_ONTRAC_SYNC)
                .taskName("OnTrac燃油附加费同步")
                .cronExpression("0 0 9 * * 3")
                .cronDescription("每周三上午9:00执行，抓取OnTrac官网燃油附加费数据并写入ontrac_ryf表")
                .serviceName("OnTracRyfService.scheduledSyncSurchargeData")
                .build());

        tasks.add(ScheduledTaskVO.builder()
                .taskKey(TASK_FEDEX_SYNC)
                .taskName("FedEx燃油附加费同步")
                .cronExpression("0 0 9 * * 1")
                .cronDescription("每周一上午9:00执行，抓取FedEx官网燃油附加费数据并写入fedex_ryf表")
                .serviceName("FedexRyfService.scheduledSyncSurchargeData")
                .build());

        tasks.add(ScheduledTaskVO.builder()
                .taskKey(TASK_RYF_RECORD_SYNC)
                .taskName("RYF费率记录同步")
                .cronExpression("0 0 17 * * 5")
                .cronDescription("每周五下午17:00执行，将fedex_ryf/ontrac_ryf表中新增记录同步到对应的_record表")
                .serviceName("RyfRecordSyncService.syncRyfRecordData")
                .build());

        tasks.add(ScheduledTaskVO.builder()
                .taskKey(TASK_CACHE_CLEAN)
                .taskName("用户权限缓存清理")
                .cronExpression("fixedRate: 600000ms")
                .cronDescription("每10分钟执行一次，清理过期的用户权限缓存")
                .serviceName("UserPermissionCache.cleanExpired")
                .build());

        for (ScheduledTaskVO task : tasks) {
            SysTaskLog lastLog = sysTaskLogMapper.selectOne(
                    new QueryWrapper<SysTaskLog>()
                            .eq("task_code", task.getTaskKey())
                            .orderByDesc("start_time")
                            .last("LIMIT 1")
            );
            if (lastLog != null) {
                task.setLastExecuteTime(lastLog.getStartTime());
                task.setLastExecuteSuccess("0".equals(lastLog.getStatus()));
                task.setLastExecuteMessage(lastLog.getResultMsg());
            }
        }

        return tasks;
    }

    @Operation(summary = "获取所有定时任务列表")
    @GetMapping("/list")
    public Result<List<ScheduledTaskVO>> listAllTasks() {
        return Result.ok(buildTaskList());
    }

    @Operation(summary = "手动执行OnTrac燃油附加费同步")
    @PostMapping("/execute/ontrac-sync")
    public Result<ScheduledTaskVO> executeOnTracSync() {
        return executeTask(TASK_ONTRAC_SYNC, "1", () -> {
            onTracRyfService.scheduledSyncSurchargeData();
        });
    }

    @Operation(summary = "手动执行FedEx燃油附加费同步")
    @PostMapping("/execute/fedex-sync")
    public Result<ScheduledTaskVO> executeFedexSync() {
        return executeTask(TASK_FEDEX_SYNC, "1", () -> {
            fedexRyfService.scheduledSyncSurchargeData();
        });
    }

    @Operation(summary = "手动执行RYF费率记录同步")
    @PostMapping("/execute/ryf-record-sync")
    public Result<ScheduledTaskVO> executeRyfRecordSync() {
        return executeTask(TASK_RYF_RECORD_SYNC, "1", () -> {
            ryfRecordSyncService.syncRyfRecordData();
        });
    }

    @Operation(summary = "手动执行用户权限缓存清理")
    @PostMapping("/execute/cache-clean")
    public Result<ScheduledTaskVO> executeCacheClean() {
        return executeTask(TASK_CACHE_CLEAN, "1", () -> {
            userPermissionCache.cleanExpired();
        });
    }

    @Operation(summary = "手动执行指定定时任务(通过taskKey)")
    @PostMapping("/execute/{taskKey}")
    public Result<ScheduledTaskVO> executeByKey(@PathVariable String taskKey) {
        switch (taskKey) {
            case TASK_ONTRAC_SYNC:
                return executeOnTracSync();
            case TASK_FEDEX_SYNC:
                return executeFedexSync();
            case TASK_RYF_RECORD_SYNC:
                return executeRyfRecordSync();
            case TASK_CACHE_CLEAN:
                return executeCacheClean();
            default:
                return Result.fail("未知的定时任务: " + taskKey);
        }
    }

    private Result<ScheduledTaskVO> executeTask(String taskKey, String triggerType, Runnable action) {
        List<ScheduledTaskVO> tasks = buildTaskList();
        ScheduledTaskVO staticInfo = tasks.stream()
                .filter(t -> t.getTaskKey().equals(taskKey))
                .findFirst()
                .orElse(null);

        ScheduledTaskVO vo = ScheduledTaskVO.builder()
                .taskKey(staticInfo != null ? staticInfo.getTaskKey() : taskKey)
                .taskName(staticInfo != null ? staticInfo.getTaskName() : taskKey)
                .cronExpression(staticInfo != null ? staticInfo.getCronExpression() : null)
                .cronDescription(staticInfo != null ? staticInfo.getCronDescription() : null)
                .serviceName(staticInfo != null ? staticInfo.getServiceName() : null)
                .build();

        LocalDateTime startTime = LocalDateTime.now();

        String executor = "SYSTEM";
        if ("1".equals(triggerType)) {
            var loginUser = UserContext.get();
            if (loginUser != null && loginUser.getUsername() != null) {
                executor = loginUser.getUsername();
            }
        }

        SysTaskLog taskLog = new SysTaskLog();
        taskLog.setTaskCode(taskKey);
        taskLog.setTaskName(vo.getTaskName());
        taskLog.setExecutor(executor);
        taskLog.setTriggerType(triggerType);
        taskLog.setStartTime(startTime);
        taskLog.setStatus("2");
        sysTaskLogMapper.insert(taskLog);
        log.info("已写入任务执行日志 taskLogId={}, executor={}", taskLog.getId(), executor);

        try {
            log.info("手动触发定时任务: {} ({})", vo.getTaskName(), vo.getTaskKey());
            action.run();

            LocalDateTime endTime = LocalDateTime.now();
            long durationMs = Duration.between(startTime, endTime).toMillis();

            taskLog.setEndTime(endTime);
            taskLog.setDurationMs(durationMs);
            taskLog.setStatus("0");
            taskLog.setResultMsg("执行成功");
            sysTaskLogMapper.updateById(taskLog);

            vo.setLastExecuteTime(startTime);
            vo.setLastExecuteSuccess(true);
            vo.setLastExecuteMessage("执行成功");
            log.info("定时任务 {} 手动执行成功, 耗时={}ms", vo.getTaskKey(), durationMs);
        } catch (Exception e) {
            log.error("定时任务 {} 手动执行失败", vo.getTaskKey(), e);

            LocalDateTime endTime = LocalDateTime.now();
            long durationMs = Duration.between(startTime, endTime).toMillis();

            taskLog.setEndTime(endTime);
            taskLog.setDurationMs(durationMs);
            taskLog.setStatus("1");
            String errorMsg = "执行失败: " + e.getMessage();
            taskLog.setResultMsg(errorMsg.length() > 500 ? errorMsg.substring(0, 500) : errorMsg);
            taskLog.setErrorStack(getStackTraceAsString(e));
            sysTaskLogMapper.updateById(taskLog);

            vo.setLastExecuteTime(startTime);
            vo.setLastExecuteSuccess(false);
            vo.setLastExecuteMessage(errorMsg);
        }

        return Result.ok(vo);
    }

    private String getStackTraceAsString(Exception e) {
        StringWriter sw = new StringWriter();
        PrintWriter pw = new PrintWriter(sw);
        e.printStackTrace(pw);
        pw.flush();
        String stack = sw.toString();
        return stack.length() > 6000 ? stack.substring(0, 6000) : stack;
    }
}