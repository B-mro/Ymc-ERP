/**
 * 字典标签辅助工具
 * 用法：表格里任何「字典编码 → 中文 + 颜色 tag」的字段都用这两个函数，
 * 写法统一，以后新增字段照抄即可。
 *
 * 示例：
 *   // 颜色映射（value → el-tag 的 type）
 *   const claimsTypeColors = { "1": "info", "2": "success", "3": "warning" }
 *
 *   // 模板里：
 *   <el-tag :type="dictTag(claimsTypeOptions, row.claimsType, claimsTypeColors)" size="small">
 *     {{ dictLabel(claimsTypeOptions, row.claimsType) }}
 *   </el-tag>
 */

export interface DictOption {
	value: string
	label: string
}

/**
 * 根据字典 value 取对应的 tag 颜色类型
 * @param options 字典选项数组 [{ value, label }]
 * @param value 当前值
 * @param colorMap value → el-tag type 的映射，未命中返回 "info"
 */
export function dictTag(
	options: DictOption[],
	value: string | undefined,
	colorMap: Record<string, string>,
): string {
	return colorMap[value || ""] || "info"
}

/**
 * 根据字典 value 取对应的中文 label，未命中返回原始 value，再兜底 "-"
 */
export function dictLabel(options: DictOption[], value: string | undefined): string {
	return options.find((o) => o.value === value)?.label || value || "-"
}
