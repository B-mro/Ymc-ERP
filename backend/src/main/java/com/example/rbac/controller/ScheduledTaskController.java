package com.example.rbac.controller;

import com.example.rbac.common.Result;
import com.example.rbac.dto.ScheduledTaskVO;
import com.example.rbac.security.UserPermissionCache;
import com.example.rbac.service.OnTracRyfService;
import com.example.rbac.service.RyfRecordSyncService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Tag(name = "定时任务管理")
@RestController
@RequestMapping("/scheduled-task")
@RequiredArgsConstructor
public class ScheduledTaskController {

    private final OnTracRyfService onTracRyfService;
    private final RyfRecordSyncService ryfRecordSyncService;
    private final UserPermissionCache userPermissionCache;

    private final Map<String, ScheduledTaskVO> taskExecutionMap = new ConcurrentHashMap<>();

    private static final String TASK_ONTRAC_SYNC = "ontrac-sync";
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
            ScheduledTaskVO lastExec = taskExecutionMap.get(task.getTaskKey());
            if (lastExec != null) {
                task.setLastExecuteTime(lastExec.getLastExecuteTime());
                task.setLastExecuteSuccess(lastExec.getLastExecuteSuccess());
                task.setLastExecuteMessage(lastExec.getLastExecuteMessage());
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
        return executeTask(TASK_ONTRAC_SYNC, () -> {
            onTracRyfService.scheduledSyncSurchargeData();
        });
    }

    @Operation(summary = "手动执行RYF费率记录同步")
    @PostMapping("/execute/ryf-record-sync")
    public Result<ScheduledTaskVO> executeRyfRecordSync() {
        return executeTask(TASK_RYF_RECORD_SYNC, () -> {
            ryfRecordSyncService.syncRyfRecordData();
        });
    }

    @Operation(summary = "手动执行用户权限缓存清理")
    @PostMapping("/execute/cache-clean")
    public Result<ScheduledTaskVO> executeCacheClean() {
        return executeTask(TASK_CACHE_CLEAN, () -> {
            userPermissionCache.cleanExpired();
        });
    }

    @Operation(summary = "手动执行指定定时任务(通过taskKey)")
    @PostMapping("/execute/{taskKey}")
    public Result<ScheduledTaskVO> executeByKey(@PathVariable String taskKey) {
        switch (taskKey) {
            case TASK_ONTRAC_SYNC:
                return executeOnTracSync();
            case TASK_RYF_RECORD_SYNC:
                return executeRyfRecordSync();
            case TASK_CACHE_CLEAN:
                return executeCacheClean();
            default:
                return Result.fail("未知的定时任务: " + taskKey);
        }
    }

    private Result<ScheduledTaskVO> executeTask(String taskKey, Runnable action) {
        ScheduledTaskVO vo = ScheduledTaskVO.builder().build();
        LocalDateTime now = LocalDateTime.now();

        List<ScheduledTaskVO> tasks = buildTaskList();
        ScheduledTaskVO staticInfo = tasks.stream()
                .filter(t -> t.getTaskKey().equals(taskKey))
                .findFirst()
                .orElse(null);

        if (staticInfo != null) {
            vo.setTaskKey(staticInfo.getTaskKey());
            vo.setTaskName(staticInfo.getTaskName());
            vo.setCronExpression(staticInfo.getCronExpression());
            vo.setCronDescription(staticInfo.getCronDescription());
            vo.setServiceName(staticInfo.getServiceName());
        }

        try {
            log.info("手动触发定时任务: {} ({})", vo.getTaskName(), vo.getTaskKey());
            action.run();
            vo.setLastExecuteTime(now);
            vo.setLastExecuteSuccess(true);
            vo.setLastExecuteMessage("执行成功");
            log.info("定时任务 {} 手动执行成功", vo.getTaskKey());
        } catch (Exception e) {
            log.error("定时任务 {} 手动执行失败", vo.getTaskKey(), e);
            vo.setLastExecuteTime(now);
            vo.setLastExecuteSuccess(false);
            vo.setLastExecuteMessage("执行失败: " + e.getMessage());
        }

        taskExecutionMap.put(taskKey, vo);
        return Result.ok(vo);
    }
}