// Formats orders into クリックポスト's "まとめ申込" bulk-import CSV shape, so labels for a whole
// batch of orders can be created in one upload instead of retyping each one into the web form.
// Column spec (お届け先郵便番号/氏名/敬称/住所1-4/内容品), Shift_JIS encoding, and the "20
// full-width characters per address field" limit are all fixed by Click Post itself, not
// something we get to choose -- see clickpost.jp's own CSV template for the source of truth.
export const CLICKPOST_CSV_HEADERS = [
  "お届け先郵便番号",
  "お届け先氏名",
  "お届け先敬称",
  "お届け先住所1行目",
  "お届け先住所2行目",
  "お届け先住所3行目",
  "お届け先住所4行目",
  "内容品",
] as const;

// 住所1〜4行目 all used (not just 1-3) to maximize how much of a long address survives the
// split -- we only have one free-text address string, so there's no way to know which part is
// the prefecture/city/block/building anyway; using all 4 lines just minimizes truncation risk.
const ADDRESS_FIELD_COUNT = 4;
const ADDRESS_FIELD_MAX_CHARS = 20;

// Our checkout form collects address as one free-text field, but Click Post wants it pre-split
// across up to 4 lines of <=20 characters each. There's no reliable way to find "natural" break
// points (no delimiters guaranteed in what a customer typed), so this just hard-splits every 20
// characters -- the same approach real ec-to-clickpost CSV tools use for this exact mismatch.
export function splitAddressForClickpost(address: string): string[] {
  const trimmed = address.trim();
  const chunks: string[] = [];
  for (let i = 0; i < trimmed.length && chunks.length < ADDRESS_FIELD_COUNT; i += ADDRESS_FIELD_MAX_CHARS) {
    chunks.push(trimmed.slice(i, i + ADDRESS_FIELD_MAX_CHARS));
  }
  while (chunks.length < ADDRESS_FIELD_COUNT) chunks.push("");
  return chunks;
}

export function normalizePostalCodeForClickpost(postalCode: string): string {
  // Half-width digits only, no hyphen -- strips "123-4567" / "１２３－４５６７" down to "1234567".
  return postalCode
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/[^0-9]/g, "");
}

export function buildClickpostCsvRow(order: {
  customerName: string;
  postalCode: string;
  address: string;
}): string[] {
  const [addr1, addr2, addr3, addr4] = splitAddressForClickpost(order.address);
  return [
    normalizePostalCodeForClickpost(order.postalCode),
    order.customerName,
    "様",
    addr1,
    addr2,
    addr3,
    addr4,
    "アクセサリー",
  ];
}
