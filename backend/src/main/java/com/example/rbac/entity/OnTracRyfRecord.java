package com.example.rbac.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;

@Data
@TableName("ontrac_ryf_record")
public class OnTracRyfRecord implements Serializable {

    @TableId(type = IdType.AUTO)
    private Integer id;

    @TableField("start")
    private String start;

    @TableField("end")
    private String end;

    private Double rate;
}