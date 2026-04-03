// utils/firestore.js
import admin from './firebaseAdmin.js'; // importa o admin já inicializado

const db = admin.firestore();
const { FieldValue } = admin.firestore; // arrayUnion, increment, serverTimestamp

// ─── LEVEL ───────────────────────────
export function calcularLevel(xp) {
  if (xp >= 2500) return 7;
  if (xp >= 1500) return 6;
  if (xp >= 1000) return 5;
  if (xp >= 600) return 4;
  if (xp >= 300) return 3;
  if (xp >= 100) return 2;
  return 1;
}

export function getTituloLevel(level) {
  const titulos = {
    1: "Iniciante",
    2: "Estudante",
    3: "Dedicado",
    4: "Avançado",
    5: "Expert",
    6: "Mestre",
    7: "Lendário",
  };
  return titulos[level] || "Iniciante";
}

// ─── USUÁRIOS ───────────────────────────

// Cria usuário
export async function salvarUsuario(uid, nome, email) {
  await db.collection('users').doc(uid).set({
    name: nome,
    email,
    xp: 0,
    level: 1,
    photo: null,
    theme: null,
    groupIds: [],
    xpPorGrupo: {},
    lastDailyQuizDate: null,
    createdAt: FieldValue.serverTimestamp(),
  });
}

// Buscar usuário
export async function buscarUsuario(uid) {
  const snap = await db.collection('users').doc(uid).get();
  return snap.exists ? { uid, ...snap.data() } : null;
}

// Atualizar XP
export async function atualizarXP(uid, xpGanho, groupId = null) {
  const ref = db.collection('users').doc(uid);
  const snap = await ref.get();
  const xpAtual = snap.data()?.xp || 0;
  const novoXP = xpAtual + xpGanho;
  const novoLevel = calcularLevel(novoXP);

  const updateData = {
    xp: FieldValue.increment(xpGanho),
    level: novoLevel,
  };

  if (groupId) {
    updateData[`xpPorGrupo.${groupId}`] = FieldValue.increment(xpGanho);
  }

  await ref.update(updateData);
  return { novoXP, novoLevel };
}

// Entrar em grupos
export async function entrarNosGrupos(uid, groupIds) {
  if (!groupIds?.length) return;

  await db.collection('users').doc(uid).update({
    groupIds: FieldValue.arrayUnion(...groupIds),
  });

  const promises = groupIds.map(groupId =>
    db.collection('groups').doc(groupId).update({
      members: FieldValue.arrayUnion(uid),
    })
  );
  await Promise.all(promises);
}

// Buscar grupos do usuário
export async function buscarGruposDoUsuario(uid) {
  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists) return [];
  const groupIds = userSnap.data().groupIds || [];
  if (!groupIds.length) return [];

  const promises = groupIds.map(id => db.collection('groups').doc(id).get());
  const snaps = await Promise.all(promises);

  return snaps.filter(s => s.exists).map(s => ({ id: s.id, ...s.data() }));
}

// Buscar membros de grupo por XP
export async function buscarMembrosDoGrupo(groupId) {
  const usersSnap = await db.collection('users')
    .where('groupIds', 'array-contains', groupId)
    .orderBy('xp', 'desc')
    .get();

  return usersSnap.docs.map(d => ({ uid: d.id, ...d.data() }));
}