package com.example.rbac.service;

import cn.hutool.core.io.FileUtil;
import com.example.rbac.common.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.util.*;
import java.util.regex.Pattern;

@Service
public class CustomerFileService {

    @Value("${customer-file.base-dir:/www/java/customerFile}")
    private String baseDir;

    @Value("${customer-file.url-prefix:http://121.43.236.24/files/customerFile/}")
    private String urlPrefix;

    private static final Set<String> IMAGE_EXTS = new HashSet<>(Arrays.asList(
            "jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "ico"
    ));

    private static final Set<String> FILE_EXTS = new HashSet<>(Arrays.asList(
            "doc", "docx", "xls", "xlsx", "ppt", "pptx", "pdf", "txt", "csv", "zip", "rar", "7z"
    ));

    private static final long MAX_FILE_SIZE = 100L * 1024 * 1024;
    private static final Pattern INVALID_CHARS = Pattern.compile("[\\\\/:*?\"<>|]");

    public Map<String, Object> upload(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("上传文件不能为空");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BusinessException("文件大小不能超过 100MB");
        }

        String originalName = file.getOriginalFilename();
        if (originalName == null) originalName = "untitled";

        String safeName = sanitizeName(new File(originalName).getName());
        String ext = FileUtil.extName(safeName);
        String subDir = resolveSubDir(ext);

        File dir = new File(baseDir, subDir);
        if (!dir.exists() && !dir.mkdirs()) {
            throw new BusinessException("创建存储目录失败: " + dir.getAbsolutePath());
        }

        String storedName = resolveStoredName(dir, safeName);
        File dest = new File(dir, storedName);
        try {
            file.transferTo(dest);
        } catch (IOException e) {
            throw new BusinessException("文件保存失败: " + e.getMessage());
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("originalName", safeName);
        result.put("storedName", storedName);
        result.put("fileUrl", urlPrefix + subDir + "/" + storedName);
        result.put("filePath", dest.getAbsolutePath());
        result.put("fileSize", file.getSize());
        result.put("fileType", ext);
        result.put("isImage", IMAGE_EXTS.contains(ext == null ? "" : ext.toLowerCase()));
        return result;
    }

    public List<Map<String, Object>> uploadBatch(MultipartFile[] files) {
        List<Map<String, Object>> results = new ArrayList<>();
        if (files == null) return results;
        for (MultipartFile file : files) {
            if (file != null && !file.isEmpty()) {
                results.add(upload(file));
            }
        }
        return results;
    }

    private String resolveSubDir(String ext) {
        if (ext == null) return "wordFile";
        String lower = ext.toLowerCase().trim();
        if (IMAGE_EXTS.contains(lower)) return "pictureFile";
        return "wordFile";
    }

    private String sanitizeName(String raw) {
        if (raw == null || raw.isEmpty()) return "untitled";
        String name = raw.replace("\\", "_").replace("/", "_").replace("..", "_");
        name = INVALID_CHARS.matcher(name).replaceAll("_");
        return name.trim();
    }

    private String resolveStoredName(File dir, String fileName) {
        File target = new File(dir, fileName);
        if (!target.exists()) return fileName;
        String nameOnly = FileUtil.mainName(fileName);
        String ext = FileUtil.extName(fileName);
        String suffix = ext != null && !ext.isEmpty() ? "." + ext : "";
        int i = 1;
        while (true) {
            String candidate = nameOnly + "(" + i + ")" + suffix;
            if (!new File(dir, candidate).exists()) return candidate;
            i++;
        }
    }
}