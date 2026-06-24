import React from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, type HTMLMotionProps } from 'framer-motion';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface CardProps extends HTMLMotionProps<"div"> {
    noPadding?: boolean;
    glass?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
    ({ className, children, noPadding = false, glass = false, ...props }, ref) => {
        return (
            <motion.div
                ref={ref}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -2, boxShadow: "0 8px 30px rgba(0,0,0,0.07), 0 2px 8px rgba(0,0,0,0.04)" }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className={cn(
                    'rounded-2xl border overflow-hidden transition-colors duration-200',
                    glass
                        ? 'bg-white/70 backdrop-blur-xl border-white/30 shadow-sm'
                        : 'bg-white border-slate-100/80 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_14px_rgba(0,0,0,0.03)]',
                    !noPadding && 'p-5',
                    className
                )}
                {...props}
            >
                {children}
            </motion.div>
        );
    }
);

Card.displayName = 'Card';
