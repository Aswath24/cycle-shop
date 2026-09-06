import { useState } from "react"
import { useGetSalesReport, getGetSalesReportQueryKey } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Download, AlertCircle } from "lucide-react"

export default function Report() {
  const defaultStart = new Date()
  defaultStart.setDate(1) // First day of current month
  
  const [startDate, setStartDate] = useState(defaultStart.toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

  const queryParams = { startDate, endDate }

  const { data: report, isLoading } = useGetSalesReport(queryParams, {
    query: {
      queryKey: getGetSalesReportQueryKey(queryParams),
      enabled: !!startDate && !!endDate
    }
  })

  const downloadCSV = () => {
    if (!report?.sales || report.sales.length === 0) return

    const headers = [
      "S.No", "Date", "Customer Name", "Customer Phone", "Customer Address",
      "Cycle Model", "Cycle Size", "Cycle Color", "Supplier", "Invoice No", 
      "Buying Price", "Profit Margin %", "Selling Price", "Discount %", "GST %", "Final Price",
      "Profit %", "Profit Amount", "Loss %", "Loss Amount", "Mode of Payment", "Expenses"
    ]

    const rows = report.sales.map((s, i) => [
      i + 1,
      s.date,
      `"${s.customerName}"`,
      `"${s.customerPhone}"`,
      `"${s.customerAddress}"`,
      `"${s.cycleModel}"`,
      `"${s.cycleSize}"`,
      `"${s.cycleColor}"`,
      `"${s.supplier}"`,
      `"${s.invoiceNo}"`,
      s.buyingPrice,
      s.profitMargin,
      s.sellingPrice,
      s.discount,
      s.gst,
      s.finalPrice,
      s.profitPercent,
      s.profitAmount,
      s.lossPercent,
      s.lossAmount,
      `"${s.modeOfPayment}"`,
      s.expenses || 0
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `sales-report-${startDate}-to-${endDate}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Sales Report</h1>
          <p className="text-muted-foreground mt-1">Generate and export consolidated sales data.</p>
        </div>
        
        <div className="flex items-end gap-3 w-full md:w-auto">
          <div className="space-y-1">
            <Label htmlFor="start" className="text-xs">Start Date</Label>
            <Input 
              type="date" 
              id="start" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              className="h-9 w-[140px]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="end" className="text-xs">End Date</Label>
            <Input 
              type="date" 
              id="end" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              className="h-9 w-[140px]"
            />
          </div>
          <Button 
            onClick={downloadCSV} 
            disabled={!report?.sales || report.sales.length === 0}
            className="h-9 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96 w-full mt-6" />
        </div>
      ) : report ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <Card className="border-border shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-xs font-medium text-muted-foreground mb-1">Total Sales</p>
                <p className="text-xl font-bold">{report.summary.totalSales}</p>
              </CardContent>
            </Card>
            <Card className="border-border shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-xs font-medium text-muted-foreground mb-1">Total Revenue</p>
                <p className="text-xl font-bold text-primary">{formatCurrency(report.summary.totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card className="border-border shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-xs font-medium text-muted-foreground mb-1">Total Profit</p>
                <p className="text-xl font-bold text-emerald-500">{formatCurrency(report.summary.totalProfit)}</p>
              </CardContent>
            </Card>
            <Card className="border-border shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-xs font-medium text-muted-foreground mb-1">Total Loss</p>
                <p className="text-xl font-bold text-red-500">{formatCurrency(report.summary.totalLoss)}</p>
              </CardContent>
            </Card>
            <Card className="border-border shadow-sm">
              <CardContent className="p-4 text-center">
                <p className="text-xs font-medium text-muted-foreground mb-1">Total Expenses</p>
                <p className="text-xl font-bold">{formatCurrency(report.summary.totalExpenses)}</p>
              </CardContent>
            </Card>
            <Card className="border-border shadow-sm bg-sidebar text-sidebar-foreground">
              <CardContent className="p-4 text-center">
                <p className="text-xs font-medium text-sidebar-foreground/70 mb-1">Net Profit</p>
                <p className="text-xl font-bold text-sidebar-primary">{formatCurrency(report.summary.netProfit)}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-border shadow-sm">
            <CardHeader className="py-4 border-b">
              <CardTitle className="text-lg font-medium">Detailed Entries</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <Table className="relative">
                  <TableHeader className="bg-muted/90 sticky top-0 z-10 backdrop-blur-sm whitespace-nowrap">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Cycle</TableHead>
                      <TableHead className="text-right">BP (₹)</TableHead>
                      <TableHead className="text-right">SP (₹)</TableHead>
                      <TableHead className="text-right">Dis. %</TableHead>
                      <TableHead className="text-right">GST %</TableHead>
                      <TableHead className="text-right">Final (₹)</TableHead>
                      <TableHead className="text-right">Profit/Loss (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.sales.length > 0 ? (
                      report.sales.map((sale) => (
                        <TableRow key={sale.id} className="whitespace-nowrap">
                          <TableCell className="text-xs text-muted-foreground">{formatDate(sale.date)}</TableCell>
                          <TableCell className="font-medium">{sale.customerName}</TableCell>
                          <TableCell>{sale.cycleModel} ({sale.cycleSize} / {sale.cycleColor})</TableCell>
                          <TableCell className="text-right text-muted-foreground">{sale.buyingPrice}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{sale.sellingPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{sale.discount}%</TableCell>
                          <TableCell className="text-right text-muted-foreground">{sale.gst}%</TableCell>
                          <TableCell className="text-right font-bold">{sale.finalPrice.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            {sale.profitAmount > 0 ? (
                              <span className="text-emerald-500 font-medium">+{sale.profitAmount.toFixed(2)}</span>
                            ) : sale.lossAmount > 0 ? (
                              <span className="text-red-500 font-medium">-{sale.lossAmount.toFixed(2)}</span>
                            ) : (
                              <span className="text-muted-foreground">0.00</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                          <AlertCircle className="mx-auto h-8 w-8 mb-2 opacity-50" />
                          No data available for this range.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
