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
    const materia =
      materiasDisponiveis[
        Math.floor(Math.random() * materiasDisponiveis.length)
      ];

    const prompt = `
Gere 10 perguntas de múltipla escolha sobre ${materia}.

Formato OBRIGATÓRIO em JSON:

[
  {
    "pergunta": "string",
    "alternativas": ["A", "B", "C", "D"],
    "correta": número (0 a 3)
  }
]

Regras:
- Apenas JSON
- 4 alternativas
- Apenas UMA correta
- NÃO use "todas as alternativas" ou "nenhuma das alternativas"
`;

    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 800,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const texto = response.data.choices[0].message.content;

    let perguntas;

    try {
      perguntas = JSON.parse(texto);

      // 🔥 AQUI FOI CORRIGIDO (MATERIA)
      perguntas = perguntas.map((p) => ({
        ...p,
        correta: Number(p.correta),
        materia,
      }));
    } catch (err) {
      console.error("Erro JSON IA:", texto);
      return gerarFallback();
    }

    const valido =
      Array.isArray(perguntas) &&
      perguntas.every(
        (p) =>
          p.pergunta &&
          Array.isArray(p.alternativas) &&
          p.alternativas.length === 4 &&
          typeof p.correta === "number"
      );

    if (!valido) {
      return gerarFallback();
    }

    return perguntas;
  } catch (err) {
    console.error("Erro IA:", err.message);
    return gerarFallback();
  }
}

// 🔥 shuffle
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// 🔥 fallback com materia
function gerarFallback() {
  const perguntas = [
    {
      pergunta: "Quanto é 9 x 8?",
      alternativas: ["72", "81", "64", "70"],
      correta: 0,
      materia: "matemática",
    },
    {
      pergunta: "Quanto é 15 - 7?",
      alternativas: ["6", "7", "8", "9"],
      correta: 2,
      materia: "matemática",
    },
    {
      pergunta: "Qual país tem o maior território?",
      alternativas: ["China", "EUA", "Rússia", "Canadá"],
      correta: 2,
      materia: "geografia",
    },
    {
      pergunta: "Qual órgão bombeia o sangue?",
      alternativas: ["Pulmão", "Cérebro", "Coração", "Fígado"],
      correta: 2,
      materia: "biologia",
    },
    {
      pergunta: "Quem foi o primeiro presidente do Brasil?",
      alternativas: ["Lula", "Deodoro", "Getúlio", "Juscelino"],
      correta: 1,
      materia: "história",
    },
    {
      pergunta: "Qual é o antônimo de feliz?",
      alternativas: ["Triste", "Alegre", "Animado", "Sorridente"],
      correta: 0,
      materia: "português",
    },
    {
      pergunta: "Qual instrumento tem teclas?",
      alternativas: ["Violão", "Piano", "Flauta", "Bateria"],
      correta: 1,
      materia: "artes",
    },
    {
      pergunta: "Qual força puxa objetos para a Terra?",
      alternativas: ["Magnetismo", "Gravidade", "Eletricidade", "Atrito"],
      correta: 1,
      materia: "fisica",
    },
    {
      pergunta: "Qual elemento tem símbolo O?",
      alternativas: ["Ouro", "Oxigênio", "Prata", "Ferro"],
      correta: 1,
      materia: "quimica",
    },
    {
      pergunta: "Quem disse 'Só sei que nada sei'?",
      alternativas: ["Platão", "Sócrates", "Aristóteles", "Descartes"],
      correta: 1,
      materia: "filosofia",
    },
  ];

  return shuffle(perguntas);
}