package com.example.rbac.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("sys_task_log")
public class SysTaskLog implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String taskCode;

    private String taskName;

    private String executor;

    private String triggerType;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private Long durationMs;

    private String status;

    private String resultMsg;

    private String errorStack;

    private LocalDateTime createTime;
}