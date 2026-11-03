package com.example.rbac.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

@Data
@TableName("sys_data_scope")
public class SysDataScope implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String scopeName;

    private String perms;

    private String tableName;

    private String scopeType;

    private String fieldName;

    private String valueSource;

    private String status;

    private String remark;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}