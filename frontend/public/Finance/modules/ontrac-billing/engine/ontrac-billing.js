/**
 * OnTrac 账单计费核心引擎。
 * 与 FedEx 引擎并列的两大承运人计费引擎之一（UPS 另有独立引擎）。
 *
 * 相比 FedEx 引擎，OnTrac 有几个专属设计：
 *
 * 1. 报价按 Zone × 重量档位（价格）× 运输模式（Ground / Express 等）三维索引；
 *    结构较 FedEx 的 Service Type × Zone 更扁平。
 * 2. 分区来源支持 OnTrac 运单自带的 Zone 字段和 overrides 覆盖；
 *    不像 FedEx 那样从 GTS 文件中取 zone。
 * 3. 计费重与 FedEx 共用 billing-weight-policy 算法，但 GTS 数据获取路径不同。
 * 4. 核心暴露：
 *    - quote         解析报价 Excel
 *    - calculate     执行 A/B 两方案计算
 *    - workbook      组装输出 Excel 工作簿
 *    - bytes         将 workbook 转成可下载的字节数据
 *    - fuel          燃油调整工具
 */
import * as XLSX from 'xlsx';
import { buildWeightFromAny, decideBillingWeight } from '../shared/billing-weight-policy.js';
import { defaultPeak } from '../data/peak-defaults.js';

/** 从 GTS 数据行中按 trackingNo 查找匹配的尺寸/重量数据 */
function matchGts(row, gtsMap) {
  if (!gtsMap) return null;
  const t = String(row.trackingNo || row.TrackingNo || '').trim();
  if (!t) return null;
  return gtsMap.get(t) || null;
}

/** 将任何重量字段安全转成 Number（undefined/null → 0） */
function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** 从 JSON 快照模式解析报价（单条报价行） */
function parseSingleQuote(row) {
  if (row == null) return null;
  const service = row.service || row.Service || row.mode || 'Ground';
  const zone = Number(row.zone ?? row.Zone ?? 0);
  const weight = Number(row.weight ?? row.Weight ?? 0);
  const price = Number(row.price ?? row.Price ?? 0);
  if (!service || !zone || !weight || !price) return null;
  return { service, zone, weight, price };
}

/** 将报价行批量追加到报价索引对象中 */
function insertQuote(table, q) {
  if (!table[q.service]) table[q.service] = {};
  if (!table[q.service][q.zone]) table[q.service][q.zone] = [];
  table[q.service][q.zone].push({ weight: q.weight, price: q.price });
}

/** 从报价工作簿中解析所有报价表并构建报价索引 */
function buildQuoteTable(wb) {
  const table = {};
  if (!wb || !wb.SheetNames) return table;
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows = XLSX.utils.sheet_to_json(sheet);
    for (const row of rows) {
      const q = parseSingleQuote(row);
      if (q) insertQuote(table, q);
    }
  }
  for (const service of Object.keys(table)) {
    for (const zone of Object.keys(table[service])) {
      table[service][zone].sort((a, b) => a.weight - b.weight);
    }
  }
  return table;
}

/** 从客户报价管理器中提取 OnTrac 报价部分 */
function extractOnTracQuotes(customerQuotes) {
  if (!customerQuotes) return null;
  return customerQuotes.ontrac || null;
}

/** 报价查找：service → zone → 按 weight 找档位（不足按最低、超出按最高） */
function lookupQuote(table, service, zone, weight) {
  if (!table[service]) return null;
  const zoneTable = table[service][zone];
  if (!zoneTable || !zoneTable.length) return null;
  let best = null;
  for (const entry of zoneTable) {
    if (weight <= entry.weight) return entry.price;
    best = entry.price;
  }
  return best;
}

/** 读取报价文件，返回报价索引对象 + 原始行 */
export function quote(file, opts = {}) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve({ table: {}, rows: [] });
    if (file.isWorkbook && file.workbook) {
      const table = buildQuoteTable(file.workbook);
      const rows = [];
      for (const sheetName of file.workbook.SheetNames) {
        const sheet = file.workbook.Sheets[sheetName];
        if (!sheet) continue;
        rows.push(...XLSX.utils.sheet_to_json(sheet));
      }
      return resolve({ table, rows });
    }
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const table = buildQuoteTable(wb);
        const rows = [];
        for (const sheetName of wb.SheetNames) {
          const sheet = wb.Sheets[sheetName];
          if (!sheet) continue;
          rows.push(...XLSX.utils.sheet_to_json(sheet));
        }
        resolve({ table, rows });
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

