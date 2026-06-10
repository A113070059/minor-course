import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import firebaseConfig from "./firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Custom Shih Hsin University domain restriction hint (Google Sign-In)
googleProvider.setCustomParameters({
  hd: "mail.shu.edu.tw"
});
