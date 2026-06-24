import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: 'success' | 'warning' | 'info' | 'neutral' | 'gradient';
    pulse?: boolean;
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
    ({ className, variant = 'neutral', pulse = false, children, ...props }, ref) => {
        const variants = {
            success: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
            warning: 'bg-amber-50 text-amber-600 border border-amber-100',
            info: 'bg-blue-50 text-blue-600 border border-blue-100',
            neutral: 'bg-slate-50 text-slate-500 border border-slate-100',
            gradient: 'bg-gradient-to-r from-primary/10 to-accent/10 text-primary border border-primary/10',
        };

        return (
            <span
                ref={ref}
                className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide',
                    variants[variant],
                    className
                )}
                {...props}
            >
                {pulse && (
                    <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-50" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-current" />
                    </span>
                )}
                {children}
            </span>
        );
    }
);

Badge.displayName = 'Badge';
