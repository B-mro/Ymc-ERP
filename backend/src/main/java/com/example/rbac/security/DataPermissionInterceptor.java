package com.example.rbac.security;

import com.example.rbac.entity.SysDataScope;
import com.example.rbac.mapper.SysDataScopeMapper;
import com.example.rbac.mapper.SysRoleDataScopeMapper;
import lombok.extern.slf4j.Slf4j;
import org.apache.ibatis.executor.statement.StatementHandler;
import org.apache.ibatis.mapping.BoundSql;
import org.apache.ibatis.mapping.MappedStatement;
import org.apache.ibatis.mapping.SqlCommandType;
import org.apache.ibatis.plugin.Interceptor;
import org.apache.ibatis.plugin.Intercepts;
import org.apache.ibatis.plugin.Invocation;
import org.apache.ibatis.plugin.Plugin;
import org.apache.ibatis.plugin.Signature;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Component;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Properties;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Component
@Intercepts({
    @Signature(type = StatementHandler.class, method = "prepare", args = {java.sql.Connection.class, Integer.class})
})
public class DataPermissionInterceptor implements Interceptor {

    private final SysDataScopeMapper scopeMapper;
    private final SysRoleDataScopeMapper roleScopeMapper;

    private static final Pattern FROM_PATTERN = Pattern.compile(
            "FROM\\s+([`\\w]+)", Pattern.CASE_INSENSITIVE);

    private static final Pattern WHERE_PATTERN = Pattern.compile(
            "\\bWHERE\\b", Pattern.CASE_INSENSITIVE);

    private static final Set<String> SYSTEM_TABLES = Set.of(
            "sys_data_scope", "sys_role_data_scope", "sys_role", "sys_user",
            "sys_user_role", "sys_menu", "sys_role_menu", "sys_permission",
            "sys_role_permission", "sys_dict", "sys_dict_item", "sys_file",
            "sys_datainterface", "sys_interfaceclassification");

    public DataPermissionInterceptor(@Lazy SysDataScopeMapper scopeMapper,
                                     @Lazy SysRoleDataScopeMapper roleScopeMapper) {
        this.scopeMapper = scopeMapper;
        this.roleScopeMapper = roleScopeMapper;
    }

    @Override
    public Object intercept(Invocation invocation) throws Throwable {
        StatementHandler handler = (StatementHandler) invocation.getTarget();
        BoundSql boundSql = handler.getBoundSql();

        MappedStatement ms = resolveMappedStatement(handler);
        if (ms == null || ms.getSqlCommandType() != SqlCommandType.SELECT) {
            return invocation.proceed();
        }

        LoginUser user = UserContext.get();
        if (user == null || user.isAdmin()) {
            return invocation.proceed();
        }

        String originalSql = boundSql.getSql();
        String tableName = parseMainTable(originalSql);
        if (tableName == null || SYSTEM_TABLES.contains(tableName.toLowerCase())) {
            return invocation.proceed();
        }

        String roleCodes = user.getRoles().stream()
                .map(r -> "'" + r + "'")
                .collect(Collectors.joining(","));
        if (roleCodes.isEmpty()) {
            return invocation.proceed();
        }

        List<Long> scopeIds = roleScopeMapper.findScopeIdsByRoleCodes(roleCodes);
        if (scopeIds == null || scopeIds.isEmpty()) {
            return invocation.proceed();
        }

        List<SysDataScope> allScopes = scopeMapper.selectBatchIds(scopeIds);
        if (allScopes == null || allScopes.isEmpty()) {
            return invocation.proceed();
        }

        String currentPerms = UserContext.getCurrentPerms();
        SysDataScope matched = matchScope(allScopes, currentPerms, tableName);

        if (matched == null) {
            return invocation.proceed();
        }

        if ("ALL".equals(matched.getScopeType())) {
            return invocation.proceed();
        }

        String value = resolveValue(matched.getValueSource(), user);
        String newSql = appendCondition(originalSql, matched.getFieldName(), value);
        setSqlField(boundSql, newSql);
        log.info("[DataScope] perms={} table={} rule={} 改写 → {}",
                currentPerms, tableName, matched.getScopeName(), newSql);

        return invocation.proceed();
    }

