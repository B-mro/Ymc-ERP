package com.example.rbac.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rbac.entity.SysRoleDataScope;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface SysRoleDataScopeMapper extends BaseMapper<SysRoleDataScope> {

    @Select("SELECT rs.scope_id FROM sys_role_data_scope rs " +
            "INNER JOIN sys_role r ON rs.role_id = r.id " +
            "WHERE r.role_code IN (${roleCodes})")
    List<Long> findScopeIdsByRoleCodes(@Param("roleCodes") String roleCodes);
}