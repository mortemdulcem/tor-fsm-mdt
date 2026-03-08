import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Activity, ShieldAlert, Terminal, Network, ShieldCheck } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: Activity },
    { href: "/test-runs", label: "Sandbox Runs", icon: Terminal },
    { href: "/security", label: "Threat Intel", icon: ShieldAlert },
  ];

  return (
    <div className="min-h-screen flex bg-background text-foreground overflow-hidden selection:bg-primary/20">
      {/* Sidebar */}
      <aside className="w-64 border-r border-white/5 bg-card/40 backdrop-blur-md flex flex-col hidden md:flex shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-white/5">
          <Network className="w-6 h-6 text-primary mr-3 animate-pulse" />
          <span className="font-mono font-bold tracking-wider text-primary">TOR_FSM_MON</span>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                  isActive 
                    ? "bg-primary/10 text-primary tech-glow" 
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5 mr-3 transition-colors", 
                  isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                )} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 flex items-center">
            <ShieldCheck className="w-5 h-5 text-green-400 mr-2" />
            <div>
              <p className="text-xs font-medium text-green-400">System Online</p>
              <p className="text-[10px] text-green-400/70 font-mono">NODE_STATE_ACTIVE</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Subtle background ambient glow */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-destructive/5 blur-[120px] rounded-full pointer-events-none" />
        
        <header className="h-16 border-b border-white/5 flex items-center px-6 bg-background/50 backdrop-blur-sm z-10 shrink-0 md:hidden">
          <Network className="w-6 h-6 text-primary mr-3" />
          <span className="font-mono font-bold tracking-wider text-primary">TOR_FSM_MON</span>
        </header>
        
        <div className="flex-1 overflow-y-auto z-10 p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
