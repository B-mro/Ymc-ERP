package com.example.rbac.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;

@Data
@TableName("sys_data_interface_param")
public class SysDataInterfaceParam implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long interfaceId;

    private String paramName;

    private String fieldName;

    private String type;

    private String position;

    private Boolean required;

    private String defaultValue;

    private String description;

    private Integer sortOrder;
}