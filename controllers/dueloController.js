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

// 🔥 shuffle
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// 🔥 FALLBACK NOVO (GRANDE E 100% DIFERENTE)
function gerarFallback() {
  const perguntas = [

    // ➗ MATEMÁTICA
    {
      pergunta: "Quanto é 9 x 8?",
      alternativas: ["72", "81", "64", "70"],
      correta: 0,
    },
    {
      pergunta: "Quanto é 15 - 7?",
      alternativas: ["6", "7", "8", "9"],
      correta: 2,
    },
    {
      pergunta: "Quanto é 12 x 12?",
      alternativas: ["124", "144", "134", "154"],
      correta: 1,
    },
    {
      pergunta: "Quanto é 100 / 4?",
      alternativas: ["20", "25", "30", "40"],
      correta: 1,
    },

    // 🌍 GEOGRAFIA
    {
      pergunta: "Qual país tem o maior território do mundo?",
      alternativas: ["China", "Estados Unidos", "Rússia", "Canadá"],
      correta: 2,
    },
    {
      pergunta: "Qual continente fica o Egito?",
      alternativas: ["Ásia", "Europa", "África", "América"],
      correta: 2,
    },
    {
      pergunta: "Qual é o maior deserto do mundo?",
      alternativas: ["Saara", "Atacama", "Antártida", "Gobi"],
      correta: 2,
    },

    // 🔬 CIÊNCIAS
    {
      pergunta: "Qual órgão bombeia o sangue no corpo humano?",
      alternativas: ["Pulmão", "Cérebro", "Coração", "Fígado"],
      correta: 2,
    },
    {
      pergunta: "Qual gás os humanos respiram para viver?",
      alternativas: ["Oxigênio", "Hidrogênio", "Nitrogênio", "Carbono"],
      correta: 0,
    },
    {
      pergunta: "Qual é o estado físico do gelo?",
      alternativas: ["Líquido", "Gasoso", "Sólido", "Plasma"],
      correta: 2,
    },

    // 📜 HISTÓRIA
    {
      pergunta: "Quem foi o primeiro presidente do Brasil?",
      alternativas: ["Getúlio Vargas", "Deodoro da Fonseca", "Lula", "Juscelino"],
      correta: 1,
    },
    {
      pergunta: "A Segunda Guerra Mundial terminou em qual ano?",
      alternativas: ["1945", "1939", "1918", "1960"],
      correta: 0,
    },

    // 📚 PORTUGUÊS
    {
      pergunta: "Qual dessas palavras está correta?",
      alternativas: ["Excessão", "Exceção", "Exsesão", "Exceçãoo"],
      correta: 1,
    },
    {
      pergunta: "Qual é o antônimo de 'feliz'?",
      alternativas: ["Triste", "Alegre", "Animado", "Sorridente"],
      correta: 0,
    },

    // 🎭 ARTES
    {
      pergunta: "Qual instrumento tem teclas?",
      alternativas: ["Violão", "Piano", "Bateria", "Flauta"],
      correta: 1,
    },

    // 🌎 CULTURA GERAL
    {
      pergunta: "Quantas horas tem um dia?",
      alternativas: ["12", "24", "48", "36"],
      correta: 1,
    },
    {
      pergunta: "Qual é a cor do céu em um dia limpo?",
      alternativas: ["Verde", "Azul", "Amarelo", "Preto"],
      correta: 1,
    },

    // 🧠 FILOSOFIA
    {
      pergunta: "Quem disse 'Só sei que nada sei'?",
      alternativas: ["Platão", "Aristóteles", "Sócrates", "Descartes"],
      correta: 2,
    },

    // 🌐 SOCIOLOGIA
    {
      pergunta: "O que é sociedade?",
      alternativas: ["Um planeta", "Um grupo de pessoas", "Uma máquina", "Um animal"],
      correta: 1,
    },

    // 📖 LITERATURA
    {
      pergunta: "O que é um poema?",
      alternativas: ["Texto matemático", "Texto científico", "Texto literário", "Texto jurídico"],
      correta: 2,
    },

    // 🔬 QUÍMICA
    {
      pergunta: "Qual elemento tem símbolo O?",
      alternativas: ["Ouro", "Oxigênio", "Prata", "Ferro"],
      correta: 1,
    },

    // ⚡ FÍSICA
    {
      pergunta: "Qual força puxa objetos para a Terra?",
      alternativas: ["Magnetismo", "Gravidade", "Eletricidade", "Atrito"],
      correta: 1,
    },

    // 🧬 BIOLOGIA
    {
      pergunta: "Qual parte do corpo humano pensa?",
      alternativas: ["Coração", "Pulmão", "Cérebro", "Estômago"],
      correta: 2,
    },
  ];

  return shuffle(perguntas);
}