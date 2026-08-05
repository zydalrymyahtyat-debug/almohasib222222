import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

// The user's active production Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBIYnRtInr_uOLysRhvFX1ONpTtmL76YNs",
  authDomain: "flutter-ai-playground-d98b2.firebaseapp.com",
  projectId: "flutter-ai-playground-d98b2",
  storageBucket: "flutter-ai-playground-d98b2.firebasestorage.app",
  messagingSenderId: "460525767707",
  appId: "1:460525767707:web:fbfeeb924a0873298ebcbe"
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with robust local offline persistence (matches their HTML v10 setup)
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

export const auth = getAuth(app);
