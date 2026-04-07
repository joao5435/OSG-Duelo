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

    let texto = response.data.choices[0].message.content;

    // 🔥 LIMPEZA DO JSON
    texto = texto.replace(/```json|```/g, "").trim();

    // 🔥 PEGA SÓ O ARRAY
    const match = texto.match(/\[[\s\S]*\]/);
    if (match) {
      texto = match[0];
    }

    let perguntas;

    try {
      perguntas = JSON.parse(texto);

      // 🔥 FILTRO + PADRONIZAÇÃO + MATERIA
      perguntas = perguntas
        .filter(
          (p) =>
            p &&
            typeof p.pergunta === "string" &&
            Array.isArray(p.alternativas) &&
            p.alternativas.length === 4 &&
            typeof p.correta !== "undefined"
        )
        .map((p) => ({
          pergunta: p.pergunta,
          alternativas: p.alternativas,
          correta: Number(p.correta),
          materia,
        }));

    } catch (err) {
      console.error("Erro JSON IA:", texto);
      return gerarFallback();
    }

    if (!Array.isArray(perguntas) || perguntas.length === 0) {
      return gerarFallback();
    }

    return perguntas;
  } catch (err) {
    console.error("Erro IA:", err.message);
    return gerarFallback();
  }
}

// 🔥 SHUFFLE
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// 🔥 FALLBACK GRANDE COM MATÉRIA
function gerarFallback() {
  const perguntas = [
    {
      pergunta: "Quanto é 9 x 8?",
      alternativas: ["72", "81", "64", "70"],
      correta: 0,
      materia: "matemática",
    },
    {
      pergunta: "Quanto é 12 x 12?",
      alternativas: ["124", "144", "134", "154"],
      correta: 1,
      materia: "matemática",
    },
    {
      pergunta: "Qual país tem o maior território do mundo?",
      alternativas: ["China", "EUA", "Rússia", "Canadá"],
      correta: 2,
      materia: "geografia",
    },
    {
      pergunta: "Qual continente fica o Egito?",
      alternativas: ["Ásia", "Europa", "África", "América"],
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
      pergunta: "Qual gás é essencial para respiração humana?",
      alternativas: ["Nitrogênio", "Oxigênio", "Carbono", "Hidrogênio"],
      correta: 1,
      materia: "biologia",
    },
    {
      pergunta: "Quem foi o primeiro presidente do Brasil?",
      alternativas: ["Lula", "Deodoro", "Getúlio", "Juscelino"],
      correta: 1,
      materia: "história",
    },
    {
      pergunta: "A Segunda Guerra Mundial terminou em?",
      alternativas: ["1945", "1939", "1918", "1960"],
      correta: 0,
      materia: "história",
    },
    {
      pergunta: "Qual é o antônimo de feliz?",
      alternativas: ["Triste", "Alegre", "Animado", "Sorridente"],
      correta: 0,
      materia: "português",
    },
    {
      pergunta: "Qual dessas palavras está correta?",
      alternativas: ["Excessão", "Exceção", "Exsesão", "Exceçãoo"],
      correta: 1,
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
    {
      pergunta: "O que é sociedade?",
      alternativas: ["Planeta", "Grupo de pessoas", "Máquina", "Animal"],
      correta: 1,
      materia: "sociologia",
    },
    {
      pergunta: "O que é um poema?",
      alternativas: ["Texto científico", "Texto literário", "Texto jurídico", "Texto técnico"],
      correta: 1,
      materia: "literatura",
    },
  ];

  return shuffle(perguntas);
}