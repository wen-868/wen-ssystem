/**
 * 人民币金额大写（财务合规：销售单据/打印使用）
 * 支持到亿，角分处理；小写金额前用 ¥ 封顶由调用方处理。
 */

const DIGITS = ["零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"];
const SMALL_UNITS = ["", "拾", "佰", "仟"];
const BIG_UNITS = ["", "万", "亿", "万亿"];

/** 整数部分转大写（0 返回空串） */
function integerToChinese(num: number): string {
  if (num === 0) return "";
  const digits = String(num).split("").map(Number);
  const parts: string[] = [];
  let sectionIdx = 0;

  while (digits.length > 0) {
    const section = digits.splice(-4);
    const sectionText = sectionToChinese(section);
    if (sectionText) {
      parts.unshift(sectionText + BIG_UNITS[sectionIdx]);
    } else if (parts.length > 0 && !parts[0].startsWith("零")) {
      parts.unshift("零");
    }
    sectionIdx++;
  }

  return parts.join("");
}

/** 四位一节转大写 */
function sectionToChinese(section: number[]): string {
  let result = "";
  let zeroPending = false;
  for (let i = 0; i < section.length; i++) {
    const digit = section[i];
    const unit = SMALL_UNITS[section.length - 1 - i];
    if (digit === 0) {
      zeroPending = result.length > 0;
    } else {
      if (zeroPending) result += "零";
      zeroPending = false;
      result += DIGITS[digit] + unit;
    }
  }
  return result;
}

/** 金额转人民币大写，如 1234.56 → 壹仟贰佰叁拾肆元伍角陆分 */
export function amountToChinese(amount: number | string): string {
  const num = Number(amount);
  if (!isFinite(num) || num < 0) return "零元整";

  const totalFen = Math.round(num * 100);
  const yuan = Math.floor(totalFen / 100);
  const jiao = Math.floor((totalFen % 100) / 10);
  const fen = totalFen % 10;

  let result = "";
  const yuanText = integerToChinese(yuan);

  if (yuan > 0) {
    result = yuanText + "元";
  }

  if (jiao === 0 && fen === 0) {
    return result ? result + "整" : "零元整";
  }

  if (jiao > 0) {
    result += DIGITS[jiao] + "角";
  } else if (result && (fen > 0)) {
    result += "零";
  }

  if (fen > 0) {
    result += DIGITS[fen] + "分";
  } else if (result) {
    result += "整";
  }

  return result || "零元整";
}

/** 金额格式化：1,234.56 */
export function formatMoney(amount: number | string): string {
  const num = Number(amount || 0);
  return num.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
