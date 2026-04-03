// server.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dueloRoutes from './routes/duelo.js';
import { verifyUser, gerarPerguntasIA } from './controllers/dueloController.js';
import { atualizarXP } from './utils/firestore.js';
import dotenv from 'dotenv';

dotenv.config();


const app = express();
app.use(express.json());
app.use('/api/duelo', dueloRoutes);

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const duelos = {}; // salas de duelo em memória

io.on('connection', socket => {
  console.log('Usuário conectado', socket.id);

  // Entrar em uma sala de duelo
  socket.on('entrarDuelo', async ({ token, salaId }) => {
    const uid = await verifyUser(token);
    if (!uid) return socket.emit('erro', 'Usuário inválido');

    socket.join(salaId);
    if (!duelos[salaId]) duelos[salaId] = { usuarios: [], pontuacao: {} };
    if (!duelos[salaId].usuarios.includes(uid)) {
      duelos[salaId].usuarios.push(uid);
      duelos[salaId].pontuacao[uid] = 0; // pontuação temporária na sala
    }

    io.to(salaId).emit('dueloAtualizado', duelos[salaId]);
  });

  // Receber resposta de um jogador e atualizar XP
  socket.on('resposta', async ({ salaId, uid, pontos }) => {
    if (!duelos[salaId]) return;

    // Atualiza pontuação temporária da sala
    duelos[salaId].pontuacao[uid] += pontos;

    try {
      // Atualiza XP no Firestore
      const { novoXP, novoLevel } = await atualizarXP(uid, pontos);

      // Emite para todos da sala o duelo atualizado
      io.to(salaId).emit('dueloAtualizado', {
        ...duelos[salaId],
        xpAtualizado: { uid, novoXP, novoLevel }
      });
    } catch (err) {
      console.error('Erro ao atualizar XP no Firestore', err);
      socket.emit('erro', 'Não foi possível atualizar XP');
    }
  });

  // Gerar perguntas da IA e enviar para a sala
  socket.on('gerarPerguntas', async ({ salaId }) => {
    try {
      const perguntas = await gerarPerguntasIA();
      io.to(salaId).emit('perguntas', perguntas);
    } catch (err) {
      console.error('Erro ao gerar perguntas IA', err);
      socket.emit('erro', 'Não foi possível gerar perguntas');
    }
  });

  // Desconexão
  socket.on('disconnect', () => {
    console.log('Usuário desconectado', socket.id);
    // Opcional: remover usuário das salas se necessário
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));