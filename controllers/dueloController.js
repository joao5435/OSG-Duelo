// dueloController.js
import axios from 'axios';
import admin from '../utils/firebaseAdmin.js'; 

const materiasDisponiveis = [
  "matemática",
  "história",
  "artes",
  "fisica",
  "quimica",
  "biologia",
  "português",
  "filosofia",
  "geografia",
  "sociologia",
  "literatura",
  "cultura geral"
];


// Verifica token do Firebase
export async function verifyUser(token) {
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

export async function gerarPerguntasIA() {
  try {
    // Sorteia uma matéria aleatória
    const materia = materiasDisponiveis[Math.floor(Math.random() * materiasDisponiveis.length)];

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content: `Crie 5 perguntas de múltipla escolha, fáceis e medias, sobre ${materia}, com 4 alternativas cada. Responda apenas no formato de texto, cada pergunta em uma linha.`
          }
        ],
        max_tokens: 500
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const texto = response.data.choices[0].message.content;
    return texto.split('\n').filter(Boolean); // retorna array de perguntas
  } catch (err) {
    console.error("Erro ao gerar perguntas:", err.message);
    return ["Erro ao gerar perguntas"];
  }
}