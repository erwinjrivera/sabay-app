import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc } from 'firebase/firestore';

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

async function clearDb() {
  try {
    console.log('Clearing rideOffers collection...');
    const offersSnapshot = await getDocs(collection(db, 'rideOffers'));
    let offerCount = 0;
    for (const doc of offersSnapshot.docs) {
      await deleteDoc(doc.ref);
      offerCount++;
    }
    console.log(`Deleted ${offerCount} offer records.`);
    
    console.log('Clearing rideRequests collection...');
    const reqSnapshot = await getDocs(collection(db, 'rideRequests'));
    let reqCount = 0;
    for (const doc of reqSnapshot.docs) {
      await deleteDoc(doc.ref);
      reqCount++;
    }
    console.log(`Deleted ${reqCount} request records.`);
    
    console.log('Database successfully cleared!');
    process.exit(0);
  } catch (err) {
    console.error('Error clearing DB:', err);
    process.exit(1);
  }
}

clearDb();
