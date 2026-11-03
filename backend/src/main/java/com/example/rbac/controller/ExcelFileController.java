package com.example.rbac.controller;

import com.example.rbac.common.Result;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.File;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Tag(name = "Excel文件管理")
@RestController
@RequestMapping("/excel")
public class ExcelFileController {

    private static final DateTimeFormatter DTF = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    @Value("${excel.files.dir:/www/java/OnTracFedex/excel_files}")
    private String excelFilesDir;

    @Value("${excel.files.url-prefix:http://121.43.236.24/files/excel_files/}")
    private String urlPrefix;

    @Operation(summary = "查询excel_files目录下所有文件")
    @GetMapping("/files")
    public Result<List<Map<String, Object>>> list() {
        File dir = new File(excelFilesDir);
        List<Map<String, Object>> list = new ArrayList<>();
        if (!dir.exists() || !dir.isDirectory()) {
            return Result.ok(list);
        }
        File[] files = dir.listFiles(File::isFile);
        if (files == null) {
            return Result.ok(list);
        }
        for (File f : files) {
            Map<String, Object> item = new HashMap<>();
            String name = f.getName();
            item.put("fileName", name);
            item.put("fileUrl", urlPrefix + name);
            item.put("fileSize", f.length());
            int dot = name.lastIndexOf('.');
            item.put("fileType", dot > 0 ? name.substring(dot + 1).toLowerCase() : "");
            long lastModified = f.lastModified();
            if (lastModified > 0) {
                String time = LocalDateTime.ofInstant(
                        Instant.ofEpochMilli(lastModified), ZoneId.systemDefault()
                ).format(DTF);
                item.put("lastModified", time);
            } else {
                item.put("lastModified", null);
            }
            item.put("absolutePath", f.getAbsolutePath());
            list.add(item);
        }
        return Result.ok(list);
    }
}