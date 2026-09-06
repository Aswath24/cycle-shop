/**
 * Google Sheets integration helper for cycle shop sales data.
 * Requires GOOGLE_SHEETS_SPREADSHEET_ID env var and Replit connector credentials.
 */

import type { Sale } from "@workspace/db";

// Month names for sheet naming
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function getMonthSheetName(dateStr: string): string {
  const d = new Date(dateStr);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function saleToSheetRow(sale: Sale): (string | number)[] {
  return [
    sale.serialNo,
    sale.date,
    sale.customerName,
    sale.customerPhone,
    sale.customerAddress,
    sale.cycleModel,
    sale.cycleSize,
    sale.cycleColor,
    sale.supplier,
    sale.invoiceNo,
    Number(sale.buyingPrice),
    Number(sale.profitMargin),
    Number(sale.sellingPrice),
    Number(sale.discount),
    Number(sale.gst),
    Number(sale.finalPrice),
    Number(sale.profitPercent),
    Number(sale.profitAmount),
    Number(sale.lossPercent),
    Number(sale.lossAmount),
    sale.modeOfPayment,
    sale.expenses != null ? Number(sale.expenses) : "",
  ];
}

export const SHEET_HEADERS = [
  "S.No", "Date", "Customer Name", "Customer Phone", "Customer Address",
  "Cycle Model", "Cycle Size", "Cycle Color", "Supplier", "Invoice No", "Buying Price",
  "Profit Margin %", "Selling Price", "Discount %", "GST %", "Final Price",
  "Profit %", "Profit Amount", "Loss %", "Loss Amount",
  "Mode of Payment", "Expenses",
];

export interface SheetsClient {
  spreadsheets: {
    get: (params: { spreadsheetId: string }) => Promise<{
      data: { sheets: Array<{ properties: { title: string; sheetId: number } }> };
    }>;
    batchUpdate: (params: {
      spreadsheetId: string;
      requestBody: { requests: unknown[] };
    }) => Promise<unknown>;
    values: {
      get: (params: {
        spreadsheetId: string;
        range: string;
      }) => Promise<{ data: { values?: string[][] } }>;
      update: (params: {
        spreadsheetId: string;
        range: string;
        valueInputOption: string;
        requestBody: { values: (string | number)[][] };
      }) => Promise<unknown>;
      append: (params: {
        spreadsheetId: string;
        range: string;
        valueInputOption: string;
        requestBody: { values: (string | number)[][] };
      }) => Promise<unknown>;
    };
  };
}

export async function ensureSheetExists(
  client: SheetsClient,
  spreadsheetId: string,
  sheetName: string
): Promise<void> {
  const res = await client.spreadsheets.get({ spreadsheetId });
  const sheets = res.data.sheets || [];
  const exists = sheets.some((s) => s.properties.title === sheetName);

  if (!exists) {
    await client.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: sheetName },
            },
          },
        ],
      },
    });

    // Write headers to the new sheet
    await client.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!A1`,
      valueInputOption: "RAW",
      requestBody: { values: [SHEET_HEADERS] },
    });
  }
}

export async function appendSaleToSheet(
  client: SheetsClient,
  spreadsheetId: string,
  sale: Sale
): Promise<void> {
  const sheetName = getMonthSheetName(sale.date);
  await ensureSheetExists(client, spreadsheetId, sheetName);

  const row = saleToSheetRow(sale);
  await client.spreadsheets.values.append({
    spreadsheetId,
    range: `'${sheetName}'!A:V`,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });
}

export async function syncAllSalesToSheets(
  client: SheetsClient,
  spreadsheetId: string,
  sales: Sale[]
): Promise<number> {
  // Group by month sheet
  const bySheet = new Map<string, Sale[]>();
  for (const sale of sales) {
    const name = getMonthSheetName(sale.date);
    if (!bySheet.has(name)) bySheet.set(name, []);
    bySheet.get(name)!.push(sale);
  }

  let rowsSynced = 0;

  for (const [sheetName, sheetSales] of bySheet) {
    await ensureSheetExists(client, spreadsheetId, sheetName);

    // Overwrite from row 2 (keep header)
    const rows = sheetSales.map(saleToSheetRow);
    await client.spreadsheets.values.update({
      spreadsheetId,
      range: `'${sheetName}'!A2`,
      valueInputOption: "RAW",
      requestBody: { values: rows },
    });

    rowsSynced += rows.length;
  }

  return rowsSynced;
}
