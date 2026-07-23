export type IngredientFileValue = string | number | null;

export type IngredientFileRow = Record<string, IngredientFileValue>;

export type XlsxSheet = {
  name: string;
  rows: IngredientFileValue[][];
  widths?: number[];
  freezeHeader?: boolean;
  autoFilter?: boolean;
  currencyColumns?: number[];
  currency4Columns?: number[];
  numericColumns?: number[];
  currencySymbol?: string;
  dropdowns?: Record<number, string[]>;
  validationRowLimit?: number;
};

export const ingredientExportColumns = [
  "Ingredient Name",
  "Category",
  "Supplier",
  "SKU",
  "Purchase Quantity",
  "Purchase UOM",
  "Purchase Cost",
  "Recipe Base UOM",
  "Cost Per Base Unit",
  "Waste Percentage",
  "Status",
  "Notes",
] as const;

export const ingredientImportColumns = [
  "Ingredient Name",
  "Category",
  "Supplier",
  "SKU",
  "Purchase Quantity",
  "Purchase UOM",
  "Purchase Cost",
  "Recipe Base UOM",
  "Waste Percentage",
  "Status",
  "Notes",
] as const;

export const supportedImportUnits = [
  "kg",
  "g",
  "L",
  "ml",
  "each",
  "packet",
  "bottle",
  "tub",
  "case",
] as const;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function xmlEscape(value: IngredientFileValue) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function csvEscape(value: IngredientFileValue) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function makeCsvBlob(rows: IngredientFileRow[], columns: readonly string[]) {
  const lines = [
    columns.map(csvEscape).join(","),
    ...rows.map((row) => columns.map((column) => csvEscape(row[column])).join(",")),
  ];
  return new Blob([lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function fileStamp() {
  return new Date().toISOString().slice(0, 19).replaceAll(":", "").replace("T", "-");
}

function columnName(index: number) {
  let column = "";
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }
  return column;
}

function cellStyle(sheet: XlsxSheet, rowIndex: number, columnIndex: number) {
  if (rowIndex === 0) return 1;
  if (sheet.currencyColumns?.includes(columnIndex)) return 2;
  if (sheet.currency4Columns?.includes(columnIndex)) return 3;
  if (sheet.numericColumns?.includes(columnIndex)) return 4;
  return 0;
}

function sheetXml(sheet: XlsxSheet) {
  const rowCount = Math.max(sheet.rows.length, 1);
  const colCount = Math.max(...sheet.rows.map((row) => row.length), 1);
  const ref = `A1:${columnName(colCount - 1)}${rowCount}`;
  const cols = sheet.widths?.length
    ? `<cols>${sheet.widths
        .map(
          (width, index) =>
            `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`,
        )
        .join("")}</cols>`
    : "";
  const rows = sheet.rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
          const style = cellStyle(sheet, rowIndex, columnIndex);
          if (typeof value === "number" && Number.isFinite(value)) {
            return `<c r="${reference}" s="${style}"><v>${value}</v></c>`;
          }
          return `<c r="${reference}" t="inlineStr" s="${style}"><is><t>${xmlEscape(
            value,
          )}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  const freezeHeader = sheet.freezeHeader
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const autoFilter = sheet.autoFilter ? `<autoFilter ref="${ref}"/>` : "";
  const validations = sheet.dropdowns
    ? Object.entries(sheet.dropdowns)
        .map(([columnIndex, values]) => {
          const column = columnName(Number(columnIndex));
          const sqref = `${column}2:${column}${sheet.validationRowLimit ?? 500}`;
          return `<dataValidation type="list" allowBlank="1" showErrorMessage="1" sqref="${sqref}"><formula1>&quot;${xmlEscape(
            values.join(","),
          )}&quot;</formula1></dataValidation>`;
        })
        .join("")
    : "";
  const dataValidations = validations
    ? `<dataValidations count="${Object.keys(sheet.dropdowns ?? {}).length}">${validations}</dataValidations>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${freezeHeader}${cols}<sheetData>${rows}</sheetData>${autoFilter}${dataValidations}</worksheet>`;
}

function stylesXml(currencySymbol: string) {
  const symbol = xmlEscape(currencySymbol || "R");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="3">
    <numFmt numFmtId="164" formatCode="${symbol} #,##0.00"/>
    <numFmt numFmtId="165" formatCode="${symbol} #,##0.0000"/>
    <numFmt numFmtId="166" formatCode="0.###"/>
  </numFmts>
  <fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><name val="Arial"/></font></fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF7F8FA"/><bgColor indexed="64"/></patternFill></fill></fills>
  <borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD9DEE7"/></left><right style="thin"><color rgb="FFD9DEE7"/></right><top style="thin"><color rgb="FFD9DEE7"/></top><bottom style="thin"><color rgb="FFD9DEE7"/></bottom><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="5">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="1" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function workbookXml(sheets: XlsxSheet[]) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
    .map(
      (sheet, index) =>
        `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join("")}</sheets></workbook>`;
}

function workbookRelsXml(sheets: XlsxSheet[]) {
  const sheetRels = sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRels}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
}

function contentTypesXml(sheets: XlsxSheet[]) {
  const sheetTypes = sheets
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheetTypes}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`;
}

function rootRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
}

