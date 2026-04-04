import express from "express";
import http from "http";
import { Server } from "socket.io";
import dueloRoutes from "./routes/duelo.js";
import { verifyUser, gerarPerguntasIA } from "./controllers/dueloController.js";
import { atualizarXP } from "./utils/firestore.js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use("/api/duelo", dueloRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const duelos = {};

io.on("connection", (socket) => {
  console.log("Usuário conectado", socket.id);

  // 🔐 ENTRAR NO DUELO
  socket.on("entrarDuelo", async ({ token, salaId }) => {
    try {
      const uid = await verifyUser(token);

      if (!uid) {
        socket.emit("erro", "Usuário inválido");
        return socket.disconnect();
      }

      // 🔥 salva uid no socket
      socket.uid = uid;
      socket.salaId = salaId;

      socket.join(salaId);

      if (!duelos[salaId]) {
        duelos[salaId] = {
          usuarios: [],
          pontuacao: {},
          iniciado: false,
        };
      }

      const duelo = duelos[salaId];

      if (!duelo.usuarios.includes(uid)) {
        duelo.usuarios.push(uid);
        duelo.pontuacao[uid] = 0;
      }

      console.log("Entrou na sala:", salaId, duelo.usuarios);

      io.to(salaId).emit("dueloAtualizado", duelo);

      // 🚀 começa automaticamente quando tiver 2 jogadores
      if (duelo.usuarios.length === 2 && !duelo.iniciado) {
        duelo.iniciado = true;

        const perguntas = await gerarPerguntasIA();

        io.to(salaId).emit("perguntas", perguntas);
      }
    } catch (err) {
      console.error("Erro entrarDuelo:", err);
      socket.emit("erro", "Erro ao entrar no duelo");
    }
  });

  // ⚔️ RESPOSTA
  socket.on("resposta", async ({ salaId, pontos }) => {
    try {
      const uid = socket.uid;

      if (!uid || !duelos[salaId]) return;

      duelos[salaId].pontuacao[uid] += pontos;

      const { novoXP, novoLevel } = await atualizarXP(uid, pontos);

      io.to(salaId).emit("dueloAtualizado", {
        ...duelos[salaId],
        xpAtualizado: { uid, novoXP, novoLevel },
      });
    } catch (err) {
      console.error("Erro resposta:", err);
      socket.emit("erro", "Erro ao responder");
    }
  });

  // ❌ REMOVIDO gerarPerguntas manual (agora é automático)

  // 🔌 DISCONNECT
  socket.on("disconnect", () => {
    console.log("Usuário desconectado", socket.id);

    const { salaId, uid } = socket;

    if (!salaId || !duelos[salaId]) return;

    const duelo = duelos[salaId];

    duelo.usuarios = duelo.usuarios.filter((u) => u !== uid);
    delete duelo.pontuacao[uid];

    duelo.iniciado = false;

    io.to(salaId).emit("dueloAtualizado", duelo);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () =>
  console.log(`Servidor rodando na porta ${PORT}`)
);