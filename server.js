import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";

import {
  verifyUser,
  gerarPerguntasIA,
} from "./controllers/dueloController.js";

import admin from "./utils/firebaseAdmin.js";

dotenv.config();

const app = express();

app.get("/", (req, res) => {
  res.send("Servidor OSG Duelos online 🚀");
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },

  transports: ["websocket", "polling"],
});

const duelos = {};

const TEMPO_PERGUNTA = 30;
const TOTAL_PERGUNTAS = 7;

io.on("connection", (socket) => {
  console.log("✅ Usuário conectado:", socket.id);

  // =========================================
  // ENTRAR DUELO
  // =========================================
  socket.on("entrarDuelo", async ({ token, salaId }) => {
    try {
      console.log("🎯 Tentando entrar no duelo...");

      const uid = await verifyUser(token);

      if (!uid) {
        console.log("❌ Token inválido");
        return socket.disconnect();
      }

      socket.uid = uid;
      socket.salaId = salaId;

      socket.join(salaId);

      console.log(`👤 ${uid} entrou na sala ${salaId}`);

      // cria duelo
      if (!duelos[salaId]) {
        duelos[salaId] = {
          usuarios: [],
          pontuacao: {},
          perguntas: [],
          perguntaAtual: 0,
          respostas: {},
          streak: {},
          acertos: {},
          iniciado: false,
          timer: null,
          inicioPergunta: null,
        };
      }

      const duelo = duelos[salaId];

      // evita duplicado
      if (!duelo.usuarios.includes(uid)) {
        duelo.usuarios.push(uid);

        duelo.pontuacao[uid] = 0;
        duelo.streak[uid] = 0;
        duelo.acertos[uid] = 0;
      }

      console.log(
        "👥 Jogadores na sala:",
        duelo.usuarios.length
      );

      // avisa quantos jogadores tem
      io.to(salaId).emit("statusSala", {
        jogadores: duelo.usuarios.length,
      });

      // inicia jogo
      if (
        duelo.usuarios.length >= 2 &&
        !duelo.iniciado
      ) {
        console.log("🚀 Iniciando duelo...");

        duelo.iniciado = true;

        const perguntas = await gerarPerguntasIA();

        duelo.perguntas = perguntas.slice(
          0,
          TOTAL_PERGUNTAS
        );

        iniciarPergunta(salaId);
      }

    } catch (err) {
      console.error("❌ Erro entrarDuelo:", err);
    }
  });

  // =========================================
  // RESPOSTA
  // =========================================
  socket.on("resposta", ({ salaId, respostaIndex }) => {
    const duelo = duelos[salaId];
    const uid = socket.uid;

    if (!duelo || !uid) return;

    // evita responder 2x
    if (duelo.respostas[uid] !== undefined) return;

    const tempoResposta =
      (Date.now() - duelo.inicioPergunta) / 1000;

    duelo.respostas[uid] = {
      resposta: respostaIndex,
      tempo: tempoResposta,
    };

    console.log(
      `📩 ${uid} respondeu ${respostaIndex}`
    );

    verificarRespostas(salaId);
  });

  // =========================================
  // DESCONECTOU
  // =========================================
  socket.on("disconnect", async () => {
    try {
      const salaId = socket.salaId;
      const uid = socket.uid;

      console.log("❌ Usuário saiu:", uid);

      if (!salaId || !uid) return;

      const duelo = duelos[salaId];

      if (!duelo) return;

      duelo.usuarios = duelo.usuarios.filter(
        (u) => u !== uid
      );

      delete duelo.pontuacao[uid];
      delete duelo.streak[uid];
      delete duelo.respostas[uid];
      delete duelo.acertos[uid];

      io.to(salaId).emit("usuarioSaiu", {
        uid,
      });

      // se não sobrou ninguém
      if (duelo.usuarios.length === 0) {
        clearTimeout(duelo.timer);

        delete duelos[salaId];

        console.log("🗑 Sala removida");

        return;
      }

      // se sobrou 1 jogador
      if (duelo.usuarios.length === 1) {
        console.log(
          "🏁 Finalizando duelo por desconexão"
        );

        finalizarDuelo(salaId);
      }

    } catch (err) {
      console.error("❌ Erro disconnect:", err);
    }
  });
});

