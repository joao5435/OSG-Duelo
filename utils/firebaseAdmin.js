// utils/firebaseAdmin.js
import admin from 'firebase-admin';
import dotenv from 'dotenv';
dotenv.config();

let serviceAccount;

try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  serviceAccount.private_key.replace(/\\n/g, '\n');
} catch (error) {
  console.error('Erro ao parsear FIREBASE_SERVICE_ACCOUNT:', error);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// Export default
export default admin;
export const db = admin.firestore();