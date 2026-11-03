package com.example.rbac.controller;

import com.example.rbac.common.Result;
import com.example.rbac.dto.LoginDTO;
import com.example.rbac.dto.RegisterDTO;
import com.example.rbac.security.UserContext;
import com.example.rbac.service.AuthService;
import com.example.rbac.vo.UserInfoVO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@Tag(name = "认证管理")
@RestController
@RequestMapping("/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @Operation(summary = "登录（密码 BCrypt 校验）")
    @PostMapping("/login")
    public Result<Map<String, Object>> login(@Valid @RequestBody LoginDTO dto) {
        String token = authService.login(dto);
        Map<String, Object> data = new HashMap<>();
        data.put("token", token);
        return Result.ok(data);
    }

    @Operation(summary = "注册（默认普通用户角色）")
    @PostMapping("/register")
    public Result<Void> register(@Valid @RequestBody RegisterDTO dto) {
        authService.register(dto);
        return Result.ok();
    }

    @Operation(summary = "获取当前用户信息（角色/权限/动态菜单）")
    @GetMapping("/info")
    public Result<UserInfoVO> info() {
        return Result.ok(authService.getInfo(UserContext.getUserId()));
    }

    @Operation(summary = "退出登录")
    @PostMapping("/logout")
    public Result<Void> logout() {
        // JWT 无状态，前端清除 token 即可
        return Result.ok();
    }
}
