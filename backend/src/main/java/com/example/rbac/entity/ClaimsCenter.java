package com.example.rbac.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.example.rbac.config.JacksonConfig;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import lombok.Data;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@TableName("claims_center")
public class ClaimsCenter implements Serializable {

    @TableId(type = IdType.AUTO)
    private Integer id;

    @TableField("claims_type")
    private String claimsType;

    @TableField("type")
    private String type;

    private String logisticsNo;

    private String customerName;

    private String customerNo;

    private String contactEmail;

    private LocalDate shipDate;

    private String serviceType;

    private String senderAddress;

    private String receiverAddress;

    private String issueType;

    private LocalDateTime lastUpdateDate;

    private String issueDesc;

    private String answer;

    private String status;

    private BigDecimal applyAmount;

    private String invoiceNo;

    private String chargeItem;

    @JsonDeserialize(using = JacksonConfig.StringOrArrayDeserializer.class)
    @JsonSerialize(using = JacksonConfig.StringToArraySerializer.class)
    private String fileUrl;

    @JsonDeserialize(using = JacksonConfig.StringOrArrayDeserializer.class)
    @JsonSerialize(using = JacksonConfig.StringToArraySerializer.class)
    private String imgUrl;

    private BigDecimal receivableAmount;

    private LocalDate invoiceDate;

    private BigDecimal billAmount;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;

    private Integer deleted;

    private String createUser;

    private String updateUser;
}