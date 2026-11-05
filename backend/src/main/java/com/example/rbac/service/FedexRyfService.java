package com.example.rbac.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.example.rbac.dto.OnTracFuelSurchargeRate;
import com.example.rbac.entity.FedexRyf;
import com.example.rbac.mapper.FedexRyfMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.options.WaitUntilState;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoField;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class FedexRyfService {

    private final FedexRyfMapper fedexRyfMapper;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${playwright.chromium.path:}")
    private String chromiumPath;

    private static final String FEDEX_SURCHARGES_PAGE =
            "https://www.fedex.com/en-us/shipping/historical-fuel-surcharge.html";

    private static final Pattern JSONP_CALLBACK_PATTERN =
            Pattern.compile("^[a-zA-Z_$][\\w$]*(?:\\.[a-zA-Z_$][\\w$]*)*\\((.*)\\)\\s*;?\\s*$", Pattern.DOTALL);

    private static final DateTimeFormatter DATE_OUT_FORMAT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private static final DateTimeFormatter[] DATE_IN_FORMATS = {
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("MM/dd/yyyy"),
            DateTimeFormatter.ofPattern("MMMM d, yyyy", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("MMMM dd, yyyy", Locale.ENGLISH),
            DateTimeFormatter.ofPattern("MMM dd, yyyy", Locale.ENGLISH),
            new DateTimeFormatterBuilder()
                    .appendPattern("MMMM")
                    .appendLiteral(' ')
                    .appendValue(ChronoField.DAY_OF_MONTH)
                    .appendLiteral(',')
                    .appendLiteral(' ')
                    .appendValue(ChronoField.YEAR)
                    .toFormatter(Locale.ENGLISH),
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss"),
            DateTimeFormatter.ISO_LOCAL_DATE,
            DateTimeFormatter.ISO_OFFSET_DATE_TIME
    };

    @Transactional
    public int syncSurchargeData() {
        System.out.println("========================================");
        System.out.println("[FedexRyfService.syncSurchargeData] >>> 进入方法");
        System.out.println("========================================");

        System.out.println("[FedexRyfService.syncSurchargeData] >>> 调用fetchSurchargeDataViaPlaywright()抓取数据...");
        List<FedexRyf> records = fetchSurchargeDataViaPlaywright();
        System.out.println("[FedexRyfService.syncSurchargeData] >>> fetchSurchargeDataViaPlaywright()返回 " + records.size() + " 条记录");

        int upserted = 0;
        if (!records.isEmpty()) {
            System.out.println("[FedexRyfService.syncSurchargeData] >>> 开始upsert...");
            for (FedexRyf record : records) {
                List<FedexRyf> existing = fedexRyfMapper.selectList(
                        new LambdaQueryWrapper<FedexRyf>()
                                .eq(FedexRyf::getStart, record.getStart())
                                .eq(FedexRyf::getEnd, record.getEnd())
                );
                if (existing != null && !existing.isEmpty()) {
                    FedexRyf old = existing.get(0);
                    old.setRate(record.getRate());
                    fedexRyfMapper.updateById(old);
                    System.out.println("[FedexRyfService.syncSurchargeData] >>> 已更新: start=" + record.getStart() + ", end=" + record.getEnd() + ", rate=" + record.getRate());
                } else {
                    fedexRyfMapper.insert(record);
                    System.out.println("[FedexRyfService.syncSurchargeData] >>> 已插入: start=" + record.getStart() + ", end=" + record.getEnd() + ", rate=" + record.getRate());
                }
                upserted++;
            }
        }

        System.out.println("[FedexRyfService.syncSurchargeData] <<< 方法结束, upsert " + upserted + " 条");
        System.out.println("========================================");
        return upserted;
    }

    private String antiDetectionInitScript() {
        return "() => {"
                + "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
                + "Object.defineProperty(navigator, 'plugins', {"
                + "  get: () => Object.assign([1,2,3,4,5], {"
                + "    item: () => null,"
                + "    namedItem: () => null,"
                + "    refresh: () => {}"
                + "  })"
                + "});"
                + "Object.defineProperty(navigator, 'mimeTypes', {"
                + "  get: () => Object.assign([1,2], {"
                + "    item: () => null,"
                + "    namedItem: () => null"
                + "  })"
                + "});"
                + "Object.defineProperty(navigator, 'languages', {get: () => ['en-US','en']});"
                + "Object.defineProperty(navigator, 'language', {get: () => 'en-US'});"
                + "Object.defineProperty(navigator, 'hardwareConcurrency', {get: () => 8});"
                + "Object.defineProperty(navigator, 'platform', {get: () => 'Win32'});"
                + "Object.defineProperty(navigator, 'deviceMemory', {get: () => 8});"
                + "Object.defineProperty(navigator, 'maxTouchPoints', {get: () => 0});"
                + "window.chrome = {"
                + "  runtime: {},"
                + "  loadTimes: function() {},"
                + "  csi: function() {},"
                + "  app: {}"
                + "};"
                + "const origQuery = window.navigator.permissions.query;"
                + "window.navigator.permissions.query = (parameters) => ("
                + "  parameters.name === 'notifications'"
                + "    ? Promise.resolve({state: Notification.permission, onchange: null})"
                + "    : origQuery(parameters)"
                + ");"
                + "Object.defineProperty(screen, 'availWidth', {get: () => 1920});"
                + "Object.defineProperty(screen, 'availHeight', {get: () => 1040});"
                + "Object.defineProperty(screen, 'colorDepth', {get: () => 24});"
                + "Object.defineProperty(screen, 'pixelDepth', {get: () => 24});"
                + "Object.defineProperty(window, 'outerWidth', {get: () => 1920});"
                + "Object.defineProperty(window, 'outerHeight', {get: () => 1080});"
                + "Object.defineProperty(navigator, 'connection', {"
                + "  get: () => ({effectiveType: '4g', rtt: 50, downlink: 10, saveData: false, onchange: null})"
                + "});"
                + "if (!navigator.getBattery) {"
                + "  navigator.getBattery = () => Promise.resolve({"
                + "    charging: true, chargingTime: 0, dischargingTime: Infinity,"
                + "    level: 1, onchargingchange: null, onlevelchange: null"
                + "  });"
                + "}"
                + "const getParam = WebGLRenderingContext.prototype.getParameter;"
                + "WebGLRenderingContext.prototype.getParameter = function(p) {"
                + "  if (p === 37445) return 'Intel Inc.';"
                + "  if (p === 37446) return 'Intel Iris OpenGL Engine';"
                + "  return getParam.call(this, p);"
                + "};"
                + "}";
    }

    private List<FedexRyf> fetchSurchargeDataViaPlaywright() {
        List<FedexRyf> records = new ArrayList<>();

        try (Playwright playwright = Playwright.create()) {
            Browser browser = launchBrowser(playwright);

            BrowserContext context = browser.newContext(
                    new Browser.NewContextOptions()
                            .setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                                    + "AppleWebKit/537.36 (KHTML, like Gecko) "
                                    + "Chrome/114.0.0.0 Safari/537.36")
                            .setLocale("en-US")
                            .setViewportSize(1920, 1080)
                            .setGeolocation(37.7749, -122.4194)
                            .setTimezoneId("America/Chicago")
                            .setPermissions(List.of("geolocation"))
            );

            Page page = context.newPage();
            page.setDefaultNavigationTimeout(60_000);

            page.addInitScript(antiDetectionInitScript());

            log.info("Playwright导航到: {}", FEDEX_SURCHARGES_PAGE);
            page.navigate(FEDEX_SURCHARGES_PAGE, new Page.NavigateOptions()
                    .setWaitUntil(WaitUntilState.LOAD));
            log.info("页面导航完成, 当前URL: {}", page.url());
            page.waitForTimeout(5000);

            String finalUrl = page.url();
            String pageTitle = page.title();
            String html = page.content();

            System.out.println("========== FedEx 页面 HTML 开始 ==========");
            System.out.println("URL: " + finalUrl);
            System.out.println("Title: " + pageTitle);
            System.out.println(html);
            System.out.println("========== FedEx 页面 HTML 结束 ==========");

            // 提取 <tbody>...</tbody> 内容（跨行匹配）
            java.util.regex.Matcher tbodyMatcher = TBODY_PATTERN.matcher(html);
            if (tbodyMatcher.find()) {
                String tbodyContent = tbodyMatcher.group(1);
                log.info("找到tbody内容, 长度: {}", tbodyContent.length());

                // 提取每一行 <tr>...</tr>
                java.util.regex.Matcher trMatcher = TR_PATTERN.matcher(tbodyContent);
                while (trMatcher.find()) {
                    String trContent = trMatcher.group(1);

                    // 提取 <td> 内容（去掉HTML标签属性）
                    java.util.regex.Matcher tdMatcher = TD_PATTERN.matcher(trContent);
                    List<String> cells = new ArrayList<>();
                    while (tdMatcher.find()) {
                        cells.add(tdMatcher.group(1).trim());
                    }

                    if (cells.size() >= 2) {
                        log.info("解析行: {}", String.join(" | ", cells));
                        FedexRyf record = parseFedexRow(cells.get(0), cells.get(1));
                        if (record != null) {
                            records.add(record);
                        }
                    }
                }
            } else {
                log.warn("未找到<tbody>标签, HTML长度: {}", html.length());
            }

            log.info("共解析到{}条FedEx费率记录", records.size());

        } catch (Exception e) {
            log.error("Playwright操作失败", e);
            throw new RuntimeException("Playwright抓取FedEx数据失败: " + e.getMessage(), e);
        }

        return records;
    }

    // 匹配 <tbody>...</tbody>（跨行）
    private static final java.util.regex.Pattern TBODY_PATTERN =
            java.util.regex.Pattern.compile("<tbody[^>]*>(.*?)</tbody>",
                    java.util.regex.Pattern.DOTALL | java.util.regex.Pattern.CASE_INSENSITIVE);

    // 匹配 <tr>...</tr>（跨行）
    private static final java.util.regex.Pattern TR_PATTERN =
            java.util.regex.Pattern.compile("<tr[^>]*>(.*?)</tr>",
                    java.util.regex.Pattern.DOTALL | java.util.regex.Pattern.CASE_INSENSITIVE);

    // 匹配 <td ...>内容</td>
    private static final java.util.regex.Pattern TD_PATTERN =
            java.util.regex.Pattern.compile("<td[^>]*>(.*?)</td>",
                    java.util.regex.Pattern.DOTALL | java.util.regex.Pattern.CASE_INSENSITIVE);

    // 解析日期范围: "Oct. 19, 2026–Oct. 25, 2026" 或 "Oct. 19, 2026 - Oct. 25, 2026"
    private static final java.util.regex.Pattern FEDEX_DATE_RANGE_PATTERN =
            java.util.regex.Pattern.compile(
                    "([A-Za-z]{3,9})\\.?\\s*(\\d{1,2}),?\\s*(\\d{4})"
                    + "\\s*[–\\-]\\s*"
                    + "([A-Za-z]{3,9})\\.?\\s*(\\d{1,2}),?\\s*(\\d{4})");

    // 月份缩写 → 数字
    private static final java.util.Map<String, String> MONTH_MAP = new java.util.LinkedHashMap<>();
    static {
        String[][] months = {
            {"january", "01"}, {"february", "02"}, {"march", "03"},
            {"april", "04"}, {"may", "05"}, {"june", "06"},
            {"july", "07"}, {"august", "08"}, {"september", "09"},
            {"october", "10"}, {"november", "11"}, {"december", "12"}
        };
        for (String[] m : months) {
            MONTH_MAP.put(m[0], m[1]);
            MONTH_MAP.put(m[0].substring(0, 3), m[1]); // jan, feb, mar...
            MONTH_MAP.put(m[0].substring(0, 3) + ".", m[1]); // jan., feb., mar....
        }
    }

    private String parseFedexDate(String raw) {
        if (raw == null || raw.isEmpty()) return null;
        String cleaned = raw.trim().replaceAll("\\s+", " ");
        for (java.util.Map.Entry<String, String> entry : MONTH_MAP.entrySet()) {
            if (cleaned.toLowerCase().startsWith(entry.getKey())) {
                String rest = cleaned.substring(entry.getKey().length()).replaceAll("[^0-9]", " ").trim();
                String[] parts = rest.split("\\s+");
                if (parts.length >= 2) {
                    try {
                        int day = Integer.parseInt(parts[0]);
                        int year = Integer.parseInt(parts[1]);
                        return String.format("%d-%s-%02d", year, entry.getValue(), day);
                    } catch (NumberFormatException ignored) { }
                }
            }
        }
        return null;
    }

    private FedexRyf parseFedexRow(String dateCell, String rateCell) {
        java.util.regex.Matcher m = FEDEX_DATE_RANGE_PATTERN.matcher(dateCell);
        if (!m.find()) {
            log.warn("日期格式不匹配: {}", dateCell);
            return null;
        }

        // "Oct. 19, 2026" → parseFedexDate
        String startRaw = m.group(1) + ". " + m.group(2) + ", " + m.group(3);
        String endRaw = m.group(4) + ". " + m.group(5) + ", " + m.group(6);

        String start = parseFedexDate(startRaw);
        String end = parseFedexDate(endRaw);

        if (start == null || end == null) {
            log.warn("日期解析失败: {} | {}", startRaw, endRaw);
            return null;
        }

        // "28.75%" → 0.2875
        String numStr = rateCell.replaceAll("[^0-9.]", "");
        if (numStr.isEmpty()) {
            log.warn("费率解析失败: {}", rateCell);
            return null;
        }

        double rate;
        try {
            rate = Double.parseDouble(numStr) / 100.0;
        } catch (NumberFormatException e) {
            log.warn("费率数字解析失败: {}", rateCell);
            return null;
        }

        FedexRyf record = new FedexRyf();
        record.setStart(start);
        record.setEnd(end);
        record.setRate(rate);

        log.info("解析成功: {} ~ {} => {}", start, end, rate);
        return record;
    }

    private boolean isRealBrowserBinary(Path p) {
        if (!Files.isReadable(p)) {
            return false;
        }
        try {
            byte[] header = new byte[4];
            try (java.io.InputStream in = Files.newInputStream(p)) {
                int read = in.read(header);
                if (read < 2) return false;
            }
            // ELF 二进制 (Linux): 0x7F 'E' 'L' 'F'
            if (header[0] == 0x7F && header[1] == 'E' && header[2] == 'L' && header[3] == 'F') {
                return true;
            }
            // PE 二进制 (Windows): 'M' 'Z'
            if (header[0] == 'M' && header[1] == 'Z') {
                String name = p.getFileName().toString().toLowerCase();
                return name.endsWith(".exe");
            }
            // shell 脚本以 '#' '!' 开头，直接跳过
            if (header[0] == '#' && header[1] == '!') {
                log.warn("[BROWSER] 跳过shell包装脚本: {}", p);
                return false;
            }
        } catch (Exception e) {
            log.warn("[BROWSER] 读取文件头失败: {} -> {}", p, e.getMessage());
        }
        return false;
    }

    private Browser launchBrowser(Playwright playwright) {
        List<String> args = new ArrayList<>(List.of(
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--disable-blink-features=AutomationControlled",
                "--disable-features=IsolateOrigins,site-per-process",
                "--disable-site-isolation-trials",
                "--disable-web-security",
                "--disable-features=BlockInsecurePrivateNetworkRequests",
                "--disable-ipc-flooding-protection",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-default-apps",
                "--disable-component-extensions-with-background-pages",
                "--disable-client-side-phishing-detection",
                "--disable-sync",
                "--metrics-recording-only",
                "--disable-breakpad",
                "--disable-hang-monitor",
                "--disable-popup-blocking",
                "--disable-prompt-on-repost",
                "--disable-domain-reliability",
                "--disable-component-update",
                "--no-pings",
                "--no-crash-upload",
                "--disable-infobars",
                "--window-size=1920,1080",
                "--disable-features=TranslateUI",
                "--disable-field-trial-config",
                "--disable-background-networking",
                "--disable-background-timer-throttling",
                "--disable-backgrounding-occluded-windows",
                "--disable-renderer-backgrounding",
                "--force-color-profile=srgb",
                "--disable-features=site-per-process,IsolateOrigins"
        ));

        boolean isWindows = System.getProperty("os.name", "").toLowerCase().contains("win");
        if (isWindows) {
            for (String candidate : AUTO_DETECT_BROWSER_PATHS) {
                if (isRealBrowserBinary(Path.of(candidate))) {
                    log.warn("[BROWSER] 使用系统Chrome channel: {}", candidate);
                    try {
                        return playwright.chromium().launch(
                                new BrowserType.LaunchOptions()
                                        .setChannel("chrome")
                                        .setHeadless(true)
                                        .setArgs(args)
                        );
                    } catch (Exception e) {
                        log.warn("[BROWSER] channel('chrome') 失败，回退路径检测: {}", e.getMessage());
                        break;
                    }
                }
            }
        }

        if (chromiumPath != null && !chromiumPath.isEmpty()) {
            Path cfgPath = Path.of(chromiumPath);
            if (isRealBrowserBinary(cfgPath)) {
                log.warn("[BROWSER] 使用配置路径: {}", chromiumPath);
                return playwright.chromium().launch(
                        new BrowserType.LaunchOptions()
                                .setHeadless(true)
                                .setExecutablePath(cfgPath)
                                .setArgs(args)
                );
            }
            log.warn("[BROWSER] 配置路径无效: {}", chromiumPath);
        }

        for (String candidate : AUTO_DETECT_BROWSER_PATHS) {
            Path p = Path.of(candidate);
            if (isRealBrowserBinary(p)) {
                log.warn("[BROWSER] 自动检测: {}", candidate);
                return playwright.chromium().launch(
                        new BrowserType.LaunchOptions()
                                .setHeadless(true)
                                .setExecutablePath(p)
                                .setArgs(args)
                );
            }
        }

        // 自动扫描 Playwright 缓存中的 Chromium（Linux + Windows）
        Path[] playwrightCacheDirs = {
                Path.of(System.getProperty("user.home"), ".cache/ms-playwright"),          // Linux
                Path.of(System.getenv("LOCALAPPDATA"), "ms-playwright"),                    // Windows
        };
        String[][] platformChromiumPaths = {
                {"chrome-linux64/chrome", "chrome-linux/chrome"},
                {"chrome-win/chrome.exe", "chrome-win64/chrome.exe"},
        };

        for (int i = 0; i < playwrightCacheDirs.length; i++) {
            Path cacheDir = playwrightCacheDirs[i];
            if (cacheDir == null || !Files.isDirectory(cacheDir)) continue;

            try {
                java.util.stream.Stream<Path> dirs = Files.list(cacheDir);
                for (Path dir : dirs.toList()) {
                    String name = dir.getFileName().toString();
                    if (name.startsWith("chromium-") && !name.contains("headless")) {
                        for (String relPath : platformChromiumPaths[i]) {
                            Path chrome = dir.resolve(relPath);
                            if (isRealBrowserBinary(chrome)) {
                                log.warn("[BROWSER] Playwright缓存: {}", chrome);
                                return playwright.chromium().launch(
                                        new BrowserType.LaunchOptions()
                                                .setHeadless(true)
                                                .setExecutablePath(chrome)
                                                .setArgs(args)
                                );
                            }
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("扫描Playwright缓存失败: {}", e.getMessage());
            }
        }

        log.warn("未找到本地Chrome/Edge，回退到Playwright内置Chromium");
        return playwright.chromium().launch(
                new BrowserType.LaunchOptions()
                        .setHeadless(true)
                        .setArgs(args)
        );
    }

    private static final String[] AUTO_DETECT_BROWSER_PATHS = {
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
            "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
            System.getenv("LOCALAPPDATA") + "\\Google\\Chrome\\Application\\chrome.exe",
            "/usr/bin/google-chrome",
            "/usr/bin/chromium-browser",
            "/snap/bin/chromium",
    };

    private void clickShowMore(Page page) {
        try {
            page.evaluate("() => {"
                    + "const btns = document.querySelectorAll('button, a, span, div');"
                    + "for (const btn of btns) {"
                    + "  const t = (btn.textContent || '').trim();"
                    + "  if (t === '显示更多' || t === 'Show more') {"
                    + "    btn.click();"
                    + "    console.log('已点击:' + t);"
                    + "    return true;"
                    + "  }"
                    + "}"
                    + "return false;"
                    + "}");
            // log.warn("[DOM] 已尝试点击'显示更多'");
        } catch (Exception e) {
            // log.warn("[DOM] 点击'显示更多'失败: {}", e.getMessage());
        }
    }

    private List<FedexRyf> extractTableFromDom(Page page) {
        List<FedexRyf> records = new ArrayList<>();
        try {
            List<List<String>> rows = (List<List<String>>) page.evaluate(
                    "() => {"
                    + "const results = [];"
                    + "const tables = document.querySelectorAll('table');"
                    + "for (const tbl of tables) {"
                    + "  const rows = tbl.querySelectorAll('tr');"
                    + "  for (const tr of rows) {"
                    + "    const cells = tr.querySelectorAll('td, th');"
                    + "    if (cells.length >= 2) {"
                    + "      const rowData = [];"
                    + "      for (const td of cells) {"
                    + "        rowData.push((td.textContent || '').trim());"
                    + "      }"
                    + "      results.push(rowData);"
                    + "    }"
                    + "  }"
                    + "}"
                    + "return results;"
                    + "}"
            );

            for (List<String> row : rows) {
                // log.warn("[TABLE] 行: {}", String.join(" | ", row));
                if (row.size() >= 3) {
                    FedexRyf r = parseRateRow(row);
                    if (r != null) {
                        records.add(r);
                    }
                }
            }

            // log.warn("[TABLE] 共提取{}行，匹配到{}条费率", rows.size(), records.size());
        } catch (Exception e) {
            // log.warn("[TABLE] DOM提取异常: {}", e.getMessage());
        }
        return records;
    }

    private FedexRyf parseRateRow(List<String> cells) {
        String combined = String.join(" ", cells);

        // 预处理：将中文"年月日"格式统一转为"日 月 年"，让现有正则能匹配
        // "2026年10月02日 – 2026年11月08日" → "02 10 2026 - 08 11 2026"
        combined = combined.replaceAll(
                "(\\d{4})\\s*年\\s*(\\d{1,2})\\s*月\\s*(\\d{1,2})\\s*日",
                "$3 $2 $1");

        java.util.regex.Matcher m = DATE_RANGE_PATTERN.matcher(combined);
        if (m.find()) {
            FedexRyf r = new FedexRyf();
            String rawStart = m.group(1) + " " + m.group(2) + ", " + m.group(3);
            String rawEnd = m.group(4) + " " + m.group(5) + ", " + m.group(6);
            // log.warn("[PARSE] rawStart={}, rawEnd={}", rawStart, rawEnd);
            r.setStart(normalizeDate(rawStart));
            r.setEnd(normalizeDate(rawEnd));
            for (String cell : cells) {
                if (cell.contains("$") || cell.contains("元")) continue;
                String num = cell.replaceAll("[^0-9.]", "");
                if (!num.isEmpty()) {
                    try {
                        double rate = Double.parseDouble(num);
                        if (rate > 0 && rate < 200) {
                            r.setRate(rate / 100.0);
                            break;
                        }
                    } catch (NumberFormatException ignored) { }
                }
            }
            return r;
        }

        // 兜底：直接尝试中文年月日日期范围
        m = CN_DATE_RANGE_PATTERN.matcher(combined);
        if (m.find()) {
            FedexRyf r = new FedexRyf();
            r.setStart(String.format("%s-%02d-%02d",
                    m.group(1), Integer.parseInt(m.group(2)), Integer.parseInt(m.group(3))));
            r.setEnd(String.format("%s-%02d-%02d",
                    m.group(4), Integer.parseInt(m.group(5)), Integer.parseInt(m.group(6))));
            // log.warn("[PARSE-CN] start={}, end={}", r.getStart(), r.getEnd());
            for (String cell : cells) {
                if (cell.contains("$") || cell.contains("元")) continue;
                String num = cell.replaceAll("[^0-9.]", "");
                if (!num.isEmpty()) {
                    try {
                        double rate = Double.parseDouble(num);
                        if (rate > 0 && rate < 200) {
                            r.setRate(rate / 100.0);
                            break;
                        }
                    } catch (NumberFormatException ignored) { }
                }
            }
            return r;
        }

        return null;
    }

    private static final java.util.regex.Pattern DATE_RANGE_PATTERN =
            java.util.regex.Pattern.compile(
                    "(\\d{1,2})\\s*(\\S+?),?\\s*(\\d{4})"
                    + ".*?"
                    + "(\\d{1,2})\\s*(\\S+?),?\\s*(\\d{4})"
            );

    private static final java.util.regex.Pattern CN_DATE_RANGE_PATTERN =
            java.util.regex.Pattern.compile(
                    "(\\d{4})\\s*年\\s*(\\d{1,2})\\s*月\\s*(\\d{1,2})\\s*日"
                    + ".*?"
                    + "(\\d{4})\\s*年\\s*(\\d{1,2})\\s*月\\s*(\\d{1,2})\\s*日"
            );

    private String normalizeDate(String raw) {
        if (raw == null || raw.trim().isEmpty()) {
            return raw;
        }
        String cleaned = raw.trim();
        // log.warn("[DATE-IN]  raw='{}'", cleaned);

        // 第一步：替换中文月份名为数字（长→短，避免"十一月"误匹配为"十01"）
        String[][] cnMonths = {
            {"十二月", "12"}, {"十一月", "11"}, {"十月", "10"},
            {"九月", "09"}, {"八月", "08"}, {"七月", "07"}, {"六月", "06"},
            {"五月", "05"}, {"四月", "04"}, {"三月", "03"}, {"二月", "02"}, {"一月", "01"}
        };
        for (String[] pair : cnMonths) {
            cleaned = cleaned.replace(pair[0], pair[1]);
        }

        // 英文月份名（不区分大小写替换）
        String[][] enMonths = {
            {"January", "01"}, {"February", "02"}, {"March", "03"},
            {"April", "04"}, {"May", "05"}, {"June", "06"},
            {"July", "07"}, {"August", "08"}, {"September", "09"},
            {"October", "10"}, {"November", "11"}, {"December", "12"}
        };
        for (String[] pair : enMonths) {
            cleaned = cleaned.replaceAll("(?i)" + pair[0], pair[1]);
        }

        // 第二步：剥离剩余的 年/月/日 标记，统一替换为空格分隔
        cleaned = cleaned.replace('年', ' ')
                         .replace('月', ' ')
                         .replace('日', ' ')
                         .replace(',', ' ')
                         .trim()
                         .replaceAll("\\s+", " ");

        // log.warn("[DATE-MID] cleaned='{}'", cleaned);

        // 第三步：按空格拆分，智能判断 年/月/日 顺序
        try {
            String[] parts = cleaned.split(" ");
            if (parts.length == 3) {
                int a = Integer.parseInt(parts[0]);
                int b = Integer.parseInt(parts[1]);
                int c = Integer.parseInt(parts[2]);
                // c > 1900 → 格式: 日 月 年 (dd MM yyyy)
                if (c > 1900 && a >= 1 && a <= 31 && b >= 1 && b <= 12) {
                    return String.format("%d-%02d-%02d", c, b, a);
                }
                // a > 1900 → 格式: 年 月 日 (yyyy MM dd)
                if (a > 1900 && b >= 1 && b <= 12 && c >= 1 && c <= 31) {
                    return String.format("%d-%02d-%02d", a, b, c);
                }
            }
        } catch (Exception e) {
            // log.warn("[DATE-ERR] 解析数字失败: {}", e.getMessage());
        }

        // log.warn("[DATE-OUT] 无法解析,返回原始值: {}", cleaned);
        return raw;
    }

    private JsonNode fetchSurchargeJsonFromPage(Page page) {
        try {
            @SuppressWarnings("unchecked")
            List<Object> requests = (List<Object>) page.evaluate(
                    "() => window.performance.getEntriesByType('resource')"
                            + ".filter(r => r.name.includes('.json') || r.name.includes('.jsonp')"
                            + " || r.name.includes('express_weekly') || r.name.includes('surcharge'))"
                            + ".map(r => r.name)"
            );
            if (requests != null) {
                log.warn("页面中JSON/JSONP资源请求数: {}", requests.size());
                for (Object r : requests) {
                    log.warn("  [RESOURCE] {}", r);
                }
            }

            if (requests != null && !requests.isEmpty()) {
                for (Object urlObj : requests) {
                    String jsonUrl = urlObj.toString();
                    log.warn("尝试在浏览器上下文中重新获取: {}", jsonUrl);
                    try {
                        @SuppressWarnings("unchecked")
                        List<Object> result = (List<Object>) page.evaluate(
                                "(async (url) => {"
                                        + "try {"
                                        + "  const resp = await fetch(url, {credentials: 'include'});"
                                        + "  const text = await resp.text();"
                                        + "  return [resp.status, text];"
                                        + "} catch(e) { return [0, e.message]; }"
                                        + "})(arguments[0])",
                                List.of(jsonUrl)
                        );
                        if (result != null && result.size() >= 2
                                && Integer.parseInt(result.get(0).toString()) == 200) {
                            String body = result.get(1).toString();
                            log.warn("成功获取响应, 长度: {}", body.length());

                            if (jsonUrl.contains(".jsonp") || body.trim().startsWith("angular.callbacks")
                                    || body.contains("callback(")) {
                                body = stripJsonpCallback(body);
                                if (body == null) {
                                    continue;
                                }
                            }

                            return objectMapper.readTree(body);
                        }
                    } catch (Exception e) {
                        log.debug("获取 {} 失败: {}", jsonUrl, e.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            log.warn("从页面提取JSON失败", e);
        }

        try {
            String pageText = page.evaluate(
                    "() => document.body ? document.body.innerText : ''"
            ).toString();
            if (pageText != null && pageText.length() > 50) {
                log.warn("页面正文前200字符: {}",
                        pageText.substring(0, Math.min(200, pageText.length())));
            }
        } catch (Exception e) {
            log.debug("获取页面正文失败: {}", e.getMessage());
        }

        return null;
    }

    private List<FedexRyf> parseJsonToRecords(JsonNode root) {
        List<FedexRyf> records = new ArrayList<>();
        List<JsonNode> rateNodes = findRateNodes(root);

        for (JsonNode node : rateNodes) {
            FedexRyf record = extractRecord(node);
            if (record != null) {
                records.add(record);
            }
        }

        log.warn("从JSON中解析出{}条费率记录", records.size());
        return records;
    }

    private List<FedexRyf> parseJsonpToRecords(String jsonpBody) {
        List<FedexRyf> records = new ArrayList<>();

        String json = stripJsonpCallback(jsonpBody);
        if (json == null || json.isEmpty()) {
            log.warn("JSONP剥离回调函数失败");
            return records;
        }

        log.warn("JSONP解析后的JSON长度: {}", json.length());

        try {
            JsonNode root = objectMapper.readTree(json);
            List<JsonNode> rateNodes = findRateNodes(root);

            for (JsonNode node : rateNodes) {
                FedexRyf record = extractRecord(node);
                if (record != null) {
                    records.add(record);
                }
            }

            log.warn("从JSONP中解析出{}条费率记录", records.size());
        } catch (Exception e) {
            log.error("解析JSONP数据失败", e);
        }

        return records;
    }

    private String stripJsonpCallback(String jsonp) {
        if (jsonp == null || jsonp.isEmpty()) {
            return null;
        }
        String trimmed = jsonp.trim();

        Matcher m = JSONP_CALLBACK_PATTERN.matcher(trimmed);
        if (m.matches()) {
            return m.group(1);
        }

        int startBrace = trimmed.indexOf('{');
        int startBracket = trimmed.indexOf('[');
        int start;
        if (startBrace >= 0 && (startBracket < 0 || startBrace < startBracket)) {
            start = startBrace;
        } else if (startBracket >= 0) {
            start = startBracket;
        } else {
            return null;
        }

        int endBrace = trimmed.lastIndexOf('}');
        int endBracket = trimmed.lastIndexOf(']');
        int end;
        if (endBrace >= 0 && (endBracket < 0 || endBrace > endBracket)) {
            end = endBrace;
        } else {
            end = endBracket;
        }

        if (start >= 0 && end >= 0 && start < end) {
            return trimmed.substring(start, end + 1);
        }

        return null;
    }

    private List<JsonNode> findRateNodes(JsonNode root) {
        List<JsonNode> results = new ArrayList<>();

        if (root.isArray()) {
            for (JsonNode item : root) {
                if (looksLikeRateRecord(item)) {
                    results.add(item);
                } else {
                    results.addAll(findRateNodes(item));
                }
            }
        } else if (root.isObject()) {
            if (looksLikeRateRecord(root)) {
                results.add(root);
                return results;
            }

            String[] rateFieldNames = {"rates", "surchargeData", "fuelSurchargeData",
                    "data", "results", "surcharges", "fuelSurcharges",
                    "expressWeeklySurchargeData", "weeklySurchargeData"};
            for (String fieldName : rateFieldNames) {
                JsonNode child = root.get(fieldName);
                if (child != null && (child.isArray() || child.isObject())) {
                    results.addAll(findRateNodes(child));
                }
            }

            if (results.isEmpty()) {
                var fields = root.fields();
                while (fields.hasNext()) {
                    var entry = fields.next();
                    JsonNode value = entry.getValue();
                    if (value.isArray() || value.isObject()) {
                        results.addAll(findRateNodes(value));
                    }
                }
            }
        }

        return results;
    }

    private boolean looksLikeRateRecord(JsonNode node) {
        if (!node.isObject()) {
            return false;
        }
        boolean hasDate = node.has("effectiveDate") || node.has("startDate")
                || node.has("start") || node.has("date") || node.has("effDate")
                || node.has("beginDate");
        boolean hasRate = node.has("surcharge") || node.has("rate")
                || node.has("fuelSurcharge") || node.has("surchargePercent")
                || node.has("percentage") || node.has("surchargePct")
                || node.has("value") || node.has("fuelSurchargePercent")
                || node.has("pct");
        return hasDate && hasRate;
    }

    private FedexRyf extractRecord(JsonNode node) {
        try {
            String startDate = extractDateField(node, "effectiveDate", "startDate",
                    "start", "date", "effDate", "beginDate");
            String endDate = extractDateField(node, "endDate", "end",
                    "expirationDate", "expDate");

            Double rate = extractRateField(node);

            if (startDate == null || rate == null) {
                log.debug("跳过无法识别的记录: {}", node.toPrettyString());
                return null;
            }

            FedexRyf record = new FedexRyf();
            record.setStart(startDate);
            record.setEnd(endDate != null ? endDate : startDate);
            record.setRate(rate);
            return record;

        } catch (Exception e) {
            log.debug("提取记录失败: {}", e.getMessage());
            return null;
        }
    }

    private String extractDateField(JsonNode node, String... fieldNames) {
        for (String fieldName : fieldNames) {
            JsonNode field = node.get(fieldName);
            if (field != null && !field.isNull()) {
                String raw = field.asText().trim();
                if (!raw.isEmpty()) {
                    String parsed = parseDate(raw);
                    if (parsed != null) {
                        return parsed;
                    }
                }
            }
        }
        return null;
    }

    private Double extractRateField(JsonNode node) {
        String[] rateFieldNames = {"surcharge", "rate", "fuelSurcharge",
                "surchargePercent", "percentage", "surchargePct",
                "value", "fuelSurchargePercent", "pct"};
        for (String fieldName : rateFieldNames) {
            JsonNode field = node.get(fieldName);
            if (field != null && !field.isNull()) {
                String raw = field.asText().trim();
                Double rate = parseRate(raw);
                if (rate != null) {
                    return rate;
                }
            }
        }
        return null;
    }

    private String parseDate(String raw) {
        if (raw == null || raw.isEmpty()) {
            return null;
        }
        String cleaned = raw.replaceAll("\\s+", " ").trim();
        for (DateTimeFormatter fmt : DATE_IN_FORMATS) {
            try {
                LocalDate date = LocalDate.parse(cleaned, fmt);
                return date.format(DATE_OUT_FORMAT);
            } catch (DateTimeParseException ignored) {
            }
        }
        log.debug("无法解析日期: {}", raw);
        return null;
    }

    private Double parseRate(String raw) {
        if (raw == null || raw.isEmpty()) {
            return null;
        }
        Matcher m = Pattern.compile("(\\d+\\.?\\d*)\\s*%?").matcher(raw.trim());
        if (m.find()) {
            double value = Double.parseDouble(m.group(1));
            if (raw.contains("%")) {
                return value / 100.0;
            }
            return value > 1.0 ? value / 100.0 : value;
        }
        return null;
    }

    public List<OnTracFuelSurchargeRate> fetchPreviousRatesFromFedex() {
        List<OnTracFuelSurchargeRate> rates = new ArrayList<>();

        try (Playwright playwright = Playwright.create()) {
            Browser browser = launchBrowser(playwright);

            BrowserContext context = browser.newContext(
                    new Browser.NewContextOptions()
                            .setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                                    + "AppleWebKit/537.36 (KHTML, like Gecko) "
                                    + "Chrome/114.0.0.0 Safari/537.36")
                            .setLocale("en-US")
                            .setViewportSize(1920, 1080)
                            .setGeolocation(37.7749, -122.4194)
                            .setTimezoneId("America/Chicago")
                            .setPermissions(List.of("geolocation"))
            );

            Page page = context.newPage();
            page.setDefaultNavigationTimeout(60_000);
            page.addInitScript(antiDetectionInitScript());

            log.info("Playwright导航到: {}", FEDEX_SURCHARGES_PAGE);
            page.navigate(FEDEX_SURCHARGES_PAGE, new Page.NavigateOptions()
                    .setWaitUntil(WaitUntilState.LOAD));
            log.info("页面导航完成, 当前URL: {}", page.url());
            page.waitForTimeout(5000);

            // 先获取页面上所有可能的标题文本，用于调试
            @SuppressWarnings("unchecked")
            List<String> pageHeadings = (List<String>) page.evaluate(
                    "() => {"
                    + "const texts = [];"
                    + "document.querySelectorAll('h1,h2,h3,h4,h5,h6,[class*=title],[class*=heading],strong,b').forEach(el => {"
                    + "  const t = (el.textContent || '').trim();"
                    + "  if (t.length > 10 && t.length < 300) texts.push(t.substring(0, 200));"
                    + "});"
                    + "return texts;"
                    + "}"
            );
            log.info("页面上找到的标题文本: {}", pageHeadings);

            @SuppressWarnings("unchecked")
            List<List<String>> rows = (List<List<String>>) page.evaluate(
                    "() => {"
                    + "const results = [];"
                    + "// 多种关键词匹配策略"
                    + "const keywords = ["
                    + "  'Previous FedEx package and express freight fuel surcharge rates',"
                    + "  'previous fuel surcharge',"
                    + "  'Previous Fuel Surcharge',"
                    + "  'historical fuel surcharge',"
                    + "  'fuel surcharge rates'"
                    + "];"
                    + "let targetHeading = null;"
                    + "const allElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, div, span, strong, b, [class*=title], [class*=heading]');"
                    + "for (const kw of keywords) {"
                    + "  for (const el of allElements) {"
                    + "    const text = (el.textContent || '').toLowerCase().trim();"
                    + "    if (text.includes(kw.toLowerCase()) && !text.startsWith('current')) {"
                    + "      targetHeading = el;"
                    + "      break;"
                    + "    }"
                    + "  }"
                    + "  if (targetHeading) break;"
                    + "}"
                    + "if (!targetHeading) {"
                    + "  // fallback: 直接查找包含日期范围和百分比格式的第一个表格"
                    + "  const tables = document.querySelectorAll('table');"
                    + "  for (const table of tables) {"
                    + "    const text = (table.textContent || '');"
                    + "    if (/\\d{1,2}\\/\\d{1,2}\\/\\d{4}/.test(text) && /\\d+\\.?\\d*\\s*%/.test(text)) {"
                    + "      const trs = table.querySelectorAll('tr');"
                    + "      for (const tr of trs) {"
                    + "        const cells = tr.querySelectorAll('td, th');"
                    + "        if (cells.length >= 2) {"
                    + "          const row = [];"
                    + "          for (const td of cells) row.push((td.textContent || '').trim());"
                    + "          results.push(row);"
                    + "        }"
                    + "      }"
                    + "      if (results.length > 0) return results;"
                    + "    }"
                    + "  }"
                    + "  return results;"
                    + "}"
                    + "// 从找到的标题向下查找表格"
                    + "let current = targetHeading;"
                    + "const maxDepth = 30;"
                    + "for (let i = 0; i < maxDepth; i++) {"
                    + "  if (current.nextElementSibling) {"
                    + "    current = current.nextElementSibling;"
                    + "  } else if (current.parentElement && current.parentElement.nextElementSibling) {"
                    + "    current = current.parentElement.nextElementSibling;"
                    + "  } else {"
                    + "    break;"
                    + "  }"
                    + "  const table = current.tagName === 'TABLE' ? current : current.querySelector('table');"
                    + "  if (table) {"
                    + "    const trs = table.querySelectorAll('tr');"
                    + "    for (const tr of trs) {"
                    + "      const cells = tr.querySelectorAll('td, th');"
                    + "      if (cells.length >= 2) {"
                    + "        const row = [];"
                    + "        for (const td of cells) row.push((td.textContent || '').trim());"
                    + "        results.push(row);"
                    + "      }"
                    + "    }"
                    + "    break;"
                    + "  }"
                    + "}"
                    + "return results;"
                    + "}"
            );

            log.info("从FedEx页面提取到 {} 行数据", rows != null ? rows.size() : 0);

            if (rows != null) {
                for (List<String> row : rows) {
                    FedexRyf record = parseRateRow(row);
                    if (record != null) {
                        rates.add(new OnTracFuelSurchargeRate(
                                record.getStart(), record.getEnd(), record.getRate()));
                    }
                }
            }

            context.close();
        } catch (Exception e) {
            log.error("获取FedEx历史费率失败", e);
            throw new RuntimeException("获取FedEx历史费率失败: " + e.getMessage(), e);
        }

        return rates;
    }

    public List<OnTracFuelSurchargeRate> queryAllRates() {
        List<FedexRyf> records = fedexRyfMapper.selectList(null);
        return records.stream()
                .map(r -> new OnTracFuelSurchargeRate(r.getStart(), r.getEnd(), r.getRate()))
                .collect(Collectors.toList());
    }

    @Scheduled(cron = "0 0 9 * * 1")
    public void scheduledSyncSurchargeData() {
        log.warn("定时任务触发：每周一上午9点同步FedEx燃油附加费数据");
        try {
            int count = syncSurchargeData();
            log.warn("定时任务完成，共导入{}条记录", count);
        } catch (Exception e) {
            log.error("定时任务同步失败", e);
        }
    }
}