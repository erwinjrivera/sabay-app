import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCvkkxxTw5fhXRwc942Ddv1dwRL7Z3cJeY",
  authDomain: "sabay-f0ee5.firebaseapp.com",
  projectId: "sabay-f0ee5",
  storageBucket: "sabay-f0ee5.firebasestorage.app",
  messagingSenderId: "1053554714707",
  appId: "1:1053554714707:web:49030521502f2e18a4bea6",
  measurementId: "G-WYQEYW701D"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function makeAdmin() {
  try {
    console.log('Upgrading all users to admin...');
    const usersSnapshot = await getDocs(collection(db, 'users'));
    let count = 0;
    for (const userDoc of usersSnapshot.docs) {
      await updateDoc(userDoc.ref, { isAdmin: true });
      count++;
    }
    console.log(`Upgraded ${count} users to admin.`);
    process.exit(0);
  } catch (err) {
    console.error('Error upgrading users:', err);
    process.exit(1);
  }
}

makeAdmin();