/** 客户特定报价查找：先查客户专属报价，找不到再回退到通用报价 */
function findQuote(row, policy, overrides, gts, baseTable, customerQuotes, defaultRates, defaultZone) {
  const customerId = (policy?.customerId || row.customerId || row.CustomerID || row.CustomerId || row.Account || row.account || '').toString().trim();
  const customerQuotesOntrac = extractOnTracQuotes(customerQuotes);
  const specific = customerId && customerQuotesOntrac ? customerQuotesOntrac[customerId] : null;
  const table = specific?.table || baseTable || {};

  const overrideService = (overrides?.service || '').toString().trim();
  const overrideZone = overrides?.zone;
  const overrideWeight = overrides?.weight;

  const service = overrideService ||
    (row.service || row.Service || row.mode || row.Mode || row.product || row.Product || 'Ground').toString().trim();

  const sourceZoneRaw = overrideZone ?? row.zone ?? row.Zone ?? row.ZONE ?? gts?.zone ?? defaultZone;
  const sourceZone = Number(sourceZoneRaw);

  const weightPolicy = buildWeightFromAny({
    ...(gts || {}),
    weightRaw: row.weight ?? row.Weight,
    lengthRaw: gts?.length ?? row.length,
    widthRaw: gts?.width ?? row.width,
    heightRaw: gts?.height ?? row.height,
    dimDivisor: policy?.dimDivisor ?? 139,
    defaultSource: policy?.weightSource || 'raw',
    precision: policy?.precision
  });
  const effectiveWeight = Number((overrideWeight ?? decideBillingWeight(weightPolicy, policy || {})).toFixed(1));

  let price = lookupQuote(table, service, sourceZone, effectiveWeight);
  let matchedByService = true;
  if (price == null && service !== 'Ground') {
    price = lookupQuote(table, 'Ground', sourceZone, effectiveWeight);
    matchedByService = false;
  }
  if (price == null && defaultRates) {
    price = Number(defaultRates[service]?.[sourceZone] || defaultRates['Ground']?.[sourceZone] || 0);
  }
  if (price == null) price = 0;

  return {
    price,
    zone: sourceZone,
    weight: effectiveWeight,
    weightDetails: weightPolicy,
    matchedByService
  };
}

/** 从 row/policy/overrides/gts 计算各种重量字段 */
function buildWeight(row, policy, overrides, gts) {
  const weightPolicy = buildWeightFromAny({
    ...(gts || {}),
    weightRaw: row.weight ?? row.Weight,
    lengthRaw: gts?.length ?? row.length,
    widthRaw: gts?.width ?? row.width,
    heightRaw: gts?.height ?? row.height,
    dimDivisor: policy?.dimDivisor ?? 139,
    defaultSource: policy?.weightSource || 'raw',
    precision: policy?.precision
  });
  const weight = Number((overrides?.weight ?? decideBillingWeight(weightPolicy, policy || {})).toFixed(1));
  return { weight, weightDetails: weightPolicy };
}

/** 统一费率查找，用于 fuel/surcharge 等附加费 */
function lookupRate(table, service, zone, key, weight) {
  if (!table) return null;
  let svc = service;
  if (service !== 'Ground') {
    const keys = Object.keys(table).filter(s => /ground/i.test(s));
    if (keys.length > 0) svc = keys[0];
  }
  if (!table[svc]) return null;
  const zoneRow = table[svc]?.[zone] || null;
  if (!zoneRow) return null;
  if (typeof zoneRow === 'number') return zoneRow;
  if (typeof zoneRow !== 'object') return null;
  const direct = zoneRow[key];
  if (direct != null) return direct;
  const weightMap = zoneRow[key] || null;
  if (weightMap && typeof weightMap === 'object') {
    const sorted = Object.entries(weightMap)
      .map(([k, v]) => [Number(k), v])
      .sort((a, b) => a[0] - b[0]);
    let best = null;
    for (const [w, v] of sorted) {
      if (weight <= w) return v;
      best = v;
    }
    return best;
  }
  return null;
}

