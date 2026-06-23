import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBrif6T33-puEgSHMgq4aoUjjImKOd_Tg4",
  authDomain: "weimp-d376e.firebaseapp.com",
  projectId: "weimp-d376e",
  storageBucket: "weimp-d376e.firebasestorage.app",
  messagingSenderId: "630235046246",
  appId: "1:630235046246:web:ff91eb1a36b8c6c85ae8a7"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);