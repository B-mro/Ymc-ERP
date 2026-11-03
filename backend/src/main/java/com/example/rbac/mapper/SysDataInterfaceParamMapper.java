package com.example.rbac.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rbac.entity.SysDataInterfaceParam;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface SysDataInterfaceParamMapper extends BaseMapper<SysDataInterfaceParam> {

    @Select("SELECT * FROM sys_data_interface_param WHERE interface_id = #{interfaceId} ORDER BY sort_order ASC")
    List<SysDataInterfaceParam> selectByInterfaceId(Long interfaceId);
}