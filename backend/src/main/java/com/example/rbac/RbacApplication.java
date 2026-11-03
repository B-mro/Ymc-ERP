package com.example.rbac;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@MapperScan("com.example.rbac.mapper")
@EnableScheduling
public class RbacApplication {

    public static void main(String[] args) {
        ConfigurableApplicationContext context = SpringApplication.run(RbacApplication.class, args);
        printStartupBanner(context);
    }

    private static void printStartupBanner(ConfigurableApplicationContext context) {
        String port = context.getEnvironment().getProperty("server.port", "8080");
        String contextPath = context.getEnvironment().getProperty("server.servlet.context-path", "");
        String banner = "\n" +
                "----------------------------------------------------------\n" +
                "  Rbac-Admin 后端启动成功\n" +
                "  API 接口文档: http://localhost:" + port + contextPath + "/doc.html\n" +
                "----------------------------------------------------------";
        System.out.println(banner);
    }
}