/** 根据服务名从燃油表里取对应服务的燃油率（0~1 小数） */
function matchFuel(fuelTable, service) {
  if (!fuelTable) return 0;
  const keys = Object.keys(fuelTable);
  const groundKey = keys.find(k => /ground/i.test(k));
  const key = groundKey || keys[0];
  const pct = Number(fuelTable[key] ?? 0);
  return Math.max(0, Math.min(1, pct / 100));
}

/** 计算旺季附加费：按 peakKey 查找对应重量档位 */
function matchPeak(peakTable, key, weight) {
  if (!peakTable || !peakTable[key]) return null;
  const tier = peakTable[key];
  if (typeof tier !== 'object') return Number(tier) || 0;
  const sorted = Object.entries(tier)
    .map(([k, v]) => [Number(k), v])
    .sort((a, b) => a[0] - b[0]);
  let best = 0;
  for (const [w, v] of sorted) {
    if (weight <= w) return Number(v) || 0;
    best = Number(v) || 0;
  }
  return best;
}

/** OnTrac A/B 两方案主计算流程 */
function computeRow(row, index, baseTable, customerQuotes, defaultRates, opts) {
  if (!row || typeof row !== 'object') return null;
  const policy = opts.policy || {};
  const overrides = opts.overrides || {};
  const gtsMap = opts.gtsMap;
  const defaultZone = opts.defaultZone || 0;

  const gts = matchGts(row, gtsMap);
  const service = (row.service || row.Service || row.mode || row.Mode || row.product || 'Ground').toString().trim();

  const base = findQuote(row, policy, overrides, gts, baseTable, customerQuotes, defaultRates, defaultZone);
  const { weight, weightDetails } = buildWeight(row, policy, overrides, gts);
  const zone = Number(base.zone || row.zone ?? row.Zone ?? row.ZONE ?? 0);

  const { fuelTable, surchargeTable } = opts;
  const fuelPct = matchFuel(fuelTable, service);

  const surcharge = {
    residential: Number(row.residential ?? row.ResidentialDelivery ?? 0) ||
                  Number(lookupRate(surchargeTable, service, zone, 'residential', weight) || 0),
    rural: Number(row.rural ?? row.RuralDelivery ?? row.RuralDeliveryFee ?? 0) ||
           Number(lookupRate(surchargeTable, service, zone, 'rural', weight) || 0),
    oversized: Number(row.oversized ?? row.OversizedFee ?? 0) ||
               Number(lookupRate(surchargeTable, service, zone, 'oversized', weight) || 0),
    handling: Number(row.handling ?? row.HandlingFee ?? 0) ||
              Number(lookupRate(surchargeTable, service, zone, 'handling', weight) || 0),
    peak: Number(row.peak ?? row.PeakFee ?? 0) ||
          Number(matchPeak(opts.peakTable, service, weight) || 0)
  };

  const baseCharge = Number(base.price || 0);
  const fuelCharge = Number((baseCharge + surcharge.residential + surcharge.rural + surcharge.oversized + surcharge.handling) * fuelPct);
  const surchargeTotal = surcharge.residential + surcharge.rural + surcharge.oversized + surcharge.handling + surcharge.peak;

  const totalA = baseCharge + surchargeTotal + fuelCharge;
  const billedA = Number(row.totalCharges ?? row.TotalCharges ?? row.TotalAmount ?? row.BilledAmount ?? row.Amount ?? 0) || totalA;
  const deltaA = Number((billedA - totalA).toFixed(2));

  const flat = Number(policy.flatFee || 0);
  const pct = Number(policy.percentFee || 0);
  const chargeB = Number((totalA * pct + flat + totalA).toFixed(2));
  const deltaB = Number((chargeB - billedA).toFixed(2));

  return {
    __row: row,
    __index: index,
    trackingNo: row.trackingNo || row.TrackingNo || row.Tracking || row.TrackingNumber || '',
    originalZone: row.zone ?? row.Zone ?? row.ZONE ?? '',
    zone,
    weight,
    weightSource: weightDetails.source,
    originalWeight: row.weight ?? row.Weight ?? '',
    baseCharge,
    residential: surcharge.residential,
    rural: surcharge.rural,
    oversized: surcharge.oversized,
    handling: surcharge.handling,
    peakFee: surcharge.peak,
    surchargeTotal,
    fuelPct,
    fuelCharge,
    totalA,
    billedA,
    deltaA,
    pct,
    flat,
    chargeB,
    deltaB,
    service,
    matchedByService: base.matchedByService,
    customerId: row.customerId || row.CustomerID || row.CustomerId || row.Account || row.account || '',
    customerOrderNo: row.customerOrderNo || row.CustomerOrderNumber || row.OrderNo || row.referenceNo || row.ReferenceNumber || '',
    shipDate: row.shipDate || row.ShipDate || row.ShipmentDate || row.transactionDate || row.TransactionDate || '',
    transactionDate: row.transactionDate || row.TransactionDate || row.shipDate || row.ShipDate || row.ShipmentDate || ''
  };
}

