import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "course-review-explorer-demo.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "course-review-explorer-demo",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Never use the auth emulator in production builds — emulator JWTs lack "kid" and fail backend verify.
const emulatorHost = import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_HOST;
if (import.meta.env.DEV && emulatorHost) {
  const host = emulatorHost.startsWith("http") ? emulatorHost : `http://${emulatorHost}`;
  connectAuthEmulator(auth, host, { disableWarnings: true });
}