function coreXml() {
  const now = new Date().toISOString();
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Ingredients</dc:title><dc:creator>Production Controller</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
}

function appXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Production Controller</Application></Properties>`;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUInt16(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
}

function writeUInt32(target: Uint8Array, offset: number, value: number) {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >>> 8) & 0xff;
  target[offset + 2] = (value >>> 16) & 0xff;
  target[offset + 3] = (value >>> 24) & 0xff;
}

function createZip(files: { path: string; content: string | Uint8Array }[]) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.path);
    const data = typeof file.content === "string" ? encoder.encode(file.content) : file.content;
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length + data.length);
    writeUInt32(local, 0, 0x04034b50);
    writeUInt16(local, 4, 20);
    writeUInt16(local, 6, 0);
    writeUInt16(local, 8, 0);
    writeUInt16(local, 10, 0);
    writeUInt16(local, 12, 0);
    writeUInt32(local, 14, crc);
    writeUInt32(local, 18, data.length);
    writeUInt32(local, 22, data.length);
    writeUInt16(local, 26, name.length);
    writeUInt16(local, 28, 0);
    local.set(name, 30);
    local.set(data, 30 + name.length);
    localParts.push(local);

    const central = new Uint8Array(46 + name.length);
    writeUInt32(central, 0, 0x02014b50);
    writeUInt16(central, 4, 20);
    writeUInt16(central, 6, 20);
    writeUInt16(central, 8, 0);
    writeUInt16(central, 10, 0);
    writeUInt16(central, 12, 0);
    writeUInt16(central, 14, 0);
    writeUInt32(central, 16, crc);
    writeUInt32(central, 20, data.length);
    writeUInt32(central, 24, data.length);
    writeUInt16(central, 28, name.length);
    writeUInt16(central, 30, 0);
    writeUInt16(central, 32, 0);
    writeUInt16(central, 34, 0);
    writeUInt16(central, 36, 0);
    writeUInt32(central, 38, 0);
    writeUInt32(central, 42, offset);
    central.set(name, 46);
    centralParts.push(central);

    offset += local.length;
  }

  const centralOffset = offset;
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  writeUInt32(end, 0, 0x06054b50);
  writeUInt16(end, 8, files.length);
  writeUInt16(end, 10, files.length);
  writeUInt32(end, 12, centralSize);
  writeUInt32(end, 16, centralOffset);
  const output = new Uint8Array(centralOffset + centralSize + end.length);
  let cursor = 0;
  for (const part of [...localParts, ...centralParts, end]) {
    output.set(part, cursor);
    cursor += part.length;
  }
  return output;
}

export function makeXlsxBlob(sheets: XlsxSheet[]) {
  const currencySymbol = sheets.find((sheet) => sheet.currencySymbol)?.currencySymbol ?? "R";
  const files = [
    { path: "[Content_Types].xml", content: contentTypesXml(sheets) },
    { path: "_rels/.rels", content: rootRelsXml() },
    { path: "docProps/core.xml", content: coreXml() },
    { path: "docProps/app.xml", content: appXml() },
    { path: "xl/workbook.xml", content: workbookXml(sheets) },
    { path: "xl/_rels/workbook.xml.rels", content: workbookRelsXml(sheets) },
    { path: "xl/styles.xml", content: stylesXml(currencySymbol) },
    ...sheets.map((sheet, index) => ({
      path: `xl/worksheets/sheet${index + 1}.xml`,
      content: sheetXml(sheet),
    })),
  ];
  return new Blob([createZip(files)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.replace(/\r$/, ""));
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function rowsToObjects(rows: string[][]) {
  const headers = rows[0]?.map((header) => header.trim()) ?? [];
  return rows
    .slice(1)
    .filter((row) => row.some((value) => value.trim()))
    .map((row) => {
      const record: IngredientFileRow = {};
      headers.forEach((header, index) => {
        record[header] = row[index] ?? "";
      });
      return record;
    });
}

function readUInt16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUInt32(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

async function inflateRaw(bytes: Uint8Array) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser cannot read compressed XLSX files.");
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZipEntries(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let eocdOffset = -1;
  for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
    if (readUInt32(bytes, offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("The XLSX file is not a valid workbook.");

  const entryCount = readUInt16(bytes, eocdOffset + 10);
  let cursor = readUInt32(bytes, eocdOffset + 16);
  const entries = new Map<string, Uint8Array>();

  for (let index = 0; index < entryCount; index += 1) {
    if (readUInt32(bytes, cursor) !== 0x02014b50) break;
    const method = readUInt16(bytes, cursor + 10);
    const compressedSize = readUInt32(bytes, cursor + 20);
    const fileNameLength = readUInt16(bytes, cursor + 28);
    const extraLength = readUInt16(bytes, cursor + 30);
    const commentLength = readUInt16(bytes, cursor + 32);
    const localOffset = readUInt32(bytes, cursor + 42);
    const path = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + fileNameLength));
    const localNameLength = readUInt16(bytes, localOffset + 26);
    const localExtraLength = readUInt16(bytes, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);
    const data = method === 0 ? compressed : method === 8 ? await inflateRaw(compressed) : null;
    if (data) entries.set(path, data);
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function textFromFirst(parent: Element, tagName: string) {
  return parent.getElementsByTagName(tagName)[0]?.textContent ?? "";
}

function parseSharedStrings(xml: string) {
  const documentXml = new DOMParser().parseFromString(xml, "application/xml");
  return Array.from(documentXml.getElementsByTagName("si")).map((item) =>
    Array.from(item.getElementsByTagName("t"))
      .map((node) => node.textContent ?? "")
      .join(""),
  );
}

function columnIndexFromRef(reference: string) {
  const letters = reference.match(/[A-Z]+/i)?.[0]?.toUpperCase() ?? "A";
  return letters.split("").reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function parseWorksheet(xml: string, sharedStrings: string[]) {
  const documentXml = new DOMParser().parseFromString(xml, "application/xml");
  return Array.from(documentXml.getElementsByTagName("row")).map((row) => {
    const values: string[] = [];
    Array.from(row.getElementsByTagName("c")).forEach((cell, fallbackIndex) => {
      const columnIndex = cell.getAttribute("r")
        ? columnIndexFromRef(cell.getAttribute("r") ?? "A1")
        : fallbackIndex;
      const type = cell.getAttribute("t");
      const raw = textFromFirst(cell, "v");
      if (type === "s") {
        values[columnIndex] = sharedStrings[Number(raw)] ?? "";
      } else if (type === "inlineStr") {
        values[columnIndex] = textFromFirst(cell, "t");
      } else {
        values[columnIndex] = raw;
      }
    });
    return values;
  });
}

export async function parseIngredientFile(file: File) {
  if (file.name.toLowerCase().endsWith(".csv")) {
    return rowsToObjects(parseCsvRows(await file.text()));
  }

  if (!file.name.toLowerCase().endsWith(".xlsx")) {
    throw new Error("Use a CSV or XLSX ingredient file.");
  }

  const entries = await readZipEntries(file);
  const sharedStrings = entries.has("xl/sharedStrings.xml")
    ? parseSharedStrings(decoder.decode(entries.get("xl/sharedStrings.xml")))
    : [];
  const sheetPath =
    Array.from(entries.keys()).find((path) => path === "xl/worksheets/sheet1.xml") ??
    Array.from(entries.keys()).find((path) => path.startsWith("xl/worksheets/sheet"));
  if (!sheetPath) throw new Error("The XLSX workbook does not contain a readable worksheet.");
  return rowsToObjects(parseWorksheet(decoder.decode(entries.get(sheetPath)), sharedStrings));
}
