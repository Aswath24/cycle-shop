import { useState } from "react"
import { useListSales, useDeleteSale, getListSalesQueryKey, getGetSalesSummaryQueryKey, getListInventoryQueryKey } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { NativeSelect } from "@/components/ui/native-select"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatDate } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import { Pencil, Trash2, AlertCircle } from "lucide-react"
import { Link } from "wouter"

export default function AllSales() {
  const [page, setPage] = useState(1)
  const [month, setMonth] = useState<string>("All")
  
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const deleteSale = useDeleteSale()

  // Generate last 12 months for filter
  const monthOptions = []
  const date = new Date()
  for (let i = 0; i < 12; i++) {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    monthOptions.push(`${y}-${m}`)
    date.setMonth(date.getMonth() - 1)
  }

  const queryParams = { 
    page, 
    pageSize: 15, 
    month: month === "All" ? null : month 
  }

  const { data, isLoading } = useListSales(queryParams, {
    query: {
      queryKey: getListSalesQueryKey(queryParams)
    }
  })

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this sale? This action cannot be undone.")) {
      deleteSale.mutate({ id }, {
        onSuccess: () => {
          toast({
            title: "Sale deleted",
            description: `Sale #${id} has been removed.`,
          })
          queryClient.invalidateQueries({ queryKey: ["/api/sales"] })
          queryClient.invalidateQueries({ queryKey: getGetSalesSummaryQueryKey() })
          queryClient.invalidateQueries({ queryKey: getListInventoryQueryKey() })
        },
        onError: (err: any) => {
          toast({
            title: "Error",
            description: err?.data?.error || err?.message || err?.error || "Failed to delete sale",
            variant: "destructive"
          })
        }
      })
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">All Sales</h1>
          <p className="text-muted-foreground mt-1">Browse and manage the full sales history.</p>
        </div>
        <div className="w-full sm:w-48">
          <NativeSelect 
            value={month} 
            onChange={(e) => {
              setMonth(e.target.value)
              setPage(1)
            }}
          >
            <option value="All">All Months</option>
            {monthOptions.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <Card className="border-border shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50 whitespace-nowrap">
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Cycle Model</TableHead>
                  <TableHead>Inv No.</TableHead>
                  <TableHead className="text-right">Buying Price</TableHead>
                  <TableHead className="text-right">Final Price</TableHead>
                  <TableHead className="text-right">P/L Amount</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={10}><Skeleton className="h-10 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : data?.sales && data.sales.length > 0 ? (
                  data.sales.map((sale) => (
                    <TableRow key={sale.id} className="whitespace-nowrap">
                      <TableCell className="text-xs text-muted-foreground">#{sale.id}</TableCell>
                      <TableCell>{formatDate(sale.date)}</TableCell>
                      <TableCell className="font-medium">{sale.customerName}</TableCell>
                      <TableCell>
                        {sale.cycleModel}{" "}
                        <span className="text-xs text-muted-foreground">({sale.cycleSize} / {sale.cycleColor})</span>
                      </TableCell>
                      <TableCell>{sale.invoiceNo}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{formatCurrency(sale.buyingPrice)}</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(sale.finalPrice)}</TableCell>
                      <TableCell className="text-right">
                        {sale.profitAmount > 0 ? (
                          <span className="text-emerald-500 font-medium">+{formatCurrency(sale.profitAmount)}</span>
                        ) : (
                          <span className="text-red-500 font-medium">-{formatCurrency(sale.lossAmount)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center gap-2">
                          <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                            <Link href={`/sales/${sale.id}/edit`}>
                              <Pencil className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(sale.id)}
                            disabled={deleteSale.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center text-muted-foreground">
                      <AlertCircle className="mx-auto h-8 w-8 mb-2 opacity-50" />
                      No sales records found for this period.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          {data && data.total > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
              <div className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">{(page - 1) * data.pageSize + 1}</span> to <span className="font-medium text-foreground">{Math.min(page * data.pageSize, data.total)}</span> of <span className="font-medium text-foreground">{data.total}</span> entries
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={page * data.pageSize >= data.total}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
