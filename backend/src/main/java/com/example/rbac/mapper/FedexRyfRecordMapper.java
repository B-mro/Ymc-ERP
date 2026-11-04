package com.example.rbac.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.rbac.entity.FedexRyfRecord;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface FedexRyfRecordMapper extends BaseMapper<FedexRyfRecord> {

    @Insert("INSERT INTO fedex_ryf_record (start, end, rate) "
            + "SELECT a.start, a.end, a.rate "
            + "FROM fedex_ryf a "
            + "WHERE NOT EXISTS ("
            + "    SELECT 1 FROM fedex_ryf_record ar "
            + "    WHERE (ar.start = a.start OR (ar.start IS NULL AND a.start IS NULL)) "
            + "    AND (ar.end = a.end OR (ar.end IS NULL AND a.end IS NULL)) "
            + "    AND (ar.rate = a.rate OR (ar.rate IS NULL AND a.rate IS NULL))"
            + ")")
    int insertFromFedexRyf();
}