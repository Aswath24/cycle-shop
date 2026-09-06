import { Link, useLocation } from "wouter"
import { LayoutDashboard, PlusCircle, List, FileText, Wrench, Boxes } from "lucide-react"
import { cn } from "@/lib/utils"

export function Sidebar() {
  const [location] = useLocation()

  const links = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/entry", label: "New Sale", icon: PlusCircle },
    { href: "/inventory", label: "Inventory", icon: Boxes },
    { href: "/sales", label: "All Sales", icon: List },
    { href: "/report", label: "Report", icon: FileText },
  ]

  return (
    <aside className="w-64 bg-sidebar flex-shrink-0 flex flex-col h-full border-r border-sidebar-border shadow-xl">
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border bg-sidebar-accent/30">
        <Wrench className="w-6 h-6 text-sidebar-primary mr-3" />
        <span className="text-sidebar-foreground font-bold text-lg tracking-wide uppercase">Cycle Shop</span>
      </div>
      <nav className="flex-1 px-4 py-6 space-y-2">
        {links.map((link) => {
          const isActive = location === link.href
          const Icon = link.icon
          return (
            <Link key={link.href} href={link.href}>
              <div
                className={cn(
                  "flex items-center px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                )}
                data-testid={`nav-${link.label.toLowerCase().replace(" ", "-")}`}
              >
                <Icon className={cn("w-5 h-5 mr-3", isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/50")} />
                {link.label}
              </div>
            </Link>
          )
        })}
      </nav>
      <div className="p-4 border-t border-sidebar-border">
        <div className="text-xs text-sidebar-foreground/40 text-center">
          Cycle Shop Admin v1.0
        </div>
      </div>
    </aside>
  )
}
