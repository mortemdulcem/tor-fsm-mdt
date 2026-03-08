import { ReactNode } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Card({ className, children }: { className?: string, children: ReactNode }) {
  return (
    <div className={cn("glass-panel rounded-xl overflow-hidden", className)}>
      {children}
    </div>
  );
}

export function Badge({ 
  children, 
  variant = 'default',
  className
}: { 
  children: ReactNode, 
  variant?: 'default' | 'success' | 'destructive' | 'warning' | 'outline',
  className?: string
}) {
  const variants = {
    default: "bg-primary/20 text-primary border-primary/30",
    success: "bg-green-500/20 text-green-400 border-green-500/30",
    destructive: "bg-destructive/20 text-destructive border-destructive/30",
    warning: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    outline: "bg-transparent text-muted-foreground border-white/10"
  };

  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold border inline-flex items-center whitespace-nowrap", variants[variant], className)}>
      {children}
    </span>
  );
}

export function Button({ 
  children, 
  onClick, 
  disabled, 
  variant = 'primary',
  className
}: { 
  children: ReactNode, 
  onClick?: () => void, 
  disabled?: boolean,
  variant?: 'primary' | 'destructive' | 'outline' | 'ghost',
  className?: string
}) {
  const base = "inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90 hover:tech-glow focus:ring-primary/50",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:tech-glow-red focus:ring-destructive/50",
    outline: "border border-white/10 bg-transparent hover:bg-white/5 text-foreground focus:ring-white/20",
    ghost: "bg-transparent hover:bg-white/5 text-muted-foreground hover:text-foreground focus:ring-white/20"
  };

  return (
    <button onClick={onClick} disabled={disabled} className={cn(base, variants[variant], className)}>
      {children}
    </button>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="w-full overflow-x-auto rounded-lg border border-white/5">
      <table className="w-full text-sm text-left">
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className }: { children: ReactNode, className?: string }) {
  return <th className={cn("px-4 py-3 bg-white/5 text-muted-foreground font-medium border-b border-white/5", className)}>{children}</th>;
}

export function Td({ children, className }: { children: ReactNode, className?: string }) {
  return <td className={cn("px-4 py-3 border-b border-white/5/50 font-mono text-xs", className)}>{children}</td>;
}
