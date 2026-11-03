package com.example.rbac.security;

import com.example.rbac.common.BusinessException;
import com.example.rbac.common.Result;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
@RequiredArgsConstructor
public class JwtInterceptor implements HandlerInterceptor {

    private static final String BEARER = "Bearer ";

    private final JwtUtil jwtUtil;
    private final UserPermissionCache permissionCache;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        if (!(handler instanceof HandlerMethod handlerMethod)) {
            return true;
        }

        String header = request.getHeader("Authorization");
        if (!StringUtils.hasText(header) || !header.startsWith(BEARER)) {
            throw new BusinessException(Result.UNAUTHORIZED, "未登录或登录已过期");
        }
        String token = header.substring(BEARER.length()).trim();

        Claims claims;
        try {
            claims = jwtUtil.parse(token);
        } catch (Exception e) {
            throw new BusinessException(Result.UNAUTHORIZED, "登录状态无效，请重新登录");
        }

        Long userId = claims.get("userId", Long.class);
        String username = claims.getSubject();
        if (userId == null) {
            throw new BusinessException(Result.UNAUTHORIZED, "登录状态无效，请重新登录");
        }

        LoginUser loginUser = permissionCache.getOrLoad(userId);
        loginUser.setUsername(username);
        UserContext.set(loginUser);

        RequiresPermission annotation = handlerMethod.getMethodAnnotation(RequiresPermission.class);
        if (annotation != null) {
            if (!loginUser.isAdmin() && !loginUser.getPermissions().contains(annotation.value())) {
                throw new BusinessException(Result.FORBIDDEN, "没有访问权限：" + annotation.value());
            }
            UserContext.setCurrentPerms(annotation.value());
        } else {
            String headerPerms = request.getHeader("X-Current-Perms");
            if (StringUtils.hasText(headerPerms)) {
                UserContext.setCurrentPerms(headerPerms.trim());
            }
        }
        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response,
                                Object handler, Exception ex) {
        UserContext.clear();
    }
}