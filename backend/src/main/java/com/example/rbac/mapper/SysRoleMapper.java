package com.example.rbac.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rbac.entity.SysRole;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface SysRoleMapper extends BaseMapper<SysRole> {

    /** 查询用户拥有的（正常状态）角色 */
    @Select("""
            SELECT r.* FROM sys_role r
            INNER JOIN sys_user_role ur ON r.id = ur.role_id
            WHERE ur.user_id = #{userId} AND r.status = '0'
            """)
    List<SysRole> selectByUserId(Long userId);

    /** 根据角色编码统计（唯一性校验） */
    @Select("SELECT COUNT(1) FROM sys_role WHERE role_code = #{roleCode} AND id != #{excludeId}")
    long countByCode(String roleCode, Long excludeId);
}
