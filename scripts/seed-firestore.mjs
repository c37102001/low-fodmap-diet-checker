import { readFile } from 'node:fs/promises';
import { applicationDefault, cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) {
  throw new Error('請設定 FIREBASE_PROJECT_ID，例如：FIREBASE_PROJECT_ID=my-project npm run seed:firestore');
}

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const credential = serviceAccountJson ? cert(JSON.parse(serviceAccountJson)) : applicationDefault();
initializeApp({ credential, projectId });

const foodDatabase = JSON.parse(
  await readFile(new URL('../low-fodmap-foods.zh-TW.json', import.meta.url), 'utf8'),
);
foodDatabase.updatedAt = new Date().toISOString();

await getFirestore().doc('appData/foodDatabase').set(foodDatabase);
console.log(`已將 ${foodDatabase.categories.length} 個分類寫入 appData/foodDatabase。`);
