import { memo } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { Wind, Activity, AlertCircle, Coffee } from 'lucide-react';

const nodeTypes = {
    habit: {
        borderColor: '#e2e8f0',
        bg: 'bg-white',
        gradient: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        icon: Coffee,
        labelColor: 'text-slate-500',
        titleColor: 'text-gray-900',
        iconBg: 'bg-slate-100',
    },
    guna: {
        borderColor: '#bfdbfe',
        bg: 'bg-blue-50',
        gradient: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)',
        icon: Wind,
        labelColor: 'text-blue-500',
        titleColor: 'text-blue-900',
        iconBg: 'bg-blue-100',
    },
    dosha: {
        borderColor: '#fde68a',
        bg: 'bg-amber-50',
        gradient: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
        icon: Activity,
        labelColor: 'text-amber-600',
        titleColor: 'text-amber-900',
        iconBg: 'bg-amber-100',
    },
    symptom: {
        borderColor: '#fecaca',
        bg: 'bg-red-50',
        gradient: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
        icon: AlertCircle,
        labelColor: 'text-red-500',
        titleColor: 'text-red-900',
        iconBg: 'bg-red-100',
    },
};

const CustomNode = ({ data, selected }: NodeProps) => {
    const type = (data.type || 'habit') as keyof typeof nodeTypes;
    const config = nodeTypes[type];
    const Icon = config.icon;

    return (
        <div
            className={`relative min-w-[200px] rounded-2xl p-4 shadow-lg transition-all duration-200 cursor-pointer ${selected ? 'ring-2 ring-primary ring-offset-2' : 'hover:shadow-xl hover:-translate-y-0.5'
                }`}
            style={{
                background: config.gradient,
                border: `2px solid ${selected ? '#22C55E' : config.borderColor}`,
            }}
        >
            <Handle type="target" position={Position.Left} className="w-3 h-3 !bg-slate-300 border-2 border-white" />

            <div className="flex items-center gap-2 mb-2.5">
                <div className={`w-6 h-6 rounded-lg ${config.iconBg} flex items-center justify-center`}>
                    <Icon size={12} className={config.labelColor} />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-[0.12em] ${config.labelColor}`}>
                    {type}
                </span>
            </div>

            <h4 className={`font-bold text-sm ${config.titleColor} leading-snug`}>{data.label}</h4>
            {data.subLabel && (
                <p className="text-[10px] text-slate-400 mt-1.5 font-medium leading-relaxed">{data.subLabel}</p>
            )}

            <Handle type="source" position={Position.Right} className="w-3 h-3 !bg-primary border-2 border-white" />
        </div>
    );
};

export default memo(CustomNode);
