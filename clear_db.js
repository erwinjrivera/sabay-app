import { db } from './src/firebase.js';
import { collection, getDocs, deleteDoc } from 'firebase/firestore';

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
