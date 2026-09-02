import { doc, getDoc, onSnapshot, setDoc, type Unsubscribe } from 'firebase/firestore';
import { firestore, isFirebaseConfigured } from './firebase';
import { cloneDatabase, seedDatabase } from './data';
import { validateFoodDatabase } from './validation';
import type { FoodDatabase } from './types';

const databasePath = ['appData', 'foodDatabase'] as const;

export type DatabaseSource = 'seed' | 'firebase';

export function subscribeToFoodDatabase(
  onData: (database: FoodDatabase, source: DatabaseSource) => void,
  onError: (message: string) => void,
): Unsubscribe | undefined {
  if (!isFirebaseConfigured || !firestore) {
    onData(cloneDatabase(seedDatabase), 'seed');
    return undefined;
  }
  return onSnapshot(
    doc(firestore, ...databasePath),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(cloneDatabase(seedDatabase), 'seed');
        return;
      }
      const validation = validateFoodDatabase(snapshot.data());
      if (!validation.valid) {
        onError(`Firebase 資料格式有誤：${validation.errors[0]}`);
        return;
      }
      onData(validation.data, 'firebase');
    },
    (error) => onError(`無法讀取 Firebase 資料：${error.message}`),
  );
}

export async function saveFoodDatabase(database: FoodDatabase): Promise<void> {
  if (!firestore || !isFirebaseConfigured) throw new Error('尚未設定 Firebase，無法儲存。');
  const validation = validateFoodDatabase(database);
  if (!validation.valid) throw new Error(validation.errors[0]);
  await setDoc(doc(firestore, ...databasePath), {
    ...validation.data,
    updatedAt: new Date().toISOString(),
  });
}

export async function getAdminStatus(uid: string): Promise<boolean> {
  if (!firestore || !isFirebaseConfigured) return false;
  const adminSnapshot = await getDoc(doc(firestore, 'admins', uid));
  return adminSnapshot.exists() && adminSnapshot.data().active === true;
}
