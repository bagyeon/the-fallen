import { initializeApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  Timestamp
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDm9xVrjXO9zv2UdKedfbSj9Dg7H52JGGg",
  authDomain: "smilepark-game.firebaseapp.com",
  projectId: "smilepark-game",
  storageBucket: "smilepark-game.firebasestorage.app",
  messagingSenderId: "318047344293",
  appId: "1:318047344293:web:0e055f90254b8ccf211f4c",
  measurementId: "G-DB0FC53WVC"
};

const COLLECTION = "the-fallen-scores";
const TOP_N = 10;

class ScoreManager {
  constructor() {
    this.initialized = false;
    this.db = null;
    this.cache = new Map();
  }

  init() {
    if (this.initialized) return;
    try {
      const app = initializeApp(firebaseConfig);
      this.db = getFirestore(app);
      this.initialized = true;
    } catch (err) {
      console.warn("[ScoreManager] Firebase init failed:", err);
      this.initialized = false;
    }
  }

  getDocumentId(stage) {
    return `ranking${stage}`;
  }

  async getTop10(stage) {
    if (!this.initialized) {
      console.warn("[ScoreManager] Not initialized, returning empty ranking");
      return [];
    }

    const docId = this.getDocumentId(stage);
    if (this.cache.has(docId)) {
      return this.cache.get(docId);
    }

    try {
      const docRef = doc(this.db, COLLECTION, docId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        this.cache.set(docId, []);
        return [];
      }
      const data = snap.data();
      const list = data.ranking || [];
      list.sort((a, b) => b.score - a.score);
      const top = list.slice(0, TOP_N);
      this.cache.set(docId, top);
      return top;
    } catch (err) {
      console.warn("[ScoreManager] getTop10 failed:", err);
      return [];
    }
  }

  isEligibleForTop10(currentList, newScore) {
    if (!Array.isArray(currentList)) return false;
    if (currentList.length < TOP_N) return true;
    const sorted = [...currentList].sort((a, b) => b.score - a.score);
    const lowestTop = sorted[TOP_N - 1]?.score ?? 0;
    return newScore > lowestTop;
  }

  async submitScore(stage, { nickname, message, score }) {
    if (!this.initialized) {
      console.warn("[ScoreManager] Not initialized, cannot submit");
      return false;
    }

    try {
      const docId = this.getDocumentId(stage);
      const docRef = doc(this.db, COLLECTION, docId);
      const snap = await getDoc(docRef);
      const existingData = snap.exists() ? snap.data() : {};
      const currentList = existingData.ranking || [];

      const newEntry = {
        nickname: String(nickname || "익명").slice(0, 20),
        message: String(message || "").slice(0, 50),
        score: Number(score) || 0,
        datetime: Timestamp.now()
      };

      const merged = [...currentList, newEntry];
      merged.sort((a, b) => b.score - a.score);
      const trimmed = merged.slice(0, TOP_N);

      if (!snap.exists()) {
        await setDoc(docRef, { ranking: trimmed });
      } else {
        await updateDoc(docRef, { ranking: trimmed });
      }

      this.cache.set(docId, trimmed);
      return true;
    } catch (err) {
      console.warn("[ScoreManager] submitScore failed:", err);
      return false;
    }
  }

  formatDateTime(ts) {
    if (!ts) return "-";
    try {
      const date = ts instanceof Timestamp ? ts.toDate() : new Date(ts);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      const hh = String(date.getHours()).padStart(2, "0");
      const mm = String(date.getMinutes()).padStart(2, "0");
      return `${y}-${m}-${d} ${hh}:${mm}`;
    } catch (_) {
      return "-";
    }
  }
}

const instance = new ScoreManager();
export default instance;