/** 批量遍历账单行，返回 A/B 方案完整结果 */
export function calculate(rows, quoteFile, opts = {}) {
  return Promise.resolve().then(async () => {
    const customerQuotes = opts.customerQuotes || null;
    const customerQuoteRows = opts.customerQuoteRows || [];
    let baseTable = {};
    let baseRows = [];
    if (quoteFile) {
      const parsed = await quote(quoteFile, opts);
      baseTable = parsed.table;
      baseRows = parsed.rows;
    }
    const defaultRates = opts.defaultRates || null;

    const enrichedQuotes = [];
    if (customerQuotes) {
      const ontracData = extractOnTracQuotes(customerQuotes);
      if (ontracData) enrichedQuotes.push(ontracData);
    }

    const results = (Array.isArray(rows) ? rows : []).map((row, i) =>
      computeRow(row, i, baseTable, customerQuotes, defaultRates, opts)
    ).filter(Boolean);

    const totals = {
      total: results.length,
      totalA: Number(results.reduce((s, r) => s + (r.totalA || 0), 0).toFixed(2)),
      billedA: Number(results.reduce((s, r) => s + (r.billedA || 0), 0).toFixed(2)),
      deltaA: Number(results.reduce((s, r) => s + (r.deltaA || 0), 0).toFixed(2)),
      chargeB: Number(results.reduce((s, r) => s + (r.chargeB || 0), 0).toFixed(2)),
      deltaB: Number(results.reduce((s, r) => s + (r.deltaB || 0), 0).toFixed(2))
    };

    return {
      results,
      totals,
      quoteRows: baseRows,
      enrichedQuotes,
      enrichedQuoteRows: customerQuoteRows
    };
  });
}

/** 将计算结果组装成多 Sheet 的工作簿：摘要 + A 方案详情 + B 方案详情 */
export function workbook(results, totals, opts = {}) {
  const summary = [{
    Total: totals.total,
    TotalA: totals.totalA,
    BilledA: totals.billedA,
    DeltaA: totals.deltaA,
    ChargeB: totals.chargeB,
    DeltaB: totals.deltaB
  }];

  const sheetA = results.map(r => ({
    TrackingNo: r.trackingNo,
    Service: r.service,
    OriginalZone: r.originalZone,
    Zone: r.zone,
    OriginalWeight: r.originalWeight,
    Weight: r.weight,
    WeightSource: r.weightSource,
    BaseCharge: r.baseCharge,
    Residential: r.residential,
    Rural: r.rural,
    Oversized: r.oversized,
    Handling: r.handling,
    PeakFee: r.peakFee,
    SurchargeTotal: r.surchargeTotal,
    FuelPct: r.fuelPct,
    FuelCharge: r.fuelCharge,
    TotalA: r.totalA,
    BilledA: r.billedA,
    DeltaA: r.deltaA
  }));

  const sheetB = results.map(r => ({
    TrackingNo: r.trackingNo,
    Service: r.service,
    Zone: r.zone,
    Weight: r.weight,
    TotalA: r.totalA,
    Pct: r.pct,
    Flat: r.flat,
    ChargeB: r.chargeB,
    BilledA: r.billedA,
    DeltaB: r.deltaB
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Summary');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetA), 'PlanA');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetB), 'PlanB');
  return wb;
}

/** 将 workbook 编码成 ArrayBuffer 以便 FileSaver 下载 */
export function bytes(wb) {
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Uint8Array(buf).buffer;
}

/** 燃油费工具：从 OnTrac 燃油表按 service 取燃油率百分比 */
export const fuel = {
  byService(fuelData, service) {
    if (!fuelData) return 0;
    const keys = Object.keys(fuelData);
    const groundKey = keys.find(k => /ground/i.test(k));
    const key = groundKey || keys[0];
    return Number(fuelData[key] ?? 0);
  },
  toDecimal(pct) {
    return Math.max(0, Math.min(1, Number(pct) / 100));
  }
};