package com.example.rbac.controller;

import com.example.rbac.service.DataInterfaceService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;

@Slf4j
@RestController
@RequestMapping("/dapi")
@RequiredArgsConstructor
public class DynamicApiController {

    private final DataInterfaceService apiService;

    @GetMapping("/**")
    public Object get(HttpServletRequest request) {
        return handle("GET", request, null);
    }

    @PostMapping("/**")
    public Object post(HttpServletRequest request, @RequestBody(required = false) Map<String, Object> body) {
        return handle("POST", request, body);
    }

    @PutMapping("/**")
    public Object put(HttpServletRequest request, @RequestBody(required = false) Map<String, Object> body) {
        return handle("PUT", request, body);
    }

    @DeleteMapping("/**")
    public Object delete(HttpServletRequest request) {
        return handle("DELETE", request, null);
    }

    private Object handle(String method, HttpServletRequest request) {
        return handle(method, request, null);
    }

    private Object handle(String method, HttpServletRequest request, Map<String, Object> body) {
        String fullPath = request.getRequestURI();
        String contextPath = request.getContextPath();
        String dapiPrefix = contextPath + "/dapi";
        String path = fullPath.substring(dapiPrefix.length());
        int queryIdx = path.indexOf('?');
        if (queryIdx >= 0) path = path.substring(0, queryIdx);

        Map<String, Object> params = new HashMap<>();
        Enumeration<String> paramNames = request.getParameterNames();
        while (paramNames.hasMoreElements()) {
            String key = paramNames.nextElement();
            params.put(key, request.getParameter(key));
        }
        if (body != null) params.putAll(body);

        return apiService.execute(method, path, params);
    }
}