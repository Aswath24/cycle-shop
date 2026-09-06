import { useGetSalesSummary, useSyncToSheets } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatDate } from "@/lib/utils"
import { Link } from "wouter"
import { PlusCircle, RefreshCw, IndianRupee, TrendingUp, TrendingDown, ShoppingCart } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function Dashboard() {
  const { data: summary, isLoading, refetch } = useGetSalesSummary(undefined, {
    query: {
      queryKey: ["/api/sales/summary"]
    }
  })
  const syncToSheets = useSyncToSheets()
  const { toast } = useToast()

  const handleSync = () => {
    syncToSheets.mutate(undefined, {
      onSuccess: (res) => {
        toast({
          title: "Sync Successful",
          description: res.message,
        })
      },
      onError: (err: any) => {
        toast({
          title: "Sync Failed",
          description: err?.data?.error || err?.message || err?.error || "Unknown error occurred",
          variant: "destructive",
        })
      }
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  const statCards = [
    { title: "Total Sales", value: summary?.totalSales || 0, icon: ShoppingCart, color: "text-blue-500" },
    { title: "Total Revenue", value: formatCurrency(summary?.totalRevenue), icon: IndianRupee, color: "text-primary" },
    { title: "Total Profit", value: formatCurrency(summary?.totalProfit), icon: TrendingUp, color: "text-emerald-500" },
    { title: "Total Loss", value: formatCurrency(summary?.totalLoss), icon: TrendingDown, color: "text-red-500" },
  ]

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview for {summary?.monthLabel || "Current Month"}</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={handleSync} 
            disabled={syncToSheets.isPending}
            className="border-primary/20 text-foreground hover:bg-primary/5 hover:text-primary"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncToSheets.isPending ? "animate-spin" : ""}`} />
            {syncToSheets.isPending ? "Syncing..." : "Sync to Sheets"}
          </Button>
          <Link href="/entry" className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground shadow hover:bg-primary/90 h-9 px-4 py-2 shadow-lg shadow-primary/20">
            <PlusCircle className="w-4 h-4 mr-2" />
            New Sale
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => {
          const Icon = stat.icon
          return (
            <Card key={i} className="border-border shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <div className={`p-2 bg-muted rounded-md ${stat.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-4">
                  <h3 className="text-2xl font-bold">{stat.value}</h3>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <CardTitle className="text-lg">Recent Sales</CardTitle>
          <Link href="/sales" className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-3 text-xs text-primary hover:text-primary/80 hover:bg-primary/10">View all</Link>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Final Price</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary?.recentSales && summary.recentSales.length > 0 ? (
                summary.recentSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-medium">{formatDate(sale.date)}</TableCell>
                    <TableCell>{sale.customerName}</TableCell>
                    <TableCell>{sale.cycleModel} ({sale.cycleSize} / {sale.cycleColor})</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground">
                        {sale.modeOfPayment}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(sale.finalPrice)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No recent sales found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
