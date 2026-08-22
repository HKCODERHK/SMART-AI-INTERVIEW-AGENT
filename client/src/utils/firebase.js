
import { initializeApp } from "firebase/app";
import {getAuth, GoogleAuthProvider} from "firebase/auth"
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_APIKEY,
   authDomain: "ai-interview-project-agent.firebaseapp.com",
  projectId: "ai-interview-project-agent",
  storageBucket: "ai-interview-project-agent.firebasestorage.app",
  messagingSenderId: "1003299477331",
  appId: "1:1003299477331:web:3ae0512bf911a39405f3a6"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const provider = new GoogleAuthProvider()

export {auth , provider}