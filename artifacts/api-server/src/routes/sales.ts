import { Router } from "express";
import { db, inventoryTable, salesTable } from "@workspace/db";
import {
  CreateSaleBody,
  GetSaleParams,
  DeleteSaleParams,
  ListSalesQueryParams,
  GetSalesSummaryQueryParams,
  GetSalesReportQueryParams,
} from "@workspace/api-zod";
import { eq, desc, gte, lte, and, count, sql } from "drizzle-orm";
import { calculateSaleValues } from "../lib/calculations.js";
import {
  appendSaleToSheet,
  syncAllSalesToSheets,
} from "../lib/googleSheets.js";

const router = Router();

// Helper: parse numeric string from DB
function n(v: unknown): number {
  return v != null ? Number(v) : 0;
}

// Helper: build date range condition for a valid "YYYY-MM" month string.
// Returns undefined if month is falsy, null, or malformed.
function monthCondition(month: string | null | undefined) {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return undefined;
  const [year, mo] = month.split("-").map(Number);
  const start = `${year}-${String(mo).padStart(2, "0")}-01`;
  const lastDay = new Date(year, mo, 0).getDate(); // mo is 1-indexed; Date uses 0-indexed months
  const endStr = `${year}-${String(mo).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const label = `${monthNames[mo - 1]} ${year}`;
  return { cond: and(gte(salesTable.date, start), lte(salesTable.date, endStr)), label, start, endStr };
}

// Helper: build current-month condition
function currentMonthCondition() {
  const now = new Date();
  const year = now.getFullYear();
  const mo = now.getMonth() + 1;
  return monthCondition(`${year}-${String(mo).padStart(2, "0")}`)!;
}

function mapSale(row: typeof salesTable.$inferSelect) {
  return {
    id: row.id,
    serialNo: row.serialNo,
    date: row.date,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    customerAddress: row.customerAddress,
    cycleModel: row.cycleModel,
    cycleSize: row.cycleSize,
    cycleColor: row.cycleColor,
    supplier: row.supplier,
    inventoryId: row.inventoryId,
    invoiceNo: row.invoiceNo,
    buyingPrice: n(row.buyingPrice),
    profitMargin: n(row.profitMargin),
    sellingPrice: n(row.sellingPrice),
    discount: n(row.discount),
    gst: n(row.gst),
    finalPrice: n(row.finalPrice),
    profitPercent: n(row.profitPercent),
    profitAmount: n(row.profitAmount),
    lossPercent: n(row.lossPercent),
    lossAmount: n(row.lossAmount),
    modeOfPayment: row.modeOfPayment,
    expenses: row.expenses != null ? n(row.expenses) : null,
    syncedToSheets: row.syncedToSheets,
    createdAt: row.createdAt.toISOString(),
  };
}

// GET /api/sales/summary — must come before /api/sales/:id
router.get("/summary", async (req, res) => {
  const parsed = GetSalesSummaryQueryParams.safeParse(req.query);
  const month = parsed.success ? parsed.data.month : undefined;
  const mc = monthCondition(month) ?? currentMonthCondition();
  const conditions = mc.cond;
  const monthLabel = mc.label;

  const [rows, recent] = await Promise.all([
    db.select().from(salesTable).where(conditions),
    db.select().from(salesTable).where(conditions).orderBy(desc(salesTable.createdAt)).limit(5),
  ]);

  let totalRevenue = 0, totalProfit = 0, totalLoss = 0, totalExpenses = 0, totalMargin = 0;
  let profitableCount = 0, lossCount = 0;

  for (const row of rows) {
    totalRevenue += n(row.finalPrice);
    totalProfit += n(row.profitAmount);
    totalLoss += n(row.lossAmount);
    totalExpenses += n(row.expenses ?? 0);
    totalMargin += n(row.profitMargin);
    if (n(row.profitAmount) > 0) profitableCount++;
    if (n(row.lossAmount) > 0) lossCount++;
  }

  res.json({
    totalSales: rows.length,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalProfit: Math.round(totalProfit * 100) / 100,
    totalLoss: Math.round(totalLoss * 100) / 100,
    totalExpenses: Math.round(totalExpenses * 100) / 100,
    averageMargin: rows.length > 0 ? Math.round((totalMargin / rows.length) * 100) / 100 : 0,
    profitableCount,
    lossCount,
    monthLabel,
    recentSales: recent.map(mapSale),
  });
});

// GET /api/sales/report
router.get("/report", async (req, res) => {
  const parsed = GetSalesReportQueryParams.safeParse(req.query);
  if (!parsed.success) {
    return void res.status(400).json({ error: "Invalid query parameters. Provide startDate and endDate (YYYY-MM-DD)" });
  }

  const { startDate, endDate } = parsed.data;

  const rows = await db
    .select()
    .from(salesTable)
    .where(and(gte(salesTable.date, startDate), lte(salesTable.date, endDate)))
    .orderBy(salesTable.date, salesTable.serialNo);

  let totalRevenue = 0, totalProfit = 0, totalLoss = 0, totalExpenses = 0;

  for (const row of rows) {
    totalRevenue += n(row.finalPrice);
    totalProfit += n(row.profitAmount);
    totalLoss += n(row.lossAmount);
    totalExpenses += n(row.expenses ?? 0);
  }

  const netProfit = totalProfit - totalLoss;

  res.json({
    startDate,
    endDate,
    sales: rows.map(mapSale),
    summary: {
      totalSales: rows.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      totalLoss: Math.round(totalLoss * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
    },
  });
});

// POST /api/sales/sync-sheets
router.post("/sync-sheets", async (_req, res) => {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (!spreadsheetId) {
    return void res.status(503).json({
      error: "Google Sheets not configured. Set GOOGLE_SHEETS_SPREADSHEET_ID and connect Google Sheets integration.",
    });
  }

  try {
    // Dynamic import so it fails gracefully if package not present
    const { google } = await import("googleapis");

    // Use Replit connector credentials — fetched at runtime, never cached
    const connectorHost = process.env.REPLIT_CONNECTORS_HOSTNAME;
    if (!connectorHost) {
      return void res.status(503).json({ error: "Replit connector host not available" });
    }

    const tokenUrl = `https://${connectorHost}/api/v2/connection/token`;
    const identityToken = process.env.REPL_IDENTITY;
    const renewalToken = process.env.WEB_REPL_RENEWAL;

    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${identityToken}`,
      },
      body: JSON.stringify({ renewal: renewalToken, connector: "google-sheet" }),
    });

    if (!tokenRes.ok) {
      return void res.status(503).json({ error: "Failed to get Google Sheets access token" });
    }

    const { access_token } = (await tokenRes.json()) as { access_token: string };

    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token });
    const sheetsClient = google.sheets({ version: "v4", auth });

    const sales = await db.select().from(salesTable).orderBy(salesTable.date, salesTable.serialNo);

    const rowsSynced = await syncAllSalesToSheets(
      sheetsClient as unknown as Parameters<typeof syncAllSalesToSheets>[0],
      spreadsheetId,
      sales
    );

    // Mark all as synced
    await db.update(salesTable).set({ syncedToSheets: true });

    res.json({ success: true, message: "Synced to Google Sheets", rowsSynced });
  } catch (err) {
    res.status(500).json({ error: `Sync failed: ${(err as Error).message}` });
  }
});

// GET /api/sales
router.get("/", async (req, res) => {
  const parsed = ListSalesQueryParams.safeParse(req.query);
  const { page = 1, pageSize = 20, month } = parsed.success ? parsed.data : { page: 1, pageSize: 20, month: undefined };

  const conditions = monthCondition(month)?.cond;

  const offset = (page - 1) * pageSize;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(salesTable)
      .where(conditions)
      .orderBy(desc(salesTable.date), desc(salesTable.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ total: count() }).from(salesTable).where(conditions),
  ]);

  res.json({
    sales: rows.map(mapSale),
    total,
    page,
    pageSize,
  });
});

// POST /api/sales
router.post("/", async (req, res) => {
  const parsed = CreateSaleBody.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.message });
  }

  const data = parsed.data;
  if (data.inventoryId == null) {
    return void res.status(400).json({ error: "Inventory selection is required" });
  }

  // Get next serial number for the month
  const [year, mo] = data.date.split("-").map(Number);
  const start = `${year}-${String(mo).padStart(2, "0")}-01`;
  const lastDay = new Date(year, mo, 0).getDate();
  const endStr = `${year}-${String(mo).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const [{ lastSerial }] = await db
    .select({ lastSerial: sql<number>`COALESCE(MAX(${salesTable.serialNo}), 0)` })
    .from(salesTable)
    .where(and(gte(salesTable.date, start), lte(salesTable.date, endStr)));

  const saleResult = await db.transaction(async (tx) => {
    const [inventory] = await tx
      .select()
      .from(inventoryTable)
      .where(eq(inventoryTable.id, data.inventoryId!))
      .limit(1);

    if (!inventory) {
      return { error: "Selected inventory item was not found" as const };
    }

    const balanceStock = inventory.availableStock - inventory.soldStock;
    if (balanceStock <= 0) {
      return { error: "Selected inventory item is out of stock" as const };
    }

    const resolvedProfitMargin = Number(inventory.profitMargin);
    const calc = calculateSaleValues(
      Number(data.buyingPrice),
      resolvedProfitMargin,
      Number(data.discount),
      Number(data.gst)
    );

    const [created] = await tx
      .insert(salesTable)
      .values({
        serialNo: (lastSerial ?? 0) + 1,
        date: data.date,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerAddress: data.customerAddress,
        cycleModel: inventory.cycleModel,
        cycleSize: inventory.cycleSize,
        cycleColor: inventory.cycleColor,
        supplier: inventory.supplier,
        inventoryId: inventory.id,
        invoiceNo: data.invoiceNo,
        buyingPrice: String(data.buyingPrice),
        profitMargin: String(resolvedProfitMargin),
        sellingPrice: String(calc.sellingPrice),
        discount: String(data.discount),
        gst: String(data.gst),
        finalPrice: String(calc.finalPrice),
        profitPercent: String(calc.profitPercent),
        profitAmount: String(calc.profitAmount),
        lossPercent: String(calc.lossPercent),
        lossAmount: String(calc.lossAmount),
        modeOfPayment: data.modeOfPayment,
        expenses: data.expenses != null ? String(data.expenses) : null,
      })
      .returning();

    await tx
      .update(inventoryTable)
      .set({
        soldStock: sql`${inventoryTable.soldStock} + 1`,
      })
      .where(eq(inventoryTable.id, inventory.id));

    return { sale: created as typeof salesTable.$inferSelect };
  });

  if ("error" in saleResult) {
    return void res.status(400).json({ error: saleResult.error });
  }

  const newSale = saleResult.sale;
  const mapped = mapSale(newSale);

  // Async sync to sheets if configured
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  if (spreadsheetId) {
    (async () => {
      try {
        const { google } = await import("googleapis");
        const connectorHost = process.env.REPLIT_CONNECTORS_HOSTNAME;
        const identityToken = process.env.REPL_IDENTITY;
        const renewalToken = process.env.WEB_REPL_RENEWAL;

        if (!connectorHost) return;

        const tokenUrl = `https://${connectorHost}/api/v2/connection/token`;
        const tokenRes = await fetch(tokenUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${identityToken}`,
          },
          body: JSON.stringify({ renewal: renewalToken, connector: "google-sheet" }),
        });

        if (!tokenRes.ok) return;

        const { access_token } = (await tokenRes.json()) as { access_token: string };
        const auth = new google.auth.OAuth2();
        auth.setCredentials({ access_token });
        const sheetsClient = google.sheets({ version: "v4", auth });

        await appendSaleToSheet(
          sheetsClient as unknown as Parameters<typeof appendSaleToSheet>[0],
          spreadsheetId,
          newSale
        );

        await db.update(salesTable).set({ syncedToSheets: true }).where(eq(salesTable.id, newSale.id));
      } catch (_) {
        // Silently fail — sale is already saved locally
      }
    })();
  }

  res.status(201).json(mapped);
});

// PUT /api/sales/:id
router.put("/:id", async (req, res) => {
  const saleId = Number(req.params.id);
  if (!Number.isInteger(saleId) || saleId <= 0) {
    return void res.status(400).json({ error: "Invalid sale ID" });
  }

  const parsed = CreateSaleBody.safeParse(req.body);
  if (!parsed.success) {
    return void res.status(400).json({ error: parsed.error.message });
  }

  const data = parsed.data;
  if (data.inventoryId == null) {
    return void res.status(400).json({ error: "Inventory selection is required" });
  }

  const saleResult = await db.transaction(async (tx) => {
    const [currentSale] = await tx.select().from(salesTable).where(eq(salesTable.id, saleId)).limit(1);
    if (!currentSale) {
      return { error: "Sale not found" as const };
    }

    const [inventory] = await tx.select().from(inventoryTable).where(eq(inventoryTable.id, data.inventoryId!)).limit(1);
    if (!inventory) {
      return { error: "Selected inventory item was not found" as const };
    }

    const oldInventoryId = currentSale.inventoryId;
    const changedInventory = oldInventoryId !== inventory.id;

    if (changedInventory && oldInventoryId != null) {
      await tx
        .update(inventoryTable)
        .set({
          soldStock: sql`GREATEST(${inventoryTable.soldStock} - 1, 0)`,
        })
        .where(eq(inventoryTable.id, oldInventoryId));
    }

    if (changedInventory) {
      const balanceStock = inventory.availableStock - inventory.soldStock;
      if (balanceStock <= 0) {
        return { error: "Selected inventory item is out of stock" as const };
      }
    }

    const resolvedProfitMargin = Number(inventory.profitMargin);
    const calc = calculateSaleValues(
      Number(data.buyingPrice),
      resolvedProfitMargin,
      Number(data.discount),
      Number(data.gst)
    );

    const [updated] = await tx
      .update(salesTable)
      .set({
        date: data.date,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerAddress: data.customerAddress,
        cycleModel: inventory.cycleModel,
        cycleSize: inventory.cycleSize,
        cycleColor: inventory.cycleColor,
        supplier: inventory.supplier,
        inventoryId: inventory.id,
        invoiceNo: data.invoiceNo,
        buyingPrice: String(data.buyingPrice),
        profitMargin: String(resolvedProfitMargin),
        sellingPrice: String(calc.sellingPrice),
        discount: String(data.discount),
        gst: String(data.gst),
        finalPrice: String(calc.finalPrice),
        profitPercent: String(calc.profitPercent),
        profitAmount: String(calc.profitAmount),
        lossPercent: String(calc.lossPercent),
        lossAmount: String(calc.lossAmount),
        modeOfPayment: data.modeOfPayment,
        expenses: data.expenses != null ? String(data.expenses) : null,
      })
      .where(eq(salesTable.id, saleId))
      .returning();

    if (changedInventory) {
      await tx
        .update(inventoryTable)
        .set({
          soldStock: sql`${inventoryTable.soldStock} + 1`,
        })
        .where(eq(inventoryTable.id, inventory.id));
    }

    return { sale: updated };
  });

  if ("error" in saleResult) {
    return void res.status(400).json({ error: saleResult.error });
  }

  res.json(mapSale(saleResult.sale));
});

// GET /api/sales/:id
router.get("/:id", async (req, res) => {
  const parsed = GetSaleParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    return void res.status(400).json({ error: "Invalid sale ID" });
  }

  const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, parsed.data.id));
  if (!sale) {
    return void res.status(404).json({ error: "Sale not found" });
  }

  res.json(mapSale(sale));
});

// DELETE /api/sales/:id
router.delete("/:id", async (req, res) => {
  const parsed = DeleteSaleParams.safeParse({ id: Number(req.params.id) });
  if (!parsed.success) {
    return void res.status(400).json({ error: "Invalid sale ID" });
  }

  const [deleted] = await db
    .delete(salesTable)
    .where(eq(salesTable.id, parsed.data.id))
    .returning();

  if (!deleted) {
    return void res.status(404).json({ error: "Sale not found" });
  }

  if (deleted.inventoryId != null) {
    await db
      .update(inventoryTable)
      .set({
        soldStock: sql`GREATEST(${inventoryTable.soldStock} - 1, 0)`,
      })
      .where(eq(inventoryTable.id, deleted.inventoryId));
  }

  res.json({ success: true, message: "Sale deleted" });
});

export default router;
