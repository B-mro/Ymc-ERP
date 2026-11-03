package com.example.rbac.service;

import cn.hutool.core.io.FileUtil;
import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.example.rbac.common.BusinessException;
import com.example.rbac.common.PageResult;
import com.example.rbac.entity.SysFile;
import com.example.rbac.mapper.SysFileMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class SysFileService {

    private final SysFileMapper fileMapper;

    @Value("${file.base-dir:/www/wwwroot/default/files}")
    private String baseDir;

    @Value("${file.url-prefix:http://121.43.236.24/files/}")
    private String urlPrefix;

    private static final DateTimeFormatter DTF = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final Pattern INVALID_CHARS = Pattern.compile("[\\\\/:*?\"<>|]");

    private static final Set<String> EXCEL_EXTS = new HashSet<>(Arrays.asList("xls", "xlsx", "csv"));
    private static final Set<String> WORD_EXTS = new HashSet<>(Arrays.asList("doc", "docx"));
    private static final Set<String> IMAGE_EXTS = new HashSet<>(Arrays.asList("jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "ico"));
    private static final Set<String> PICTURE_EXTS = new HashSet<>(Arrays.asList("pdf"));

    private String resolveSubDir(String ext) {
        if (ext == null) return "other_files";
        String lower = ext.toLowerCase().trim();
        if (EXCEL_EXTS.contains(lower))  return "excel_files";
        if (WORD_EXTS.contains(lower))   return "word_files";
        if (IMAGE_EXTS.contains(lower) || PICTURE_EXTS.contains(lower)) return "picture_files";
        return "other_files";
    }

    private String sanitizeName(String raw) {
        if (raw == null || raw.isEmpty())
            return "untitled";
        String name = raw.replace("\\", "_").replace("/", "_").replace("..", "_");
        name = INVALID_CHARS.matcher(name).replaceAll("_");
        return name.trim();
    }

    private String resolveStoredName(File dir, String fileName) {
        File target = new File(dir, fileName);
        if (!target.exists())
            return fileName;
        String nameOnly = FileUtil.mainName(fileName);
        String ext = FileUtil.extName(fileName);
        String suffix = StringUtils.hasText(ext) ? "." + ext : "";
        int i = 1;
        while (true) {
            String candidate = nameOnly + "(" + i + ")" + suffix;
            if (!new File(dir, candidate).exists())
                return candidate;
            i++;
        }
    }

    private static final long MAX_FILE_SIZE = 50L * 1024 * 1024;

    public SysFile upload(MultipartFile file, Long uploadUserId) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("上传文件不能为空");
        }
        if (file.getSize() > MAX_FILE_SIZE) {
            throw new BusinessException("文件大小不能超过 50MB");
        }

        String originalName = file.getOriginalFilename();
        if (originalName == null) {
            originalName = "unknown";
        }
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

        SysFile sysFile = new SysFile();
        sysFile.setOriginalName(safeName);
        sysFile.setStoredName(storedName);
        sysFile.setFilePath(dest.getAbsolutePath());
        sysFile.setFileUrl(urlPrefix + subDir + "/" + storedName);
        sysFile.setFileSize(file.getSize());
        sysFile.setFileType(ext);
        sysFile.setCreateUser(String.valueOf(uploadUserId));
        sysFile.setCreateTime(LocalDateTime.now().format(DTF));
        fileMapper.insert(sysFile);

        return sysFile;
    }

    public PageResult<SysFile> page(Integer pageNum, Integer pageSize, String keyword, String fileType) {
        Page<SysFile> page = new Page<>(pageNum == null ? 1 : pageNum, pageSize == null ? 10 : pageSize);
        LambdaQueryWrapper<SysFile> wrapper = new LambdaQueryWrapper<>();
        wrapper.like(StringUtils.hasText(keyword), SysFile::getOriginalName, keyword)
               .eq(StringUtils.hasText(fileType), SysFile::getFileType, fileType)
               .orderByDesc(SysFile::getCreateTime);
        Page<SysFile> result = fileMapper.selectPage(page, wrapper);
        return new PageResult<>(result.getTotal(), result.getRecords());
    }

    public List<SysFile> list() {
        return fileMapper.selectList(null);
    }

    public SysFile getById(Long id) {
        SysFile file = fileMapper.selectById(id);
        if (file == null) {
            throw new BusinessException("文件不存在");
        }
        return file;
    }

    public void update(SysFile sysFile) {
        if (sysFile.getId() == null) {
            throw new BusinessException("文件ID不能为空");
        }
        SysFile existing = fileMapper.selectById(sysFile.getId());
        if (existing == null) {
            throw new BusinessException("文件不存在");
        }
        SysFile update = new SysFile();
        update.setId(sysFile.getId());
        if (StringUtils.hasText(sysFile.getOriginalName())) {
            update.setOriginalName(sysFile.getOriginalName());
        }
        update.setUpdateUser(String.valueOf(existing.getCreateUser()));
        update.setUpdateTime(LocalDateTime.now().format(DTF));
        fileMapper.updateById(update);
    }

    public void delete(Long id) {
        SysFile file = getById(id);
        FileUtil.del(new File(file.getFilePath()));
        fileMapper.deleteById(id);
    }
}