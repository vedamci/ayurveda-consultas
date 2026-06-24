import { motion } from 'framer-motion';

interface Option {
    value: string;
    label: string;
}

interface SegmentedControlProps {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
}

export const SegmentedControl = ({ options, value, onChange }: SegmentedControlProps) => {
    return (
        <div className="flex bg-slate-100 p-1 rounded-xl">
            {options.map((option) => {
                const isActive = value === option.value;
                return (
                    <button
                        key={option.value}
                        onClick={() => onChange(option.value)}
                        className={`relative flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors z-0 ${isActive ? 'text-primary-700' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        {isActive && (
                            <motion.div
                                layoutId="segmented-pill"
                                className="absolute inset-0 bg-white rounded-lg shadow-sm border border-slate-200 -z-10"
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                            />
                        )}
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
};
