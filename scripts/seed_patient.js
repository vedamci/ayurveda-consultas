// Native fetch is available in Node 18+

const patientData = {
    patientName: "Ana García López",
    email: "ana.garcia.lopez@example.com",
    phone: "+52 55 1234 5678",
    age: "34",
    address: "Av. Vallarta 2440, Guadalajara, Jal.",
    occupation: "Diseñadora Gráfica (Freelance)",
    maritalStatus: "Soltera",
    children: "0",
    emergencyContact: "Carlos García (Padre) - 55 8765 4321",
    weight: "62 kg",
    height: "1.65 m",

    // Motivo de consulta
    consultationReason: "Me siento constantemente agotada, con mucha ansiedad y problemas digestivos (gases, hinchazón). Mi piel está muy seca y he notado caída del cabello.",
    preexistingConditions: "Hipotiroidismo leve diagnosticado hace 2 años.",
    hospitalizations: "Apendicitis a los 15 años.",
    surgeries: "Apendicectomía.",
    pregnancy: "No",
    substances: ["Café (2 tazas diarias)", "Alcohol (social, fines de semana)"],
    otherSymptoms: "Manos y pies fríos siempre, insomnio (me despierto a las 3am), estreñimiento frecuente.",
    energyLevel: "4", // 1-10
    exercise: ["Yoga 2 veces por semana", "Caminata ocasional"],

    // Dieta
    diet: "Desayuno: Café con leche y pan tostado con aguacate. Comida: Ensalada, pollo o pescado, a veces pasta. Cena: Quesadillas o cereal. Piconajeo: Galletas o frutos secos.",
    breakfast: "8:30 AM - Café, pan tostado.",
    dinner: "9:00 PM - Ligero pero tarde.",
    allergies: "Ninguna conocida.",
    mealSchedule: "Irregular, a veces me salto comidas por trabajo.",
    mealsPerDay: "3 (a veces 2)",
    eatingHabits: ["Como rápido", "Viendo pantallas"],
    supplements: ["Multivitamínico ocasional", "Magnesio"],

    // Perfil Ayurvédico (Auto-reporte implícito en preguntas)
    appetite: "Variable, a veces olvido comer.",
    weightTendency: "Cuesta subir de peso, fluctúo fácilmente.",
    menstruation: "Ciclo regular de 28 días, flujo escaso, cólicos leves.",
    sweat: "Poco, casi no sudo.",
    sleep: "Ligero, me despierto con ruidos. Cuesta conciliar.",
    temperature: "Friolenta.",

    // Administrativo
    professional: "Cualquiera disponible",
    recordingConsent: "Sí, aceptado",
    studentListeners: "Sí",

    // Detalles extra para el prompt
    observations: "Paciente refiere altos niveles de estrés laboral. Se observa nerviosa y habla rápido.",

    // Síntomas Seleccionados (Checkbox)
    symptoms: ["Ansiedad", "Insomnio", "Estreñimiento", "Piel Seca", "Gases", "Fatiga", "Manos frías"],

    // Calibración de Síntomas
    symptomCalibrations: {
        "Ansiedad": { frequency: "Diaria", intensity: 3 }, // Fuerte
        "Insomnio": { frequency: "Diaria", intensity: 2 }, // Moderado
        "Estreñimiento": { frequency: "Semanal", intensity: 2 }, // Moderado
        "Gases": { frequency: "Diaria", intensity: 1 }, // Suave
        "Fatiga": { frequency: "Diaria", intensity: 3 } // Fuerte
    },

    commitment: "9",
    dataProtection: true
};

async function seedPatient() {
    console.log("Seeding patient...", patientData.patientName);
    try {
        const response = await fetch('http://localhost:3000/api/consultation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(patientData)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }

        const result = await response.json();
        console.log("Success! Patient created with ID:", result.id);
        console.log("You can now verify this patient in the app.");
    } catch (error) {
        console.error("Error seeding patient:", error);
    }
}

seedPatient();
