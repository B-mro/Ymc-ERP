package com.example.rbac.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.example.rbac.common.BusinessException;
import com.example.rbac.entity.SysMenu;
import com.example.rbac.mapper.SysMenuMapper;
import com.example.rbac.mapper.SysRoleMenuMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SysMenuService {

    private final SysMenuMapper menuMapper;
    private final SysRoleMenuMapper roleMenuMapper;

    /**
     * 菜单列表（扁平），可按名称模糊查询
     */
    public List<SysMenu> list(String menuName) {
        LambdaQueryWrapper<SysMenu> wrapper = new LambdaQueryWrapper<>();
        wrapper.like(StringUtils.hasText(menuName), SysMenu::getMenuName, menuName)
                .orderByAsc(SysMenu::getParentId)
                .orderByAsc(SysMenu::getOrderNum);
        return menuMapper.selectList(wrapper);
    }

    /**
     * 菜单树
     */
    public List<SysMenu> tree(String menuName) {
        return buildTree(list(menuName));
    }

    /**
     * 将扁平菜单列表构造成树（按 parentId 挂载，按 orderNum 排序）
     */
    public List<SysMenu> buildTree(List<SysMenu> menus) {
        Map<Long, SysMenu> idMap = menus.stream()
                .collect(Collectors.toMap(SysMenu::getId, m -> m, (a, b) -> a, LinkedHashMap::new));
        List<SysMenu> roots = new ArrayList<>();
        for (SysMenu menu : menus) {
            Long pid = menu.getParentId();
            if (pid != null && pid != 0L && idMap.containsKey(pid)) {
                SysMenu parent = idMap.get(pid);
                if (parent.getChildren() == null) {
                    parent.setChildren(new ArrayList<>());
                }
                parent.getChildren().add(menu);
            } else {
                roots.add(menu);
            }
        }
        sort(roots);
        return roots;
    }

    private void sort(List<SysMenu> menus) {
        menus.sort(Comparator.comparing(m -> m.getOrderNum() == null ? 0 : m.getOrderNum()));
        for (SysMenu menu : menus) {
            if (menu.getChildren() != null && !menu.getChildren().isEmpty()) {
                sort(menu.getChildren());
            }
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void save(SysMenu menu) {
        prepare(menu);
        menu.setId(null);
        menuMapper.insert(menu);
    }

    @Transactional(rollbackFor = Exception.class)
    public void update(SysMenu menu) {
        if (menu.getId() == null) {
            throw new BusinessException("菜单 ID 不能为空");
        }
        if (menu.getId().equals(menu.getParentId())) {
            throw new BusinessException("上级菜单不能选择自己");
        }
        prepare(menu);
        menuMapper.updateById(menu);
    }

    private void prepare(SysMenu menu) {
        if (!StringUtils.hasText(menu.getMenuType())) {
            menu.setMenuType("M");
        }
        if (menu.getParentId() == null) {
            menu.setParentId(0L);
        }
        if (menu.getOrderNum() == null) {
            menu.setOrderNum(0);
        }
        if (!StringUtils.hasText(menu.getStatus())) {
            menu.setStatus("0");
        }
        if (!StringUtils.hasText(menu.getVisible())) {
            menu.setVisible("0");
        }
        // 按钮不参与路由
        if ("F".equals(menu.getMenuType())) {
            menu.setPath(null);
            menu.setComponent(null);
        }
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Long id) {
        Long childCount = menuMapper.selectCount(
                new LambdaQueryWrapper<SysMenu>().eq(SysMenu::getParentId, id));
        if (childCount > 0) {
            throw new BusinessException("存在子菜单，不允许删除");
        }
        // 清理角色-菜单关联
        roleMenuMapper.deleteByMenuId(id);
        menuMapper.deleteById(id);
    }
}
