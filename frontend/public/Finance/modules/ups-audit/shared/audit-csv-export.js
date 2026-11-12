/**
 * audit-csv-export.js —— UPS 审核报告 CSV 流式导出引擎
 *
 * 本模块在主线程（非 Worker）内完成 **多 sheet CSV** 的流式写出，
 * 利用 File System Access API（window.showDirectoryPicker）直接写入用户本地目录，
 * 避免浏览器对单个下载文件的 500MB 限制。
 *
 * 与 Excel 导出（audit-xlsx-export.js）的分工：
 *   - 小报告（< 5MB）  ：Excel 单文件导出，样式丰富
 *   - 大报告（> 5MB）  ：CSV 多文件导出，每 sheet 一个 CSV，无样式但行数无上限
 *
 * 核心函数 createSession()：
 *   返回会话对象 { cancel(), run(sheets, directory, progress) }
 *   - cancel()  : 标记 cancelled=true，后续每次写入前 check() 检测 → 抛异常终止
 *   - run()     : 核心导出逻辑
 *
 * run(sheets, directory, progress) 流程：
 *   sheets 是 [title, data, options][] 数组：
 *     每个 title → 生成文件名 "NN_title.csv"（序号补齐 2 位，title 中的非法字符替换为 _）
 *     options.aoa=true 时：data 是二维数组（Array of Arrays），直接按行写出
 *     options.aoa 不存在时：data 是对象数组，先遍历全表收集所有 key（字段名）作为表头
 *     写入前先写 UTF-8 BOM（\uFEFF）让 Excel 正确识别中文字符编码
 *     分批写出：每 batch 行合并成一个大字符串一次性 write → 减少 IO 系统调用
 *     每 256 行主动 pause()（setTimeout 0）让出主线程 → UI 不卡顿
 *     每完成一个 sheet 调 progress 回调 → 更新进度条
 *
 * cell(v) 转义函数：
 *   - null/undefined → '""'
 *   - Date → toISOString()
 *   - 字符串以 = + @ 或 - 后跟非数字开头 → 前缀加单引号（防 CSV 公式注入）
 *   - 字符串内部 " → ""（标准 CSV 转义）
 *
 * 异常处理：
 *   - 任何 write 失败 → writer.abort() 清理 handle → 重新抛出
 *   - cancel() 触发 → 抛 "导出已取消；已写入的文件不代表完整报告"
 *
 * 对外暴露：root.ShipGridAuditCSV = { cell, createSession }
 *
 * 依赖：File System Access API（directory.getFileHandle、handle.createWritable）
 *       —— Chrome 86+ / Edge 86+ 支持，Firefox/Safari 需降级为下载模式
 */
/*SG-AUDIT:finance-30.js*/ (function (root) {
	"use strict";
	const pause = () => new Promise((r) => setTimeout(r, 0));
	function cell(v) {
		if (v === null || v === undefined) return '""';
		let s = v instanceof Date ? v.toISOString() : String(v);
		if (typeof v === "string" && /^[=+@]|^-\D/.test(s)) s = "'" + s;
		return '"' + s.replace(/"/g, '""') + '"';
	}
	function createSession() {
		let cancelled = false,
			writer = null;
		const check = () => {
			if (cancelled) throw Error("导出已取消；已写入的文件不代表完整报告");
		};
		return {
			cancel() {
				cancelled = true;
			},
			async run(sheets, directory, progress = () => {}) {
				let completed = 0;
				for (const [title, data, options = {}] of sheets) {
					check();
					const headers = [],
						seen = new Set();
					if (options.aoa) {
						const filename =
								String(++completed).padStart(2, "0") +
								"_" +
								title.replace(/[\\/:*?"<>|]/g, "_") +
								".csv",
							handle = await directory.getFileHandle(filename, {
								create: true,
							});
						writer = await handle.createWritable();
						try {
							await writer.write("\uFEFF");
							for (let i = 0; i < data.length; i += 256) {
								check();
								await writer.write(
									data
										.slice(i, i + 256)
										.map((r) => r.map(cell).join(","))
										.join("\r\n") + "\r\n",
								);
								await pause();
							}
							await writer.close();
							writer = null;
						} catch (e) {
							await writer.abort().catch(() => {});
							writer = null;
							throw e;
						}
						continue;
					}
					for (let i = 0; i < data.length; i++) {
						for (const key of Object.keys(data[i] || {}))
							if (!seen.has(key)) {
								seen.add(key);
								headers.push(key);
							}
						if (i % 1000 === 999) {
							check();
							progress(
								"整理CSV字段：" + title + " " + (i + 1) + " / " + data.length,
							);
							await pause();
						}
					}
					check();
					const filename =
							String(++completed).padStart(2, "0") +
							"_" +
							title.replace(/[\\/:*?"<>|]/g, "_") +
							".csv",
						handle = await directory.getFileHandle(filename, { create: true });
					writer = await handle.createWritable();
					try {
						await writer.write("\uFEFF" + headers.map(cell).join(",") + "\r\n");
						const batch = Math.max(
							1,
							Math.min(256, Math.floor(4000 / Math.max(1, headers.length))),
						);
						for (let i = 0; i < data.length; i += batch) {
							check();
							const end = Math.min(data.length, i + batch);
							let text = "";
							for (let r = i; r < end; r++)
								text += headers.map((h) => cell(data[r][h])).join(",") + "\r\n";
							await writer.write(text);
							progress(
								"CSV " +
									completed +
									"/" +
									sheets.length +
									"：" +
									title +
									" " +
									end +
									" / " +
									data.length +
									" 行",
							);
							await pause();
						}
						check();
						await writer.close();
						writer = null;
					} catch (e) {
						await writer.abort().catch(() => {});
						writer = null;
						throw e;
					}
				}
				return completed;
			},
		};
	}
	root.ShipGridAuditCSV = { cell, createSession };
})(globalThis);
