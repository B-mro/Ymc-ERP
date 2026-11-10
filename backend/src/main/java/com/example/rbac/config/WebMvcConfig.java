package com.example.rbac.config;

import com.example.rbac.security.JwtInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.io.File;
import java.util.Arrays;
import java.util.List;

@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final JwtInterceptor jwtInterceptor;

    @Value("${cors.allowed-origins:http://localhost:6662,http://localhost:5173,http://localhost:8080}")
    private List<String> allowedOrigins;

    @Value("${knife4j.enable:true}")
    private boolean knife4jEnabled;

    @Value("${file.base-dir:/www/wwwroot/default/files}")
    private String fileBaseDir;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        List<String> exclude = new java.util.ArrayList<>(Arrays.asList(
                "/auth/login",
                "/auth/register",
                "/favicon.ico",
                "/error",
                "/files/**",
                "/fedex/**",
                "/ontrac/**",
                "/ups/**"
        ));

        if (knife4jEnabled) {
            exclude.addAll(Arrays.asList(
                    "/doc.html",
                    "/swagger-ui.html",
                    "/swagger-ui/**",
                    "/v3/api-docs/**",
                    "/v2/api-docs/**",
                    "/webjars/**",
                    "/swagger-resources/**"
            ));
        }

        registry.addInterceptor(jwtInterceptor)
                .addPathPatterns("/**")
                .excludePathPatterns(exclude);
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**")
                .allowedOriginPatterns(allowedOrigins.toArray(new String[0]))
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .exposedHeaders("Authorization")
                .allowCredentials(true)
                .maxAge(3600);
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String absolutePath = new File(fileBaseDir).getAbsolutePath();
        registry.addResourceHandler("/files/**")
                .addResourceLocations("file:" + absolutePath + File.separator);
    }
}