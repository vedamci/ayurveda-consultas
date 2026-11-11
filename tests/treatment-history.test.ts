import test from 'node:test';
import assert from 'node:assert/strict';
import { recommendationSections, savedRecommendationHistory } from '../src/utils/treatmentHistory.ts';
import type { TreatmentPlan, Visit } from '../src/types/patient.ts';
const plan = (overrides: Partial<TreatmentPlan> = {}): TreatmentPlan => ({ id: 'p', date: '2026-11-01', diagnosis: '', treatment: 'Referencia clínica', lifestyle: '', dosha: '', herbs: [], categories: [], ...overrides });
const visit = (overrides: Partial<Visit> = {}): Visit => ({ id: 'v', date: '2026-11-02', note: '', symptoms: {}, treatment: 'Referencia previa', ...overrides });
test('uses patient wording and preserves all saved recommendation categories', () => {
    const sections = recommendationSections(plan({ patientTreatment: 'Texto del PDF', patientLifestyle: 'Rutina', herbs: [{formula:'Fórmula ficticia',dosage:'Dosis de prueba',instruction:'Indicación de prueba',suspended:true}], categories:['Cereales'], cerealGuidance:'Guía', cerealRecipe:'Receta manual', recipes:[{title:'Receta',text:'Pasos'}], healthyEatingHabitDetails:[{name:'Hábito',text:'Detalle'}], therapyDetails:[{name:'Terapia',text:'Detalle'}], therapyFrequency:'Semanal', therapyCount:2 }));
    assert.equal(sections.length, 8);
    assert.equal(sections[0].items[0], 'Texto del PDF');
    assert.match(sections[1].items[0], /Suspendido.*Dosis de prueba.*Indicación/);
});
test('honors PDF exclusions without hiding manual recipe and supports old records', () => {
    const result = recommendationSections(plan({showHealthyEatingGuide:false,healthyEatingGuide:'hidden',showRecipesSection:false,recipes:['hidden'],cerealRecipe:'Manual',showTherapiesSection:false,therapies:['hidden']}));
    assert.ok(!JSON.stringify(result).includes('hidden'));
    assert.ok(JSON.stringify(result).includes('Manual'));
    assert.equal(result[0].items[0], 'Referencia clínica');
});
test('filters future, empty, invalid dates and current visit; orders by clinical date', () => {
    const result = savedRecommendationHistory([plan({date:'2026-11-20',visitDate:'2026-11-01'}), plan({id:'future',date:'2026-12-01'}), plan({date:'invalid'}),plan({treatment:''})], [visit(),visit({id:'editing'})], '2026-11-03', 'editing');
    assert.deepEqual(result.map(r => r.record.id), ['v','p']);
});
test('reads only supplied patient records and never changes source or copies to current consultation', () => {
    const plans = [plan()]; const visits = [visit()];
    const before = JSON.stringify({plans,visits});
    savedRecommendationHistory(plans,visits,'2026-11-03');
    assert.equal(JSON.stringify({plans,visits}),before);
    assert.deepEqual(savedRecommendationHistory([],[],'2026-11-03'),[]);
});
test('calendar date is stable across timezone offsets and includes same-day saved plans', () => {
    const result = savedRecommendationHistory([plan({date:'2026-11-03T23:00:00-06:00'})], [],'2026-11-03');
    assert.equal(result.length,1);
    assert.equal(result[0].date,'2026-11-03');
});

test('preview is factual, marks suspended herbs, and keeps full sections intact', async () => {
    const { recommendationPreview } = await import('../src/utils/treatmentHistory.ts');
    const record = plan({ herbs: [{formula:'Hierba ficticia',dosage:'Dosis exacta',suspended:true}], categories:['Cereales','Frutas','Aceites','Legumbres'] });
    const herbSection = recommendationSections(record).find(s => s.title === 'Fórmulas y dosis')!;
    assert.equal(recommendationPreview(record, herbSection), 'Hierba ficticia (suspendido)');
    assert.ok(herbSection.items[0].includes('Dosis exacta'));
    assert.equal(recommendationPreview(record,{title:'Alimentación',items:['Texto completo']}),'Cereales · Frutas · Aceites · +1 más');
    const long = 'A'.repeat(200);
    assert.equal(recommendationPreview(record,{title:'Indicaciones',items:[long]}),'A'.repeat(100)+'…');
});
