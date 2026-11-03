package com.example.rbac.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.example.rbac.common.BusinessException;
import com.example.rbac.common.PageResult;
import com.example.rbac.entity.ClaimsCenter;
import com.example.rbac.mapper.ClaimsCenterMapper;
import com.example.rbac.security.UserContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Arrays;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ClaimsCenterService {

    private final ClaimsCenterMapper claimsCenterMapper;

    private LambdaQueryWrapper<ClaimsCenter> buildWrapper(ClaimsCenter query) {
        LambdaQueryWrapper<ClaimsCenter> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(ClaimsCenter::getDeleted, 0)
                .like(StringUtils.hasText(query.getLogisticsNo()), ClaimsCenter::getLogisticsNo, query.getLogisticsNo())
                .eq(StringUtils.hasText(query.getClaimsType()), ClaimsCenter::getClaimsType, query.getClaimsType())
                .eq(StringUtils.hasText(query.getType()), ClaimsCenter::getType, query.getType())
                .like(StringUtils.hasText(query.getCustomerName()), ClaimsCenter::getCustomerName, query.getCustomerName())
                .like(StringUtils.hasText(query.getCustomerNo()), ClaimsCenter::getCustomerNo, query.getCustomerNo())
                .eq(StringUtils.hasText(query.getIssueType()), ClaimsCenter::getIssueType, query.getIssueType())
                .eq(StringUtils.hasText(query.getServiceType()), ClaimsCenter::getServiceType, query.getServiceType())
                .orderByDesc(ClaimsCenter::getCreateTime);
        return wrapper;
    }

    public List<ClaimsCenter> list(ClaimsCenter query) {
        return claimsCenterMapper.selectList(buildWrapper(query));
    }

    public PageResult<ClaimsCenter> page(ClaimsCenter query, Integer pageNum, Integer pageSize) {
        Page<ClaimsCenter> page = new Page<>(pageNum == null ? 1 : pageNum, pageSize == null ? 10 : pageSize);
        Page<ClaimsCenter> result = claimsCenterMapper.selectPage(page, buildWrapper(query));
        return new PageResult<>(result.getTotal(), result.getRecords());
    }

    public ClaimsCenter detail(Integer id) {
        ClaimsCenter claims = claimsCenterMapper.selectById(id);
        if (claims == null || (claims.getDeleted() != null && claims.getDeleted() == 1)) {
            throw new BusinessException("记录不存在");
        }
        return claims;
    }

    @Transactional(rollbackFor = Exception.class)
    public void save(ClaimsCenter claims) {
        if (!StringUtils.hasText(claims.getClaimsType())) {
            throw new BusinessException("claimsType 不能为空");
        }
        if (!StringUtils.hasText(claims.getType())) {
            throw new BusinessException("type 不能为空");
        }
        if (!StringUtils.hasText(claims.getLogisticsNo())) {
            throw new BusinessException("logisticsNo 不能为空");
        }
        claims.setId(null);
        if (claims.getDeleted() == null) {
            claims.setDeleted(0);
        }
        Long userId = UserContext.getUserId();
        if (userId != null) {
            claims.setCreateUser(String.valueOf(userId));
        }
        claimsCenterMapper.insert(claims);
    }

    @Transactional(rollbackFor = Exception.class)
    public void update(ClaimsCenter claims) {
        if (claims.getId() == null) {
            throw new BusinessException("id 不能为空");
        }
        ClaimsCenter existing = claimsCenterMapper.selectById(claims.getId());
        if (existing == null || (existing.getDeleted() != null && existing.getDeleted() == 1)) {
            throw new BusinessException("记录不存在");
        }
        Long userId = UserContext.getUserId();
        if (userId != null) {
            claims.setUpdateUser(String.valueOf(userId));
        }
        claimsCenterMapper.updateById(claims);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(Integer[] ids) {
        List<Integer> idList = Arrays.asList(ids);
        for (Integer id : idList) {
            ClaimsCenter existing = claimsCenterMapper.selectById(id);
            if (existing != null && (existing.getDeleted() == null || existing.getDeleted() == 0)) {
                ClaimsCenter update = new ClaimsCenter();
                update.setId(id);
                update.setDeleted(1);
                claimsCenterMapper.updateById(update);
            }
        }
    }
}