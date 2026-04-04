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

Dificuldade:
- Fácil e média

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
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
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


      perguntas = perguntas.map((p) => ({
        ...p,
        correta: Number(p.correta),
      }));
    } catch (err) {
      console.error("Erro JSON IA:", texto);
      return gerarFallback();
    }

    // validação
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
      console.error("Formato inválido IA");
      return gerarFallback();
    }

    return perguntas;
  } catch (err) {
    console.error("Erro IA:", err.message);
    return gerarFallback();
  }
}

function gerarFallback() {
  return [
    {
      pergunta: "Qual a capital do Brasil?",
      alternativas: ["São Paulo", "Rio", "Brasília", "Salvador"],
      correta: 2,
    },
    {
      pergunta: "Quanto é 2 + 2?",
      alternativas: ["3", "4", "5", "6"],
      correta: 1,
    },
    {
      pergunta: "Qual planeta é vermelho?",
      alternativas: ["Terra", "Marte", "Júpiter", "Saturno"],
      correta: 1,
    },
    {
      pergunta: "Quem descobriu o Brasil?",
      alternativas: ["Cabral", "Dom Pedro", "Tiradentes", "Getúlio"],
      correta: 0,
    },
    {
      pergunta: "Quanto é 10 / 2?",
      alternativas: ["2", "3", "5", "10"],
      correta: 2,
    },
  ];
}