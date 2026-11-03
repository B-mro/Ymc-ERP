package com.example.rbac.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.example.rbac.common.BusinessException;
import com.example.rbac.entity.SysDataInterfaceCategory;
import com.example.rbac.mapper.SysDataInterfaceCategoryMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DataInterfaceCategoryService {

    private final SysDataInterfaceCategoryMapper categoryMapper;

    public List<SysDataInterfaceCategory> tree() {
        List<SysDataInterfaceCategory> all = categoryMapper.selectList(
                new LambdaQueryWrapper<SysDataInterfaceCategory>()
                        .orderByAsc(SysDataInterfaceCategory::getOrderNum)
        );
        return buildTree(all, 0L);
    }

    private List<SysDataInterfaceCategory> buildTree(List<SysDataInterfaceCategory> all, Long parentId) {
        List<SysDataInterfaceCategory> children = all.stream()
                .filter(c -> parentId.equals(c.getParentId()))
                .collect(Collectors.toList());
        for (SysDataInterfaceCategory node : children) {
            node.setChildren(buildTree(all, node.getId()));
        }
        return children;
    }

    public List<SysDataInterfaceCategory> list() {
        return categoryMapper.selectList(null);
    }

    @Transactional
    public void save(SysDataInterfaceCategory category) {
        if (category.getParentId() == null) category.setParentId(0L);
        if (!StringUtils.hasText(category.getStatus())) category.setStatus("0");
        categoryMapper.insert(category);
    }

    @Transactional
    public void update(SysDataInterfaceCategory category) {
        categoryMapper.updateById(category);
    }

    @Transactional
    public void delete(Long id) {
        Long childCount = categoryMapper.selectList(
                new LambdaQueryWrapper<SysDataInterfaceCategory>()
                        .eq(SysDataInterfaceCategory::getParentId, id)
        ).stream().count();
        if (childCount > 0) {
            throw new BusinessException("存在子分类, 无法删除");
        }
        categoryMapper.deleteById(id);
    }
}