import { 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  where, 
  limit,
  setDoc,
  serverTimestamp, 
  writeBatch,
  doc,
  deleteDoc
} from 'firebase/firestore';
import { db, auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid || 'NOT_SIGNED_IN',
      email: auth.currentUser?.email || 'NONE',
      emailVerified: auth.currentUser?.emailVerified || false,
      isAnonymous: auth.currentUser?.isAnonymous || false,
    },
    operationType,
    path
  };
  console.error('Firestore Error Detailed: ', JSON.stringify(errInfo));
  
  if (errMessage.includes('permissions')) {
    const context = errInfo.authInfo.email === 'NONE' ? "not signed in" : `denied for ${errInfo.authInfo.email} (${errInfo.authInfo.userId})`;
    throw new Error(`Permission Denied: Access ${context}. Please ensure you are logged in with a verified admin account.`);
  }
  throw new Error(errMessage);
}

export interface Question {
  id?: string;
  text: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  module: string;
  setNumber: number;
  questionNumber?: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface ModuleNote {
  id: string;
  module: string;
  content: string;
  pdfUrl?: string;
  updatedAt?: any;
}

export const getQuestions = async (module?: string, setNumber?: number) => {
  const path = 'questions';
  try {
    let q = query(collection(db, path));
    if (module) {
      q = query(q, where('module', '==', module));
    }
    if (setNumber !== undefined) {
      q = query(q, where('setNumber', '==', setNumber));
    }
    const snapshot = await getDocs(q);
    let questions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Question));
    
    // Sort by questionNumber if available, else by createdAt
    questions = questions.sort((a, b) => {
      if (a.questionNumber !== undefined && b.questionNumber !== undefined) {
        return a.questionNumber - b.questionNumber;
      }
      return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    });
    
    return questions;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const deleteSet = async (module: string, setNumber: number) => {
  const path = 'questions';
  try {
    const q = query(collection(db, path), where('module', '==', module), where('setNumber', '==', setNumber));
    const snapshot = await getDocs(q);
    
    const docs = snapshot.docs;
    const CHUNK_SIZE = 450; // Staying safe under 500

    for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
      const chunk = docs.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      chunk.forEach(d => {
        batch.delete(d.ref);
      });
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `questions/module/${module}/set/${setNumber}`);
  }
};

export const getModuleNote = async (module: string) => {
  const path = 'notes';
  try {
    const q = query(collection(db, path), where('module', '==', module), limit(1));
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as ModuleNote;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const upsertModuleNote = async (module: string, content: string, pdfUrl?: string) => {
  const path = 'notes';
  try {
    const existing = await getModuleNote(module);
    if (existing) {
      const docRef = doc(db, path, existing.id);
      await setDoc(docRef, { content, pdfUrl: pdfUrl || null, updatedAt: serverTimestamp() }, { merge: true });
    } else {
      const docRef = doc(collection(db, path));
      await setDoc(docRef, { module, content, pdfUrl: pdfUrl || null, updatedAt: serverTimestamp() });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const getCategories = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'categories'));
    return snapshot.docs.map(doc => doc.id);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'categories');
    return [];
  }
};

export const addBulkQuestions = async (questions: Omit<Question, 'id' | 'createdAt'>[]) => {
  const path = 'questions';
  const CHUNK_SIZE = 400; // Firestore batch limit is 500
  
  if (!auth.currentUser) {
    throw new Error("No active session. Please log in.");
  }

  try {
    for (let i = 0; i < questions.length; i += CHUNK_SIZE) {
      const chunk = questions.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      chunk.forEach((q) => {
        const qRef = doc(collection(db, path));
        batch.set(qRef, {
          ...q,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      });

      await batch.commit();
      console.log(`Committed chunk ${Math.floor(i / CHUNK_SIZE) + 1}`);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const deleteQuestion = async (id: string) => {
  const path = `questions/${id}`;
  if (!id) {
    console.error("deleteQuestion: missing ID");
    return;
  }
  try {
    const qRef = doc(db, 'questions', id);
    await deleteDoc(qRef);
    console.log(`Deleted question: ${id}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const updateQuestion = async (id: string, question: Partial<Question>) => {
  const path = `questions/${id}`;
  try {
    const qRef = doc(db, 'questions', id);
    await setDoc(qRef, {
      ...question,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};
