package com.example.rbac.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ScheduledTaskVO implements Serializable {

    private String taskKey;

    private String taskName;

    private String cronExpression;

    private String cronDescription;

    private String serviceName;

    private LocalDateTime lastExecuteTime;

    private Boolean lastExecuteSuccess;

    private String lastExecuteMessage;
}