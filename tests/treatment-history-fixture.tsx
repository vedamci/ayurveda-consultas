import { createRoot } from 'react-dom/client';
import { SavedRecommendations } from '../src/components/patients/SavedRecommendations';
import '../src/index.css';
createRoot(document.getElementById('root')!).render(<main style={{maxWidth:480,margin:'20px auto'}}><SavedRecommendations date="2026-11-11" visits={[]} plans={[{id:'synthetic',date:'2026-11-01',title:'Consulta ficticia para pruebas',diagnosis:'',treatment:'Indicaciones de prueba, sin paciente real.',lifestyle:'Rutina de prueba.',dosha:'',herbs:[{formula:'Fórmula de prueba',dosage:'Dosis de prueba',instruction:'Instrucción guardada'}],categories:['Cereales','Frutas'],cerealGuidance:'Guía de ejemplo.',healthyEatingHabitDetails:[{name:'Hábito',text:'Descripción de prueba.'}],therapies:['Terapia de prueba']}]} /></main>);
