import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { onRequest } from "firebase-functions/v2/https";
import { createApi } from "./http.mjs";
import { FirestoreRepository } from "./firestore-repository.mjs";
initializeApp();
const app = createApi({
  repository: new FirestoreRepository(getFirestore()),
  authenticate: async (req) => {
    const token = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    if (!token) throw new Error("missing-token");
    const user = await getAuth().verifyIdToken(token, true);
    if (
      !user.email_verified ||
      user.firebase?.sign_in_provider !== "google.com"
    )
      throw new Error("google-required");
    return { uid: user.uid, name: user.name || "", email: user.email || "" };
  },
});
export const api = onRequest(
  {
    region: "southamerica-east1",
    maxInstances: 5,
    timeoutSeconds: 60,
    memory: "256MiB",
    cors: false,
  },
  app,
);
