package com.example.rbac.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.example.rbac.entity.SysDictItem;
import com.example.rbac.mapper.SysDictItemMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class SysDictItemService {

    private final SysDictItemMapper sysDictItemMapper;

    public List<SysDictItem> listByDictCode(String dictCode) {
        LambdaQueryWrapper<SysDictItem> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SysDictItem::getDictCode, dictCode)
                .eq(SysDictItem::getStatus, 1)
                .orderByAsc(SysDictItem::getSort)
                .orderByAsc(SysDictItem::getId);
        return sysDictItemMapper.selectList(wrapper);
    }
}