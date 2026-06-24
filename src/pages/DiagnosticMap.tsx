import { useCallback } from 'react';
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    addEdge,
    type Connection,
    type Edge,
    MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion } from 'framer-motion';
import { Info, Edit3, Activity, Zap } from 'lucide-react';
import { DashboardLayout } from '../layouts/DashboardLayout';
import CustomNode from '../components/map/CustomNode';
import { Card } from '../components/ui/Card';

const nodeTypes = {
    custom: CustomNode,
};

const initialNodes = [
    // Root Causes
    {
        id: '1',
        type: 'custom',
        position: { x: 100, y: 200 },
        data: { label: 'Late Dinners', subLabel: 'Eating after 9 PM', type: 'habit' },
    },
    {
        id: '2',
        type: 'custom',
        position: { x: 100, y: 350 },
        data: { label: 'Sedentary Morning', subLabel: 'Lack of Vyayama', type: 'habit' },
    },
    // Gunas
    {
        id: '3',
        type: 'custom',
        position: { x: 400, y: 150 },
        data: { label: 'Sheeta (Cold)', subLabel: 'Slowing metabolic Agni', type: 'guna' },
    },
    {
        id: '4',
        type: 'custom',
        position: { x: 400, y: 300 },
        data: { label: 'Guru (Heavy)', subLabel: 'Leading to Ama', type: 'guna' },
    },
    // Dosha
    {
        id: '5',
        type: 'custom',
        position: { x: 700, y: 220 },
        data: { label: 'Kapha Increase', subLabel: 'Koshtha vitiation', type: 'dosha' },
    },
    // Symptoms
    {
        id: '6',
        type: 'custom',
        position: { x: 1000, y: 180 },
        data: { label: 'Morning Bloating', subLabel: 'Adhmana', type: 'symptom' },
    },
    {
        id: '7',
        type: 'custom',
        position: { x: 1000, y: 320 },
        data: { label: 'Lethargy', subLabel: 'Alasya', type: 'symptom' },
    },
];

const initialEdges = [
    { id: 'e1-3', source: '1', target: '3', animated: true, style: { strokeWidth: 2, stroke: '#94a3b8' } },
    { id: 'e1-4', source: '1', target: '4', animated: true, style: { strokeWidth: 2, stroke: '#94a3b8' } },
    { id: 'e2-4', source: '2', target: '4', style: { strokeWidth: 2, stroke: '#e2e8f0' } },
    { id: 'e3-5', source: '3', target: '5', animated: true, style: { strokeWidth: 2, stroke: '#22C55E' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#22C55E' } },
    { id: 'e4-5', source: '4', target: '5', animated: true, style: { strokeWidth: 2, stroke: '#22C55E' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#22C55E' } },
    { id: 'e5-6', source: '5', target: '6', animated: true, style: { strokeWidth: 2, stroke: '#ef4444' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#ef4444' } },
    { id: 'e5-7', source: '5', target: '7', animated: true, style: { strokeWidth: 2, stroke: '#ef4444' }, markerEnd: { type: MarkerType.ArrowClosed, color: '#ef4444' } },
];

const Stage = ({ stage, desc, active }: { stage: string, desc: string, active?: boolean }) => (
    <div className="relative pl-5">
        <div className={`absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white transition-colors ${active ? 'bg-primary shadow-sm shadow-primary/30' : 'bg-slate-200'}`}
            style={active ? { boxShadow: '0 0 0 3px rgba(34,197,94,0.1)' } : undefined}
        />
        <span className={`text-xs font-bold block ${active ? 'text-primary' : 'text-gray-800'}`}>{stage}</span>
        <span className="text-[10px] text-slate-400 font-medium leading-relaxed">{desc}</span>
    </div>
);

export default function DiagnosticMap() {
    const [nodes, , onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    const onConnect = useCallback((params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)), [setEdges]);

    return (
        <DashboardLayout>
            <div className="flex h-[calc(100vh-8rem)]">
                <div className="flex-1 rounded-2xl overflow-hidden border border-slate-100 bg-[#FAFBFC] relative"
                    style={{ boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.03)' }}
                >
                    <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        nodeTypes={nodeTypes as any}
                        fitView
                        attributionPosition="bottom-left"
                    >
                        <Background color="#e2e8f0" gap={24} size={1} />
                        <Controls className="!rounded-xl !border-slate-100 !shadow-sm" />
                        <MiniMap style={{ height: 100, borderRadius: 12, border: '1px solid #e2e8f0' }} zoomable pannable />
                    </ReactFlow>

                    <div className="absolute bottom-4 left-4 flex gap-3 bg-white/95 backdrop-blur-sm p-2.5 rounded-xl border border-slate-100 shadow-sm text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500 z-10">
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-slate-200 rounded-full border border-slate-300"></div>Hábito</div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-blue-200 rounded-full border border-blue-300"></div>Guna</div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-amber-200 rounded-full border border-amber-300"></div>Dosha</div>
                        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-red-200 rounded-full border border-red-300"></div>Síntoma</div>
                    </div>
                </div>

                {/* Pathology Insight Panel */}
                <motion.div
                    initial={{ x: 50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="w-80 ml-6 flex flex-col gap-4"
                >
                    <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">Análisis de Patología</h3>
                        <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center">
                            <Info size={12} className="text-slate-400" />
                        </div>
                    </div>

                    <Card noPadding className="border-0 overflow-hidden" style={{
                        background: 'linear-gradient(135deg, #0d1a13 0%, #132e1d 100%)',
                        border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                        <div className="p-5">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center">
                                    <Zap size={12} className="text-primary" />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-400">Cadena Activa</span>
                            </div>
                            <p className="text-sm text-white/70 leading-relaxed">
                                El hábito de <strong className="text-white">Cenas Tardías</strong> introduce cualidades <strong className="text-emerald-300">Sheeta</strong> (frío) al estómago cuando el <strong className="text-white">Agni</strong> natural mengua.
                            </p>
                        </div>
                    </Card>

                    <Card>
                        <div className="flex items-center gap-2 mb-5">
                            <div className="w-6 h-6 rounded-lg bg-slate-50 flex items-center justify-center">
                                <Activity size={12} className="text-slate-400" />
                            </div>
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">Progresión Clínica</h4>
                        </div>
                        <div className="relative pl-5 space-y-5 before:absolute before:left-[4px] before:top-3 before:bottom-3 before:w-px before:bg-slate-100">
                            <Stage stage="Inicio Samprapti" desc="Digestión alterada por cenas nocturnas" active />
                            <Stage stage="Dosha Sanchaya" desc="Acumulación de Kapha en estómago" />
                            <Stage stage="Vyakti" desc="Manifestación de hinchazón matinal" />
                        </div>

                        <button className="w-full mt-6 py-2.5 bg-slate-50 hover:bg-primary hover:text-white border border-slate-200 hover:border-primary text-slate-600 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2">
                            <Edit3 size={14} />
                            Editar Datos
                        </button>
                    </Card>
                </motion.div>
            </div>
        </DashboardLayout>
    );
}
