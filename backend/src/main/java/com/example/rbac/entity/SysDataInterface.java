package com.example.rbac.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;

@Data
@TableName("sys_data_interface")
public class SysDataInterface implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String name;

    private String path;

    private String method;

    private Long categoryId;

    private String description;

    private String sqlContent;

    private String resultType;

    private String status;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;

    @TableField(exist = false)
    private String categoryName;

    @TableField(exist = false)
    private List<SysDataInterfaceParam> params;
}