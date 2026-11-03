package com.example.rbac.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.example.rbac.entity.SysDataInterface;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface SysDataInterfaceMapper extends BaseMapper<SysDataInterface> {

    IPage<SysDataInterface> selectPageWithCategory(Page<SysDataInterface> page,
                                                  @Param("name") String name,
                                                  @Param("method") String method,
                                                  @Param("categoryId") Long categoryId);

    @Select("""
            SELECT i.*, c.name AS category_name
            FROM sys_data_interface i
            LEFT JOIN sys_data_interface_category c ON i.category_id = c.id
            WHERE i.id = #{id}
            """)
    SysDataInterface selectDetailById(@Param("id") Long id);

    @Select("SELECT * FROM sys_data_interface WHERE path = #{path} AND method = #{method} LIMIT 1")
    SysDataInterface selectByPathAndMethod(@Param("path") String path, @Param("method") String method);
}