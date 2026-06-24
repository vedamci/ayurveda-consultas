import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface Step {
    id: string;
    label: string;
    status: 'pending' | 'current' | 'completed';
}

interface StepperProps {
    steps: Step[];
    currentStepIndex: number;
}

export const VerticalStepper = ({ steps, currentStepIndex }: StepperProps) => {
    return (
        <div className="space-y-1 relative py-2">
            {/* Vertical line */}
            <div className="absolute left-[15px] top-6 bottom-6 w-[2px] bg-slate-100 -z-10 rounded-full" />

            {steps.map((step, index) => {
                const isCompleted = index < currentStepIndex;
                const isCurrent = index === currentStepIndex;

                return (
                    <div key={step.id} className="flex items-center gap-4 py-2.5">
                        <motion.div
                            initial={false}
                            animate={{
                                scale: isCurrent ? 1.15 : 1,
                            }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            className={`w-8 h-8 rounded-full flex items-center justify-center border-[3px] z-10 transition-colors duration-300 ${isCompleted
                                    ? 'bg-primary border-primary/20'
                                    : isCurrent
                                        ? 'border-primary bg-primary'
                                        : 'border-slate-200 bg-white'
                                }`}
                            style={isCurrent ? {
                                boxShadow: '0 0 0 4px rgba(34, 197, 94, 0.1), 0 0 12px rgba(34, 197, 94, 0.15)'
                            } : undefined}
                        >
                            {isCompleted ? (
                                <Check size={14} className="text-white" strokeWidth={3} />
                            ) : (
                                <span className={`text-xs font-bold ${isCurrent ? 'text-white' : 'text-slate-400'}`}>
                                    {index + 1}
                                </span>
                            )}
                        </motion.div>

                        <div className="flex flex-col">
                            <span className={`text-[13px] font-semibold transition-colors duration-200 ${isCurrent ? 'text-gray-900' : isCompleted ? 'text-slate-500' : 'text-slate-400'
                                }`}>
                                {step.label}
                            </span>
                            {isCurrent && (
                                <motion.span
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="text-[10px] text-primary uppercase font-bold tracking-[0.15em] mt-0.5"
                                >
                                    En Progreso
                                </motion.span>
                            )}
                            {isCompleted && (
                                <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-[0.15em] mt-0.5">
                                    Completado
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
