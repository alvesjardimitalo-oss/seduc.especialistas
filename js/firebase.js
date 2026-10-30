// Único ponto de importação do SDK Firebase (facilita testes com um simulador local).
export { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
export {
  getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut,
  signInWithEmailAndPassword, sendPasswordResetEmail, createUserWithEmailAndPassword,
  EmailAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, verifyBeforeUpdateEmail
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
export {
  getFirestore, collection, doc, getDoc, getDocs, query, where,
  writeBatch, runTransaction, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