// =========================================
// INICIAR PERGUNTA
// =========================================
function iniciarPergunta(salaId) {
  const duelo = duelos[salaId];

  if (!duelo) return;

  duelo.respostas = {};
  duelo.inicioPergunta = Date.now();

  const pergunta =
    duelo.perguntas[duelo.perguntaAtual];

  if (!pergunta) {
    return finalizarDuelo(salaId);
  }

  console.log(
    `📚 Pergunta ${duelo.perguntaAtual + 1}`
  );

  io.to(salaId).emit("novaPergunta", {
    pergunta,
    tempo: TEMPO_PERGUNTA,
  });

  duelo.timer = setTimeout(() => {
    finalizarPergunta(salaId);
  }, TEMPO_PERGUNTA * 1000);
}

// =========================================
// VERIFICAR RESPOSTAS
// =========================================
function verificarRespostas(salaId) {
  const duelo = duelos[salaId];

  if (!duelo) return;

  if (
    Object.keys(duelo.respostas).length >=
    duelo.usuarios.length
  ) {
    clearTimeout(duelo.timer);

    finalizarPergunta(salaId);
  }
}

// =========================================
// FINALIZAR PERGUNTA
// =========================================
function finalizarPergunta(salaId) {
  const duelo = duelos[salaId];

  if (!duelo) return;

  clearTimeout(duelo.timer);

  const pergunta =
    duelo.perguntas[duelo.perguntaAtual];

  if (!pergunta) {
    return finalizarDuelo(salaId);
  }

  duelo.usuarios.forEach((uid) => {
    const dados = duelo.respostas[uid];

    // não respondeu
    if (!dados) {
      duelo.streak[uid] = 0;

      duelo.pontuacao[uid] = Math.max(
        0,
        duelo.pontuacao[uid] - 1
      );

      return;
    }

    const { resposta, tempo } = dados;

    // acertou
    if (resposta === pergunta.correta) {
      let pontos = 1;

      if (tempo <= 5) pontos = 3;
      else if (tempo <= 15) pontos = 2;

      duelo.streak[uid] += 1;

      // combo
      if (duelo.streak[uid] >= 3) {
        pontos += 2;
      }

      duelo.pontuacao[uid] += pontos;
      duelo.acertos[uid] += 1;

    } else {
      // errou
      duelo.streak[uid] = 0;

      duelo.pontuacao[uid] = Math.max(
        0,
        duelo.pontuacao[uid] - 1
      );
    }
  });

  io.to(salaId).emit("resultadoResposta", {
    correta: pergunta.correta,
    pontuacao: duelo.pontuacao,
  });

  setTimeout(() => {
    duelo.perguntaAtual++;

    if (
      duelo.perguntaAtual >=
      duelo.perguntas.length
    ) {
      finalizarDuelo(salaId);

    } else {
      iniciarPergunta(salaId);
    }
  }, 2000);
}

// =========================================
// FINALIZAR DUELO
// =========================================
async function finalizarDuelo(salaId) {
  try {
    const duelo = duelos[salaId];

    if (!duelo) return;

    clearTimeout(duelo.timer);

    const jogadores = duelo.pontuacao;

    const uids = Object.keys(jogadores);

    if (uids.length === 0) {
      delete duelos[salaId];
      return;
    }

    let vencedor = null;

    if (uids.length === 1) {
      vencedor = uids[0];

    } else {
      const [uid1, uid2] = uids;

      if (jogadores[uid1] > jogadores[uid2]) {
        vencedor = uid1;

      } else if (
        jogadores[uid2] > jogadores[uid1]
      ) {
        vencedor = uid2;
      }
    }

    const db = admin.firestore();

    for (const uid of uids) {
      const acertos =
        duelo.acertos[uid] || 0;

      let xp = acertos * 5;

      if (uid === vencedor) {
        xp += 30;

        await db
          .collection("users")
          .doc(uid)
          .update({
            duelosVencidos:
              admin.firestore.FieldValue.increment(1),
          });
      }

      await db
        .collection("users")
        .doc(uid)
        .update({
          xp: admin.firestore.FieldValue.increment(xp),
        });
    }

    io.to(salaId).emit("fimDeJogo", {
      vencedor,
      pontuacao: jogadores,
    });

    console.log("🏁 Duelo finalizado");

    delete duelos[salaId];

  } catch (err) {
    console.error("❌ Erro finalizarDuelo:", err);
  }
}

const PORT = process.env.PORT || 3001;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});