package com.example.rbac.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpsFuelSurchargeRate implements Serializable {

    private String start;

    private String end;

    private Double rate;
}