// 客户端 / 理赔中心
import { post, get } from "./request";
import type { Claim, PageResult } from "@/types";

/** 列表查询（不分页） */
export function listClaims(params?: {
	logisticsNo?: string;
	claimsType?: string;
	customerName?: string;
}) {
	return post<Claim[]>("/claims-center/list", params || {});
}

/** 分页查询 */
export function pageClaims(params: {
	pageNum: number;
	pageSize: number;
	logisticsNo?: string;
	claimsType?: string;
	customerName?: string;
}) {
	return post<PageResult<Claim>>("/claims-center/page", params);
}

/** 详情 */
export function getClaimDetail(id: number) {
	return post<Claim>("/claims-center/detail", { id });
}

/** 新增 */
export function saveClaim(data: Claim) {
	return post<Claim>("/claims-center/save", data);
}

/** 修改 */
export function updateClaim(data: Claim) {
	return post<void>("/claims-center/update", data);
}

/** 删除（批量，传 id 数组） */
export function deleteClaims(ids: number[]) {
	return post<void>("/claims-center/delete", ids);
}

// 判断物流单号是否超过3次
export function checkClaimCount(params: any) {
	return post<void>("/dapi/claim", params);
}

// 查询燃油费率
export function getFuelRates() {
	return get<any>("/fedex/surcharge/weekly");
}