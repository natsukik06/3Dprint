import Encoding from "encoding-japanese";

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","));
  return lines.join("\r\n");
}

export function downloadCsv(filename: string, content: string): void {
  const bom = "﻿";
  const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// クリックポストの「まとめ申込」CSVはShift_JIS固定でUTF-8は文字化けする -- BOM付きUTF-8を吐く
// downloadCsvとは別に、この用途専用で用意する。
export function encodeShiftJis(content: string): Uint8Array {
  const unicodeArray = Encoding.stringToCode(content);
  const sjisArray = Encoding.convert(unicodeArray, { to: "SJIS", from: "UNICODE" });
  return new Uint8Array(sjisArray);
}

export function downloadCsvShiftJis(filename: string, content: string): void {
  const bytes = encodeShiftJis(content);
  const blob = new Blob([bytes as BlobPart], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