    /**
     * 匹配数据权限规则，优先级：
     * 1. perms 精确匹配（菜单级，最优先）
     * 2. perms 为空 + tableName 匹配（表级，向后兼容）
     */
    private SysDataScope matchScope(List<SysDataScope> scopes, String currentPerms, String tableName) {
        List<SysDataScope> enabled = scopes.stream()
                .filter(s -> "0".equals(s.getStatus()))
                .collect(Collectors.toList());

        // 第一优先级：perms 精确匹配
        if (currentPerms != null && !currentPerms.isEmpty()) {
            List<SysDataScope> permsMatched = enabled.stream()
                    .filter(s -> currentPerms.equals(s.getPerms()))
                    .collect(Collectors.toList());
            if (!permsMatched.isEmpty()) {
                log.debug("[DataScope] 命中 perms 级规则: {} 条", permsMatched.size());
                return pickBest(permsMatched);
            }
        }

        // 第二优先级：perms 为空的规则 + tableName 匹配（向后兼容旧的表级规则）
        List<SysDataScope> tableMatched = enabled.stream()
                .filter(s -> (s.getPerms() == null || s.getPerms().isEmpty()))
                .filter(s -> tableName.equalsIgnoreCase(s.getTableName()))
                .collect(Collectors.toList());
        if (!tableMatched.isEmpty()) {
            log.debug("[DataScope] 命中 tableName 级规则: {} 条", tableMatched.size());
            return pickBest(tableMatched);
        }

        return null;
    }

    private void setSqlField(BoundSql boundSql, String newSql) throws Exception {
        Field field = BoundSql.class.getDeclaredField("sql");
        field.setAccessible(true);
        field.set(boundSql, newSql);
    }

    private MappedStatement resolveMappedStatement(StatementHandler handler) {
        try {
            Object target = handler;
            Field delegateField = findField(target.getClass(), "delegate");
            if (delegateField != null) {
                delegateField.setAccessible(true);
                target = delegateField.get(target);
            }
            Field msField = findField(target.getClass(), "mappedStatement");
            if (msField != null) {
                msField.setAccessible(true);
                return (MappedStatement) msField.get(target);
            }
        } catch (Exception e) {
            log.warn("resolveMappedStatement failed", e);
        }
        return null;
    }

    private Field findField(Class<?> clazz, String name) {
        Class<?> c = clazz;
        while (c != null && c != Object.class) {
            try {
                return c.getDeclaredField(name);
            } catch (NoSuchFieldException ignored) {
                c = c.getSuperclass();
            }
        }
        return null;
    }

    @Override
    public Object plugin(Object target) {
        return Plugin.wrap(target, this);
    }

    @Override
    public void setProperties(Properties properties) {
    }

    private String parseMainTable(String sql) {
        String cleaned = sql.replaceAll("/\\*.*?\\*/", " ").replaceAll("\\s+", " ");
        Matcher m = FROM_PATTERN.matcher(cleaned);
        if (m.find()) {
            return m.group(1).replace("`", "");
        }
        return null;
    }

    private SysDataScope pickBest(List<SysDataScope> scopes) {
        return scopes.stream()
                .min((a, b) -> rank(a.getScopeType()) - rank(b.getScopeType()))
                .orElse(scopes.get(0));
    }

    private int rank(String type) {
        return switch (type) {
            case "ALL" -> 1;
            case "DEPT" -> 2;
            case "SELF" -> 3;
            default -> 99;
        };
    }

    private String resolveValue(String source, LoginUser user) {
        if ("USERID".equalsIgnoreCase(source)) {
            return String.valueOf(user.getUserId());
        }
        return user.getUsername();
    }

    private String appendCondition(String sql, String field, String value) {
        String condition = field + " = '" + value.replace("'", "''") + "'";
        String trimmed = sql.trim();
        int searchFrom = findMainTableEnd(trimmed);

        int whereIdx = -1;
        Matcher m = WHERE_PATTERN.matcher(trimmed);
        while (m.find()) {
            if (m.start() >= searchFrom) {
                whereIdx = m.start();
                break;
            }
        }

        if (whereIdx >= 0) {
            int insertAt = whereIdx + 6;
            return trimmed.substring(0, insertAt) + condition + " AND " + trimmed.substring(insertAt);
        }
        return trimmed + " WHERE " + condition;
    }

    private int findMainTableEnd(String sql) {
        Matcher m = FROM_PATTERN.matcher(sql);
        if (m.find()) {
            return m.end();
        }
        return 0;
    }
}