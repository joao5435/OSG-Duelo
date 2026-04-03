import express from 'express';
import { verifyUser, gerarPerguntasIA } from '../controllers/dueloController.js';

const router = express.Router();

router.get('/perguntas', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const uid = await verifyUser(token);
  if (!uid) return res.status(401).json({ error: 'Usuario inválido' });

  const perguntas = await gerarPerguntasIA();
  res.json({ perguntas });
});

export default router;