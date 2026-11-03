package com.example.rbac.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.example.rbac.common.BusinessException;
import com.example.rbac.common.PageResult;
import com.example.rbac.entity.SysDataInterface;
import com.example.rbac.entity.SysDataInterfaceParam;
import com.example.rbac.mapper.SysDataInterfaceMapper;
import com.example.rbac.mapper.SysDataInterfaceParamMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class DataInterfaceService {

    private final SysDataInterfaceMapper interfaceMapper;
    private final SysDataInterfaceParamMapper paramMapper;
    private final NamedParameterJdbcTemplate jdbcTemplate;
    private final JdbcTemplate plainJdbc;

    private static final Pattern PLACEHOLDER_PATTERN = Pattern.compile("#\\{([^}]+)\\}");
    private static final Pattern DYNAMIC_PATTERN = Pattern.compile("\\$\\{([^}]+)\\}");

    private static final Set<String> ALLOWED_PREFIXES = Set.of("SELECT", "INSERT", "UPDATE", "DELETE");
    private static final Set<String> DANGEROUS_KEYWORDS = Set.of(
            "DROP", "TRUNCATE", "ALTER", "CREATE", "RENAME", "GRANT", "REVOKE",
            "EXEC", "EXECUTE", "DECLARE", "INTO", "LOAD_FILE", "OUTFILE", "SLEEP",
            "BENCHMARK", "UNION_SELECT"
    );
    private static final Pattern DANGEROUS_KEYWORD_PATTERN =
            Pattern.compile("\\b(?:" + String.join("|", DANGEROUS_KEYWORDS) + ")\\b", Pattern.CASE_INSENSITIVE);

    public PageResult<SysDataInterface> page(Integer pageNum, Integer pageSize, String name,
                                             String method, Long categoryId) {
        Page<SysDataInterface> page = new Page<>(pageNum == null ? 1 : pageNum, pageSize == null ? 10 : pageSize);
        IPage<SysDataInterface> result = interfaceMapper.selectPageWithCategory(page, name, method, categoryId);
        return new PageResult<>(result.getTotal(), result.getRecords());
    }

    public SysDataInterface detail(Long id) {
        SysDataInterface api = interfaceMapper.selectDetailById(id);
        if (api == null) throw new BusinessException("接口不存在");
        api.setParams(paramMapper.selectByInterfaceId(id));
        return api;
    }

    @Transactional
    public void save(SysDataInterface api) {
        validateSql(api.getSqlContent());
        if (!StringUtils.hasText(api.getStatus())) api.setStatus("0");
        interfaceMapper.insert(api);
        saveParams(api.getId(), api.getParams());
    }

    @Transactional
    public void update(SysDataInterface api) {
        if (api.getId() == null) throw new BusinessException("ID不能为空");
        validateSql(api.getSqlContent());
        interfaceMapper.updateById(api);
        LambdaQueryWrapper<SysDataInterfaceParam> del = new LambdaQueryWrapper<>();
        del.eq(SysDataInterfaceParam::getInterfaceId, api.getId());
        paramMapper.delete(del);
        saveParams(api.getId(), api.getParams());
    }

    @Transactional
    public void delete(Long[] ids) {
        interfaceMapper.deleteBatchIds(Arrays.asList(ids));
        LambdaQueryWrapper<SysDataInterfaceParam> del = new LambdaQueryWrapper<>();
        del.in(SysDataInterfaceParam::getInterfaceId, Arrays.asList(ids));
        paramMapper.delete(del);
    }

    public List<Map<String, Object>> listTables() {
        String dbName = plainJdbc.queryForObject("SELECT DATABASE()", String.class);
        String sql = """
                SELECT TABLE_NAME AS name, TABLE_COMMENT AS comment, TABLE_ROWS AS `rows`
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = ?
                ORDER BY TABLE_NAME ASC
                """;
        return plainJdbc.queryForList(sql, dbName);
    }

    public List<Map<String, Object>> listTableColumns(String tableName) {
        if (!tableName.matches("^[a-zA-Z_][a-zA-Z0-9_]*$")) {
            throw new BusinessException("非法表名");
        }
        String dbName = plainJdbc.queryForObject("SELECT DATABASE()", String.class);
        String sql = """
                SELECT COLUMN_NAME AS name, DATA_TYPE AS type, COLUMN_KEY AS `key`,
                       IS_NULLABLE AS nullable, COLUMN_COMMENT AS comment,
                       CHARACTER_MAXIMUM_LENGTH AS maxLength
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
                ORDER BY ORDINAL_POSITION ASC
                """;
        return plainJdbc.queryForList(sql, dbName, tableName);
    }

    private void saveParams(Long interfaceId, List<SysDataInterfaceParam> params) {
        if (params == null || params.isEmpty()) return;
        for (int i = 0; i < params.size(); i++) {
            SysDataInterfaceParam p = params.get(i);
            p.setId(null);
            p.setInterfaceId(interfaceId);
            p.setSortOrder(i);
            if (p.getRequired() == null) p.setRequired(false);
            paramMapper.insert(p);
        }
    }

    private void validateSql(String sql) {
        if (!StringUtils.hasText(sql)) throw new BusinessException("SQL内容不能为空");
        String upper = sql.trim().toUpperCase();
        boolean allowed = false;
        for (String prefix : ALLOWED_PREFIXES) {
            if (upper.startsWith(prefix + " ") || upper.startsWith(prefix + "(")) {
                allowed = true;
                break;
            }
        }
        if (!allowed) throw new BusinessException("SQL仅支持 SELECT/INSERT/UPDATE/DELETE 开头的语句");
        Matcher matcher = DANGEROUS_KEYWORD_PATTERN.matcher(sql);
        if (matcher.find()) {
            throw new BusinessException("SQL包含危险关键字: " + matcher.group());
        }
    }

    public Object execute(String method, String path, Map<String, Object> requestParams) {
        SysDataInterface api = interfaceMapper.selectByPathAndMethod(path, method.toUpperCase());
        if (api == null) throw new BusinessException("未找到接口配置: " + method + " " + path);
        if ("1".equals(api.getStatus())) throw new BusinessException("接口已停用");

        List<SysDataInterfaceParam> paramDefs = paramMapper.selectByInterfaceId(api.getId());
        validateRequiredParams(paramDefs, requestParams);

        Map<String, Object> resolvedParams = resolveParams(paramDefs, requestParams);
        String sql = translateSql(api.getSqlContent(), resolvedParams);

        log.info("[DynamicAPI] Executing: {} {}", method, path);
        log.info("[DynamicAPI] SQL: {}", sql);
        log.info("[DynamicAPI] Params: {}", resolvedParams);

        return executeByResultType(sql, resolvedParams, api.getResultType(), requestParams);
    }

    private void validateRequiredParams(List<SysDataInterfaceParam> paramDefs, Map<String, Object> requestParams) {
        for (SysDataInterfaceParam p : paramDefs) {
            if (Boolean.TRUE.equals(p.getRequired())) {
                Object val = requestParams.get(p.getParamName());
                if (val == null || (val instanceof String s && s.isEmpty())) {
                    throw new BusinessException("缺少必填参数: " + p.getParamName());
                }
            }
        }
    }

    private Map<String, Object> resolveParams(List<SysDataInterfaceParam> paramDefs, Map<String, Object> requestParams) {
        Map<String, Object> result = new HashMap<>();
        for (SysDataInterfaceParam p : paramDefs) {
            Object val = requestParams.get(p.getParamName());
            if (val == null || (val instanceof String s && s.isEmpty())) {
                if (StringUtils.hasText(p.getDefaultValue())) {
                    val = p.getDefaultValue();
                } else {
                    result.put(p.getParamName(), null);
                    continue;
                }
            }
            result.put(p.getParamName(), convertType(val, p.getType()));
        }
        Set<String> declared = paramDefs.stream().map(SysDataInterfaceParam::getParamName).collect(java.util.stream.Collectors.toSet());
        for (Map.Entry<String, Object> entry : requestParams.entrySet()) {
            if (!declared.contains(entry.getKey())) {
                result.put(entry.getKey(), entry.getValue());
            }
        }
        return result;
    }

    private Object convertType(Object val, String type) {
        if (val == null) return null;
        if (!(val instanceof String s)) return val;
        try {
            switch (type == null ? "String" : type) {
                case "Number" -> {
                    if (s.contains(".")) return Double.parseDouble(s);
                    return Long.parseLong(s);
                }
                case "Boolean" -> {
                    return "true".equalsIgnoreCase(s) || "1".equals(s);
                }
                default -> { return val; }
            }
        } catch (Exception e) {
            log.warn("类型转换失败: {} -> {}", val, type);
            return val;
        }
    }

    private String translateSql(String sql, Map<String, Object> params) {
        String result = sql;

        Matcher dynMatcher = DYNAMIC_PATTERN.matcher(result);
        StringBuffer dynSb = new StringBuffer();
        while (dynMatcher.find()) {
            String dynName = dynMatcher.group(1);
            Object dynVal = params.get(dynName);
            String replacement = dynVal != null ? dynVal.toString() : "";
            dynMatcher.appendReplacement(dynSb, Matcher.quoteReplacement(replacement));
        }
        dynMatcher.appendTail(dynSb);
        result = dynSb.toString();

        Matcher phMatcher = PLACEHOLDER_PATTERN.matcher(result);
        result = phMatcher.replaceAll(":$1");

        return result;
    }

    private Object executeByResultType(String sql, Map<String, Object> params, String resultType, Map<String, Object> rawParams) {
        MapSqlParameterSource paramSource = new MapSqlParameterSource(params);
        String upperSql = sql.trim().toUpperCase();

        if (upperSql.startsWith("INSERT") || upperSql.startsWith("UPDATE") || upperSql.startsWith("DELETE")) {
            int rows = jdbcTemplate.update(sql, paramSource);
            Map<String, Object> result = new HashMap<>();
            result.put("affectedRows", rows);
            return result;
        }

        if ("PAGE".equalsIgnoreCase(resultType)) {
            return executePage(sql, paramSource, rawParams);
        }

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql, paramSource);

        if ("SINGLE".equalsIgnoreCase(resultType)) {
            return rows.isEmpty() ? null : rows.get(0);
        }

        return rows;
    }

    private Object executePage(String sql, MapSqlParameterSource paramSource, Map<String, Object> rawParams) {
        int pageNum = 1;
        int pageSize = 10;
        Object pn = rawParams.get("pageNum");
        Object ps = rawParams.get("pageSize");
        if (pn != null) { try { pageNum = Integer.parseInt(pn.toString()); } catch (NumberFormatException ignored) {} }
        if (ps != null) { try { pageSize = Integer.parseInt(ps.toString()); } catch (NumberFormatException ignored) {} }
        if (pageNum < 1) pageNum = 1;
        if (pageSize < 1) pageSize = 10;

        int offset = (pageNum - 1) * pageSize;
        paramSource.addValue("offset", offset);
        paramSource.addValue("pageSize", pageSize);

        String countSql = "SELECT COUNT(*) FROM (" + stripOrderBy(sql) + ") AS _count_query";
        Long total = jdbcTemplate.queryForObject(countSql, paramSource, Long.class);
        if (total == null) total = 0L;

        String upperSql = sql.toUpperCase();
        String finalSql;
        if (upperSql.contains(" LIMIT ")) {
            finalSql = sql;
        } else {
            finalSql = sql + " LIMIT :offset, :pageSize";
        }
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(finalSql, paramSource);

        Map<String, Object> result = new HashMap<>();
        result.put("total", total);
        result.put("pageNum", pageNum);
        result.put("pageSize", pageSize);
        result.put("list", rows);
        return result;
    }

    private String stripOrderBy(String sql) {
        int idx = sql.toUpperCase().lastIndexOf(" ORDER BY ");
        if (idx > 0) return sql.substring(0, idx);
        return sql;
    }
}