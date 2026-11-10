package com.example.rbac.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UpsFuelSurchargeResponse implements Serializable {

    private String source;

    private String fetchedAt;

    private List<UpsFuelSurchargeRate> rates;
}