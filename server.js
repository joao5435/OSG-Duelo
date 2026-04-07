import express from "express";
import http from "http";
import { Server } from "socket.io";
import { verifyUser, gerarPerguntasIA } from "./controllers/dueloController.js";
import { atualizarXP } from "./utils/firestore.js";
import { getFirestore, doc, updateDoc, increment } from "firebase/firestore";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

const duelos = {};
const TEMPO_PERGUNTA = 30; // 🔥 ALTERADO PARA 30s
const TOTAL_PERGUNTAS = 7;

io.on("connection", (socket) => {
  console.log("Usuário conectado", socket.id);

  socket.on("entrarDuelo", async ({ token, salaId }) => {
    try {
      const uid = await verifyUser(token);
      if (!uid) return socket.disconnect();

      socket.uid = uid;
      socket.salaId = salaId;
      socket.join(salaId);

      if (!duelos[salaId]) {
        duelos[salaId] = {
          usuarios: [],
          pontuacao: {},
          perguntas: [],
          perguntaAtual: 0,
          respostas: {},
          streak: {},
          iniciado: false,
          timer: null,
          inicioPergunta: null,
          acertos: {}, // 🔥 NOVO: controlar acertos
        };
      }

      const duelo = duelos[salaId];

      if (!duelo.usuarios.includes(uid)) {
        duelo.usuarios.push(uid);
        duelo.pontuacao[uid] = 0;
        duelo.streak[uid] = 0;
        duelo.acertos[uid] = 0; // 🔥 inicializa
      }

      if (duelo.usuarios.length === 2 && !duelo.iniciado) {
        duelo.iniciado = true;

        const perguntas = await gerarPerguntasIA();
        duelo.perguntas = perguntas.slice(0, TOTAL_PERGUNTAS);

        iniciarPergunta(salaId);
      }
    } catch (err) {
      console.error(err);
    }
  });

  socket.on("resposta", ({ salaId, respostaIndex }) => {
    const duelo = duelos[salaId];
    const uid = socket.uid;
    if (!duelo || !uid) return;

    if (duelo.respostas[uid] !== undefined) return;

    const tempoResposta = (Date.now() - duelo.inicioPergunta) / 1000;

    duelo.respostas[uid] = {
      resposta: respostaIndex,
      tempo: tempoResposta,
    };

    verificarRespostas(salaId);
  });

  socket.on("disconnect", () => {
    console.log("Desconectado", socket.id);

    const salaId = socket.salaId;
    const uid = socket.uid;

    if (!salaId || !uid) return;
    const duelo = duelos[salaId];
    if (!duelo) return;

    duelo.usuarios = duelo.usuarios.filter((u) => u !== uid);
    delete duelo.pontuacao[uid];
    delete duelo.streak[uid];
    delete duelo.respostas[uid];
    delete duelo.acertos[uid];

    io.to(salaId).emit("usuarioSaiu", { uid });

    if (duelo.usuarios.length === 1) {
      finalizarDuelo(salaId);
    }
  });
});

function iniciarPergunta(salaId) {
  const duelo = duelos[salaId];
  if (!duelo) return;

  duelo.respostas = {};
  duelo.inicioPergunta = Date.now();

  const pergunta = duelo.perguntas[duelo.perguntaAtual];
  if (!pergunta) return finalizarDuelo(salaId);

  io.to(salaId).emit("novaPergunta", {
    pergunta,
    tempo: TEMPO_PERGUNTA,
  });

  duelo.timer = setTimeout(() => {
    finalizarPergunta(salaId);
  }, TEMPO_PERGUNTA * 1000);
}

function verificarRespostas(salaId) {
  const duelo = duelos[salaId];
  if (!duelo) return;

  if (Object.keys(duelo.respostas).length === duelo.usuarios.length) {
    if (duelo.timer) {
      clearTimeout(duelo.timer);
      duelo.timer = null;
    }
    finalizarPergunta(salaId);
  }
}

function finalizarPergunta(salaId) {
  const duelo = duelos[salaId];
  if (!duelo) return;

  if (duelo.timer) {
    clearTimeout(duelo.timer);
    duelo.timer = null;
  }

  const pergunta = duelo.perguntas[duelo.perguntaAtual];
  if (!pergunta) return finalizarDuelo(salaId);

  duelo.usuarios.forEach((uid) => {
    const dados = duelo.respostas[uid];

    if (!dados) {
      duelo.streak[uid] = 0;
      duelo.pontuacao[uid] = Math.max(0, duelo.pontuacao[uid] - 1);
      return;
    }

    const { resposta, tempo } = dados;

    if (resposta === pergunta.correta) {
      let pontos = 1;

      if (tempo <= 5) pontos = 3;
      else if (tempo <= 15) pontos = 2;

      duelo.streak[uid] += 1;

      if (duelo.streak[uid] >= 3) {
        pontos += 2;
      }

      duelo.pontuacao[uid] += pontos;

      // 🔥 CONTA ACERTO
      duelo.acertos[uid] += 1;
    } else {
      duelo.streak[uid] = 0;
      duelo.pontuacao[uid] = Math.max(0, duelo.pontuacao[uid] - 1);
    }
  });

  io.to(salaId).emit("resultadoResposta", {
    correta: pergunta.correta,
    pontuacao: duelo.pontuacao,
    streak: duelo.streak,
    respostas: duelo.respostas,
  });

  setTimeout(() => {
    duelo.perguntaAtual++;

    if (duelo.perguntaAtual >= duelo.perguntas.length) {
      finalizarDuelo(salaId);
    } else {
      iniciarPergunta(salaId);
    }
  }, 2000);
}

async function finalizarDuelo(salaId) {
  const duelo = duelos[salaId];
  if (!duelo) return;

  const jogadores = duelo.pontuacao;
  const uids = Object.keys(jogadores);

  if (uids.length === 0) {
    delete duelos[salaId];
    return;
  }

  const [uid1, uid2] = uids;

  let vencedor = null;

  if (uids.length === 1) {
    vencedor = uids[0];
  } else {
    if (jogadores[uid1] > jogadores[uid2]) vencedor = uid1;
    else if (jogadores[uid2] > jogadores[uid1]) vencedor = uid2;
  }

  const db = getFirestore();

  for (const uid of uids) {
    const acertos = duelo.acertos[uid] || 0;

    // 🔥 XP base por acertos (mesmo perdendo)
    const xpBase = acertos * 5;

    let xpTotal = xpBase;

    if (uid === vencedor) {
      xpTotal += 30; // 🔥 vitória agora é 30

      // 🔥 incrementa duelos vencidos
      try {
        const ref = doc(db, "users", uid);
        await updateDoc(ref, {
          duelosVencidos: increment(1),
        });
      } catch (e) {
        console.log("Erro ao atualizar vitórias:", e);
      }
    }

    await atualizarXP(uid, xpTotal);
  }

  io.to(salaId).emit("fimDeJogo", {
    vencedor,
    pontuacao: jogadores,
  });

  delete duelos[salaId];
}

server.listen(process.env.PORT || 3001, () =>
  console.log("Servidor rodando")
);