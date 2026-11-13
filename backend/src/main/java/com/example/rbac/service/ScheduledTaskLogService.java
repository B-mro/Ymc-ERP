package com.example.rbac.service;

import com.example.rbac.entity.SysTaskLog;
import com.example.rbac.mapper.SysTaskLogMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.PrintWriter;
import java.io.StringWriter;
import java.time.Duration;
import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class ScheduledTaskLogService {

    private final SysTaskLogMapper sysTaskLogMapper;

    public SysTaskLog start(String taskCode, String taskName) {
        SysTaskLog taskLog = new SysTaskLog();
        taskLog.setTaskCode(taskCode);
        taskLog.setTaskName(taskName);
        taskLog.setExecutor("SYSTEM");
        taskLog.setTriggerType("0");
        taskLog.setStartTime(LocalDateTime.now());
        taskLog.setStatus("2");
        sysTaskLogMapper.insert(taskLog);
        return taskLog;
    }

    public void success(SysTaskLog taskLog, String resultMsg) {
        LocalDateTime now = LocalDateTime.now();
        taskLog.setEndTime(now);
        taskLog.setDurationMs(Duration.between(taskLog.getStartTime(), now).toMillis());
        taskLog.setStatus("0");
        taskLog.setResultMsg(truncate(resultMsg, 500));
        sysTaskLogMapper.updateById(taskLog);
    }

    public void fail(SysTaskLog taskLog, String message, Throwable t) {
        LocalDateTime now = LocalDateTime.now();
        taskLog.setEndTime(now);
        taskLog.setDurationMs(Duration.between(taskLog.getStartTime(), now).toMillis());
        taskLog.setStatus("1");
        String msg = message != null ? message : (t != null ? t.getMessage() : "unknown error");
        taskLog.setResultMsg(truncate(msg, 500));
        taskLog.setErrorStack(t != null ? truncate(stackTrace(t), 6000) : null);
        sysTaskLogMapper.updateById(taskLog);
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() > max ? s.substring(0, max) : s;
    }

    private static String stackTrace(Throwable t) {
        StringWriter sw = new StringWriter();
        t.printStackTrace(new PrintWriter(sw));
        return sw.toString();
    }
}