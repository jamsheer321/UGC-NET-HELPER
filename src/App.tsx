import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BookOpen, 
  Settings, 
  Pencil,
  Play, 
  Award, 
  ArrowLeft, 
  ArrowRight, 
  Upload, 
  LogOut,
  User,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Menu,
  ChevronRight,
  ChevronDown,
  Database,
  Trash2,
  Bookmark,
  ExternalLink,
  FileText,
  AlertCircle,
  Bell
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Markdown from 'react-markdown';
import { auth, signInWithGoogle, logout } from './lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { getQuestions, addBulkQuestions, deleteQuestion, deleteSet, getModuleNote, upsertModuleNote, updateQuestion, Question, ModuleNote } from './lib/db';

// --- Constants ---
const MODULES = [
  "Teaching Aptitude",
  "Research Aptitude",
  "Comprehension",
  "Communication",
  "Mathematical Reasoning and Aptitude",
  "Logical Reasoning",
  "Data Interpretation",
  "Information and Communication Technology (ICT)",
  "People, Development and Environment",
  "Higher Education System"
];

// --- Types ---
type View = 'home' | 'sets' | 'test' | 'result' | 'admin' | 'review' | 'browse' | 'notes';

interface TestState {
  questions: Question[];
  currentIdx: number;
  answers: Record<string, string>;
  startTime: number;
  duration: number; // in seconds
  timeLeft: number;
  module: string;
  setNumber: number;
}

// --- Components ---
const QuestionRow = ({ q, onRemove, onEdit, isDeleting }: { q: Question, onRemove?: (id: string) => void, onEdit?: (q: Question) => void, isDeleting?: boolean }) => {
  const [showOptions, setShowOptions] = useState(false);
  
  return (
    <div className={`bg-white p-5 rounded-[2rem] border shadow-sm space-y-4 transition-all ${isDeleting ? 'border-red-200 bg-red-50/30' : 'border-slate-100'}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full tracking-widest uppercase">{q.module} | S{q.setNumber} | Q{q.questionNumber || '#'}</span>
            <span className="text-[10px] font-black text-green-700 bg-green-50 px-2.5 py-1 rounded-full tracking-widest uppercase">Key: {q.correctAnswer}</span>
            {q.updatedAt && (
              <span className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">
                Last Updated: {q.updatedAt.toDate ? q.updatedAt.toDate().toLocaleDateString() : 'Recent'}
              </span>
            )}
          </div>
          <p className="text-[14px] font-bold text-slate-900 leading-snug">{q.text}</p>
        </div>
        <div className="flex gap-1 ml-2">
          {onEdit && (
            <button onClick={() => onEdit(q)} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors" title="Edit Question">
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {onRemove && (
            <button 
              onClick={() => onRemove(q.id!)} 
              className={`p-2 transition-all flex items-center gap-1 rounded-lg ${isDeleting ? 'bg-red-500 text-white scale-110 px-3' : 'text-slate-300 hover:text-red-500'}`}
              title={isDeleting ? "Click again to confirm" : "Delete Question"}
            >
              <Trash2 className="w-4 h-4" />
              {isDeleting && <span className="text-[10px] font-black uppercase">Confirm?</span>}
            </button>
          )}
        </div>
      </div>
      
      <button 
        onClick={() => setShowOptions(!showOptions)}
        className="w-full h-8 flex items-center justify-between px-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all group"
      >
        <span className="text-[10px] font-black text-slate-400 group-hover:text-slate-600 uppercase tracking-widest">
          {showOptions ? 'Hide Options' : 'Show Options (A-D)'}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showOptions ? 'rotate-180' : ''}`} />
      </button>

      {showOptions && (
        <div className="grid gap-2 pt-1">
          {(['A', 'B', 'C', 'D'] as const).map(key => (
            <div key={key} className={`text-[12px] p-2.5 rounded-xl border flex items-center gap-3 ${key === q.correctAnswer ? 'bg-indigo-50 border-indigo-100 text-indigo-900' : 'bg-slate-50 border-slate-50 text-slate-500'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] ${key === q.correctAnswer ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'}`}>
                {key}
              </div>
              <span className="font-bold">{q.options[key]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: -20, x: '-50%' }}
    animate={{ opacity: 1, y: 0, x: '-50%' }}
    exit={{ opacity: 0, y: -20, x: '-50%', transition: { duration: 0.2 } }}
    className={`fixed top-6 left-1/2 z-[9999] px-6 py-4 rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex items-center gap-4 min-w-[320px] max-w-[90vw] border backdrop-blur-md ${
      type === 'success' ? 'bg-green-600/95 border-green-400 text-white' :
      type === 'error' ? 'bg-red-600/95 border-red-400 text-white' :
      'bg-slate-900/95 border-slate-700 text-white'
    }`}
  >
    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
      type === 'success' ? 'bg-white/20' :
      type === 'error' ? 'bg-white/20' :
      'bg-white/10'
    }`}>
      {type === 'success' && <CheckCircle2 className="w-6 h-6" />}
      {type === 'error' && <AlertCircle className="w-6 h-6" />}
      {type === 'info' && <Bell className="w-6 h-6" />}
    </div>
    <div className="flex-1">
      <p className="text-[14px] font-black uppercase tracking-widest opacity-70 mb-0.5">
        {type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Notification'}
      </p>
      <p className="text-[15px] font-bold leading-tight">{message}</p>
    </div>
    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
      <XCircle className="w-5 h-5 opacity-50" />
    </button>
  </motion.div>
);

const Header = ({ 
  user, 
  onAdminClick, 
  onHomeClick, 
  onBrowseClick,
  currentView,
  timeLeft
}: { 
  user: FirebaseUser | null, 
  onAdminClick: () => void, 
  onHomeClick: () => void,
  onBrowseClick: () => void,
  currentView: View,
  timeLeft?: number
}) => (
  <header className="sticky top-0 left-0 right-0 p-3 px-5 bg-white/95 backdrop-blur-md border-b border-slate-100 flex items-center justify-between z-50">
    <div className="flex items-center gap-2.5 cursor-pointer" onClick={onHomeClick}>
      <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
        <User className="w-5 h-5" />
      </div>
      <div>
        <h1 className="text-[13px] font-black text-slate-900 leading-none">UGC NET SYSTEM</h1>
        <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 tracking-tighter">Paper 1 Mock Mock</p>
      </div>
    </div>
    <div className="flex items-center gap-2">
      {timeLeft !== undefined && (
        <div className="bg-red-100 text-red-600 px-2.5 py-1 rounded-full font-bold text-[13px] flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
        </div>
      )}
      <div className="flex items-center gap-1">
        <button 
          onClick={onHomeClick}
          className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${currentView === 'home' ? 'bg-primary text-white shadow-sm' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          Tests
        </button>
        {user?.email === 'bookdistribution2020@gmail.com' && (
          <button 
            onClick={onBrowseClick}
            className={`p-2 rounded-lg transition-all flex items-center gap-2 ${currentView === 'browse' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
            title="Browse Question Bank"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Bank</span>
          </button>
        )}
        {user?.email === 'bookdistribution2020@gmail.com' && (
          <button 
            onClick={onAdminClick}
            className={`p-2 rounded-lg transition-all flex items-center gap-2 ${currentView === 'admin' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
            title="Admin Hub"
          >
            <Database className="w-4 h-4" />
            <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Admin</span>
          </button>
        )}
      </div>
    </div>
  </header>
);

const CategoryCard = ({ title, count, onClick }: { title: string, count?: number, onClick: () => void }) => (
  <motion.div 
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer flex items-center justify-between group"
  >
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-slate-100 text-slate-900 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
        <Settings className="w-5 h-5" />
      </div>
      <div>
        <h3 className="font-bold text-slate-900 text-[15px]">{title}</h3>
        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">{count ?? 0} Questions</p>
      </div>
    </div>
    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-primary transition-colors" />
  </motion.div>
);

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [view, setView] = useState<View>('home');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const [availableSets, setAvailableSets] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [qSearchTerm, setQSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Toast State
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    // Auto-dismiss after 5 seconds for better visibility
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 5000);
  };
  const [adminTab, setAdminTab] = useState<'upload' | 'manage' | 'manual' | 'notes'>('upload');
  
  const [randomize, setRandomize] = useState(true);
  
  // Manage Tab State
  const [manageModule, setManageModule] = useState(MODULES[0]);
  const [manageSet, setManageSet] = useState<number | null>(null);
  const [expandedSet, setExpandedSet] = useState<{ module: string, setNum: number } | null>(null);
  
  // Edit Question State
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  
  // Notes State
  const [currentNote, setCurrentNote] = useState<ModuleNote | null>(null);
  const [noteEditContent, setNoteEditContent] = useState('');
  const [noteEditPdfUrl, setNoteEditPdfUrl] = useState('');
  const [noteEditModule, setNoteEditModule] = useState(MODULES[0]);

  // Manual Question State
  const [manualQuestion, setManualQuestion] = useState<Omit<Question, 'id' | 'createdAt'>>({
    module: MODULES[0],
    setNumber: 1,
    questionNumber: 1,
    text: '',
    options: { A: '', B: '', C: '', D: '' },
    correctAnswer: 'A'
  });
  
  // Test State
  const [test, setTest] = useState<TestState | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    fetchQuestions();
    return unsub;
  }, []);

  useEffect(() => {
    if (view === 'browse' || (view === 'admin' && (adminTab === 'manage' || adminTab === 'manual'))) {
      fetchQuestions();
    }
  }, [view, adminTab]);

  const fetchQuestions = async () => {
    const all = await getQuestions();
    setQuestions(all);
  };

  const startTest = async (module: string, setNumber: number) => {
    setLoading(true);
    let testQs = await getQuestions(module, setNumber);
    
    if (testQs.length === 0) {
      showToast("No questions found for this set.", "error");
      setLoading(false);
      return;
    }

    if (randomize) {
      testQs = [...testQs].sort(() => Math.random() - 0.5);
    }

    setTest({
      questions: testQs,
      currentIdx: 0,
      answers: {},
      startTime: Date.now(),
      duration: 60 * 60, // 60 mins
      timeLeft: 60 * 60,
      module,
      setNumber
    });
    setView('test');
    setLoading(false);
  };

  useEffect(() => {
    let timer: any;
    if (view === 'test' && test && test.timeLeft > 0) {
      timer = setInterval(() => {
        setTest(prev => prev ? { ...prev, timeLeft: prev.timeLeft - 1 } : null);
      }, 1000);
    } else if (test?.timeLeft === 0 && view === 'test') {
      showToast("Time's up! Submitting your test.", "info");
      setView('result');
    }
    return () => clearInterval(timer);
  }, [view, test?.timeLeft]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const currentQ = test?.questions[test.currentIdx];

  const handleOptionSelect = (opt: string) => {
    if (!test || !currentQ) return;
    setTest({
      ...test,
      answers: { ...test.answers, [currentQ.id!]: opt }
    });
  };

  const calculateScore = () => {
    if (!test) return { correct: 0, wrong: 0, total: 0, percent: 0 };
    let correct = 0;
    test.questions.forEach(q => {
      if (test.answers[q.id!] === q.correctAnswer) correct++;
    });
    const total = test.questions.length;
    return {
      correct,
      wrong: total - correct,
      total,
      percent: Math.round((correct / total) * 100)
    };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        if (!data) throw new Error("Could not read file data");
        
        const wb = XLSX.read(data, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const json = XLSX.utils.sheet_to_json(ws) as any[];

        if (json.length === 0) {
          throw new Error("The Excel file is empty.");
        }

        // Improved Key Mapping
        const keys = Object.keys(json[0]);
        const findKey = (aliases: string[]) => {
          const canonicalAliases = aliases.map(a => a.toLowerCase().replace(/[^a-z0-9]/g, ''));
          return keys.find(k => {
            const canonicalKey = k.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            return canonicalAliases.includes(canonicalKey) || aliases.map(a => a.toLowerCase()).includes(k.trim().toLowerCase());
          });
        };

        const colMap = {
          module: findKey(['Module', 'module', 'subject', 'unit', 'topic', 'module name']),
          set: findKey(['Set Number', 'set number', 'setno', 'set no', 'set', 'mock set', 'set id', 'setid']),
          qNum: findKey(['Question Number', 'question number', 'qno', 'q no', 'questionno', 'sl no', 'sn', 'sno', 'no', 'index', 'itemno']),
          text: findKey(['Question', 'question', 'text', 'q text', 'question text']),
          optA: findKey(['Option A', 'option a', 'a', 'opt a']),
          optB: findKey(['Option B', 'option b', 'b', 'opt b']),
          optC: findKey(['Option C', 'option c', 'c', 'opt c']),
          optD: findKey(['Option D', 'option d', 'd', 'opt d']),
          correct: findKey(['Correct Answer', 'correct answer', 'answer', 'correct', 'key', 'ans'])
        };

        const missing = Object.entries(colMap)
          .filter(([_, value]) => !value)
          .map(([key]) => key.toUpperCase());

        if (missing.length > 0) {
          throw new Error(`Missing or unrecognized columns: ${missing.join(', ')}.\nFound columns: ${keys.join(', ')}.\nPlease ensure the first row of your Excel file contains the column headers.`);
        }

        const formattedQs = json.map((item, index) => {
          const text = item[colMap.text!];
          const optA = item[colMap.optA!];
          const optB = item[colMap.optB!];
          const optC = item[colMap.optC!];
          const optD = item[colMap.optD!];
          const correct = item[colMap.correct!];
          const module = item[colMap.module!];
          const setNumber = item[colMap.set!];
          const qNum = item[colMap.qNum!];

          if (!text || !optA || !optB || !optC || !optD || !correct || !module || !setNumber) {
            throw new Error(`Row ${index + 1} is missing data. Every row must have a Question, Options, Answer, Module, and Set.`);
          }

          const moduleStr = String(module).trim();
          const matchedModule = MODULES.find(m => m.toLowerCase() === moduleStr.toLowerCase());

          if (!matchedModule) {
             throw new Error(`Invalid Module at row ${index + 1}: "${moduleStr}". Please use one of the standard 10 module names.`);
          }

          const setNum = parseInt(String(setNumber));
          if (isNaN(setNum) || setNum < 1 || setNum > 50) {
            throw new Error(`Invalid Set Number at row ${index + 1}: "${setNumber}". Must be a number between 1 and 50.`);
          }

          const validAnswers = ['A', 'B', 'C', 'D'];
          const normalizedCorrect = String(correct).trim().toUpperCase();
          
          if (!validAnswers.includes(normalizedCorrect)) {
            throw new Error(`Row ${index + 1} has an invalid Correct Answer: "${correct}". Must be A, B, C, or D.`);
          }

          return {
            text: String(text).trim().slice(0, 10000),
            options: {
              A: String(optA).trim().slice(0, 2000),
              B: String(optB).trim().slice(0, 2000),
              C: String(optC).trim().slice(0, 2000),
              D: String(optD).trim().slice(0, 2000),
            },
            correctAnswer: normalizedCorrect as 'A' | 'B' | 'C' | 'D',
            module: matchedModule,
            setNumber: setNum,
            questionNumber: qNum ? parseInt(String(qNum)) : undefined
          };
        });

        // Group by Module and Set to validate 50 count
        const groups: Record<string, number> = {};
        formattedQs.forEach(q => {
          const key = `${q.module}_Set${q.setNumber}`;
          groups[key] = (groups[key] || 0) + 1;
        });

        for (const [key, count] of Object.entries(groups)) {
          if (count > 50) {
            throw new Error(`${key} has ${count} questions. Each set can have a maximum of 50 questions.`);
          }
        }

        if (!auth.currentUser) {
           showToast("Please log in to upload.", "error");
           signInWithGoogle();
           return;
        }

        await addBulkQuestions(formattedQs);
        showToast(`Successfully uploaded ${formattedQs.length} questions across ${Object.keys(groups).length} sets!`, "success");
        await fetchQuestions();
        setAdminTab('manage');
      } catch (err: any) {
        console.error(err);
        showToast(err.message, "error");
      } finally {
        setLoading(false);
        e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [purgingSetNum, setPurgingSetNum] = useState<number | null>(null);

  const handleRemoveQuestion = async (id: string) => {
    if (!id) {
      showToast("Question ID missing.", "error");
      return;
    }
    if (!auth.currentUser) {
      showToast("Authentication required. Please sign in.", "error");
      signInWithGoogle();
      return;
    }
    
    if (deletingId !== id) {
      setDeletingId(id);
      // Auto-reset after 3 seconds if not confirmed
      setTimeout(() => setDeletingId(null), 3000);
      return;
    }

    setLoading(true);
    try {
      await deleteQuestion(id);
      showToast("Question deleted.", "success");
      setDeletingId(null);
      await fetchQuestions();
    } catch (err: any) {
      showToast(err.message || "Failed to delete question", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!auth.currentUser) {
      showToast("Authentication required. Please sign in.", "error");
      signInWithGoogle();
      return;
    }
    
    // Strict Validation
    const { text, options, module, setNumber, questionNumber } = manualQuestion;
    if (!text.trim() || !options.A.trim() || !options.B.trim() || !options.C.trim() || !options.D.trim()) {
      showToast("All fields are required. Please ensure Question and all 4 Options are filled.", "error");
      return;
    }

    if (!module || !setNumber || !manualQuestion.correctAnswer) {
      showToast("Module, Set Number and Correct Answer are required.", "error");
      return;
    }

    setLoading(true);
    try {
      // Check for duplicates (only if adding new or if key identifiers changed)
      const isDuplicate = questions.some(q => 
        q.id !== editingQuestionId && 
        q.module === module && 
        q.setNumber === setNumber && 
        questionNumber &&
        q.questionNumber === questionNumber
      );

      if (isDuplicate) {
        showToast(`Duplicate: A question already exists for ${module} Set ${setNumber} Question ${questionNumber}.`, "error");
        setLoading(false);
        return;
      }

      if (editingQuestionId) {
        await updateQuestion(editingQuestionId, manualQuestion);
        showToast("Question updated successfully!", "success");
        setEditingQuestionId(null);
        setView('browse'); 
      } else {
        await addBulkQuestions([manualQuestion]);
        showToast("Question added successfully!", "success");
      }
      
      setManualQuestion(prev => ({
        ...prev,
        text: '',
        options: { A: '', B: '', C: '', D: '' },
        questionNumber: (prev.questionNumber || 0) + 1
      }));
      await fetchQuestions();
    } catch (err: any) {
      console.error("Submission Error:", err);
      showToast(err.message || "Failed to save question", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleEditQuestion = (q: Question) => {
    setManualQuestion({
      module: q.module,
      setNumber: q.setNumber,
      questionNumber: q.questionNumber || 1,
      text: q.text,
      options: { ...q.options },
      correctAnswer: q.correctAnswer
    });
    setEditingQuestionId(q.id || null);
    setAdminTab('manual');
    setView('admin');
    
    // Scroll to top of the container or window
    const main = document.querySelector('main');
    if (main) main.scrollTop = 0;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNoteSave = async () => {
    if (!auth.currentUser) {
      showToast("Authentication required. Please sign in.", "error");
      signInWithGoogle();
      return;
    }
    if (!noteEditContent.trim() && !noteEditPdfUrl.trim()) {
      showToast("Notes content or PDF URL is required.", "error");
      return;
    }
    setLoading(true);
    try {
      await upsertModuleNote(noteEditModule, noteEditContent, noteEditPdfUrl);
      showToast("Notes saved successfully!", "success");
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Error saving notes.", "error");
    } finally {
      setLoading(false);
    }
  };

  const openNotes = async (module: string) => {
    setLoading(true);
    const note = await getModuleNote(module);
    setCurrentNote(note);
    setSelectedModule(module);
    setView('notes');
    setLoading(false);
  };

  const filteredModules = MODULES.filter(m => m.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredQs = questions.filter(q => 
    q.text.toLowerCase().includes(qSearchTerm.toLowerCase()) || 
    q.module.toLowerCase().includes(qSearchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#e2e8f0] font-sans selection:bg-indigo-100 flex items-center justify-center">
      <main className="w-full max-w-md h-screen bg-white relative flex flex-col shadow-2xl overflow-hidden md:h-[850px] md:rounded-[48px] md:border-[12px] md:border-slate-900 flex-shrink-0">
        <Header 
          user={user} 
          onAdminClick={() => setView('admin')} 
          onHomeClick={() => setView('home')}
          onBrowseClick={() => setView('browse')}
          currentView={view} 
          timeLeft={test?.timeLeft}
        />

        <AnimatePresence>
          {toast && (
            <Toast 
              message={toast.message} 
              type={toast.type} 
              onClose={() => setToast(null)} 
            />
          )}
        </AnimatePresence>

        <div className="flex-1 overflow-y-auto px-5 pb-24 relative">
          <AnimatePresence mode="wait">
            {view === 'home' && (
              <motion.div 
                key="home"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 pt-8"
              >
                <div className="space-y-1">
                  <h2 className="text-[22px] font-black text-slate-900 tracking-tight leading-tight">UGC NET Paper 1<br/>Mock Test</h2>
                  <p className="text-slate-400 text-[13px] font-medium">Master the 10 Core Modules.</p>
                </div>

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                  <input 
                    type="text" 
                    placeholder="Search modules..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 pl-11 pr-4 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/5 transition-all font-bold placeholder:text-slate-300"
                  />
                </div>

              <div className="grid gap-3">
                {filteredModules.map(mod => (
                  <CategoryCard 
                    key={mod} 
                    title={mod} 
                    count={questions.filter(q => q.module === mod).length}
                    onClick={() => {
                      const sets = Array.from(new Set(questions.filter(q => q.module === mod).map(q => q.setNumber))).sort((a, b) => a - b);
                      setSelectedModule(mod);
                      setAvailableSets(sets);
                      setView('sets');
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {view === 'sets' && selectedModule && (
            <motion.div 
              key="sets"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6 pt-8"
            >
              <div className="flex items-center gap-3">
                <button onClick={() => setView('home')} className="p-2 hover:bg-slate-100 rounded-xl">
                  <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
                <div className="flex-1 flex items-center justify-between">
                  <div>
                    <h2 className="text-[18px] font-black text-slate-900 leading-tight">{selectedModule}</h2>
                    <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">Available Mock Sets</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => openNotes(selectedModule!)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-all"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-[8px]">Notes</span>
                    </button>
                    <button 
                      onClick={() => setRandomize(!randomize)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${randomize ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full border-2 border-current flex items-center justify-center`}>
                        {randomize && <div className="w-1.5 h-1.5 bg-current rounded-full" />}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-[8px]">Shuffle</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                {availableSets.map(setNum => (
                  <button
                    key={setNum}
                    onClick={() => startTest(selectedModule, setNum)}
                    className="aspect-square bg-white border border-slate-100 rounded-xl flex flex-col items-center justify-center shadow-sm hover:shadow-md hover:border-primary transition-all group"
                  >
                    <span className="text-[10px] font-black text-slate-400 group-hover:text-primary transition-colors">SET</span>
                    <span className="text-[20px] font-black text-slate-900 leading-none">{setNum}</span>
                  </button>
                ))}
                {availableSets.length === 0 && (
                  <div className="col-span-4 py-20 text-center space-y-2">
                    <p className="text-slate-400 text-sm font-medium">No sets available for this module yet.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {view === 'notes' && selectedModule && (
            <motion.div 
              key="notes"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="h-full flex flex-col bg-slate-50"
            >
              {/* Sticky Top Bar */}
              <div className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={() => setView('sets')} className="p-2 -ml-2 hover:bg-slate-100 rounded-xl transition-colors">
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                  </button>
                  <div>
                    <h2 className="text-[15px] font-black text-slate-900 leading-none">{selectedModule}</h2>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Study Material</p>
                  </div>
                </div>
                {/* TOC Trigger or Progress if needed */}
                <div className="flex items-center gap-2">
                   <button className="p-2 bg-slate-50 border border-slate-100 rounded-xl text-slate-400">
                     <Bookmark className="w-4 h-4" />
                   </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pt-6 pb-24 space-y-8">
                {/* Module Heading Card */}
                <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
                  <BookOpen className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10" />
                  <div className="relative space-y-3">
                    <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-widest">Core Module</span>
                    <h1 className="text-[26px] font-black leading-tight tracking-tight">{selectedModule}</h1>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                        <span className="text-[10px] font-bold text-indigo-100">Ready to Study</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content Area */}
                <div className="space-y-6">
                  {currentNote ? (
                    <div className="space-y-8">
                      {currentNote.pdfUrl && (
                        <div className="bg-white p-8 rounded-[2.5rem] border border-indigo-50 shadow-sm flex flex-col items-center text-center space-y-6">
                           <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center">
                              <FileText className="w-10 h-10 text-red-500" />
                           </div>
                           <div className="space-y-2">
                              <h3 className="text-[18px] font-black text-slate-900">PDF Study Material</h3>
                              <p className="text-slate-400 text-[13px] font-medium max-w-[240px] mx-auto leading-relaxed">
                                Detailed notes and diagrams are available in the PDF version for this module.
                              </p>
                           </div>
                           <button 
                             onClick={() => window.open(currentNote.pdfUrl, '_blank')}
                             className="w-full h-14 bg-red-600 text-white rounded-2xl font-black text-[14px] shadow-xl shadow-red-100 flex items-center justify-center gap-3 uppercase tracking-widest transition-transform active:scale-95"
                           >
                             <ExternalLink className="w-5 h-5" />
                             Open PDF Directly
                           </button>
                        </div>
                      )}

                      <div className="prose prose-slate max-w-none px-2 pb-10">
                        <Markdown
                        components={{
                          h2: ({children}) => (
                            <div className="mt-10 mb-4 flex items-center gap-3">
                              <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                              <h2 className="text-[20px] font-black text-slate-900 m-0 leading-tight">{children}</h2>
                            </div>
                          ),
                          h3: ({children}) => (
                            <h3 className="text-[17px] font-bold text-indigo-700 mt-8 mb-3 m-0">{children}</h3>
                          ),
                          p: ({children}) => (
                            <p className="text-[15px] leading-[1.7] text-slate-600 font-medium my-4">{children}</p>
                          ),
                          ul: ({children}) => (
                            <ul className="space-y-3 my-6 p-0">{children}</ul>
                          ),
                          li: ({children}) => (
                            <li className="flex items-start gap-3 text-[14px] font-medium text-slate-600 marker:text-transparent">
                              <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-300 flex-shrink-0" />
                              <span>{children}</span>
                            </li>
                          ),
                          blockquote: ({children}) => (
                            <div className="bg-amber-50 border-l-4 border-amber-400 p-5 my-8 rounded-r-2xl relative overflow-hidden">
                              <div className="flex items-center gap-2 mb-2 text-amber-700 font-black text-[11px] uppercase tracking-widest">
                                <Search className="w-3.5 h-3.5" />
                                <span>Exam Highlight</span>
                              </div>
                              <div className="text-[14px] leading-relaxed italic text-amber-900 font-bold">
                                {children}
                              </div>
                            </div>
                          ),
                          code: ({children}) => (
                            <div className="bg-slate-100 p-4 rounded-xl border border-slate-200 font-mono text-[13px] text-slate-700 my-6">
                              {children}
                            </div>
                          )
                        }}
                      >
                        {currentNote.content}
                      </Markdown>

                      {/* Divider and Completion */}
                      <div className="pt-10 border-t border-slate-100 text-center space-y-6">
                        <div className="inline-flex items-center justify-center p-3 bg-green-50 rounded-full">
                          <CheckCircle2 className="w-8 h-8 text-green-500" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-[18px] font-black text-slate-900">Module Read Complete</h4>
                          <p className="text-slate-400 text-xs font-medium">You've finished the study notes for this module.</p>
                        </div>
                        <button 
                          onClick={() => setView('sets')}
                          className="w-full h-14 bg-slate-900 text-white rounded-2xl font-black text-[15px] shadow-xl shadow-slate-200"
                        >
                          PRACTICE MOCK TEST
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                    <div className="text-center py-24 space-y-6 bg-white rounded-[3rem] border border-slate-100 shadow-sm">
                      <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                        <BookOpen className="w-10 h-10 text-slate-200" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-[16px] font-black text-slate-900">No Material Yet</h3>
                        <p className="text-slate-400 text-[12px] font-medium leading-relaxed px-10">Study material for this module is being prepared and will be available shortly.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'browse' && (
             <motion.div 
               key="browse"
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               className="space-y-6 pt-6"
             >
               <div className="space-y-1">
                 <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Question Bank</h2>
                 <p className="text-gray-500 text-sm">Browse all questions by keyword or category.</p>
               </div>

                 <div className="relative">
                   <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                   <input 
                     type="text" 
                     placeholder="Filter questions..."
                     value={qSearchTerm}
                     onChange={(e) => setQSearchTerm(e.target.value)}
                     className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3.5 pl-11 pr-4 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary/5 transition-all font-bold placeholder:text-slate-300"
                   />
                 </div>

                <div className="space-y-3 pb-10">
                  {filteredQs.map(q => (
                    <QuestionRow 
                      key={q.id} 
                      q={q} 
                      onEdit={user?.email === 'bookdistribution2020@gmail.com' ? handleEditQuestion : undefined}
                      onRemove={user?.email === 'bookdistribution2020@gmail.com' ? handleRemoveQuestion : undefined}
                    />
                  ))}
                  {filteredQs.length === 0 && <p className="text-center py-10 text-gray-400 text-sm">No questions found.</p>}
                </div>
             </motion.div>
          )}

          {view === 'test' && test && currentQ && (
            <motion.div 
              key="test"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col h-full pt-6"
            >
              <div className="mb-6">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-[12px] font-bold text-slate-900">
                    Question {test.currentIdx + 1} <span className="text-slate-400 font-medium">/ {test.questions.length}</span>
                  </span>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {Math.round(((test.currentIdx + 1) / test.questions.length) * 100)}% Complete
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300" 
                    style={{ width: `${((test.currentIdx + 1) / test.questions.length) * 100}%` }}
                  />
                </div>
              </div>

              <div className="flex-1 space-y-6">
                <div>
                  <span className="inline-block px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-black uppercase tracking-widest mb-3">
                    {currentQ.module} | Set {test.setNumber}
                  </span>
                  <h3 className="text-[17px] font-bold text-slate-900 leading-snug">
                    {currentQ.text}
                  </h3>
                </div>

                <div className="flex flex-col gap-3">
                  {(['A', 'B', 'C', 'D'] as const).map((key) => {
                    const isSelected = test.answers[currentQ.id!] === key;
                    return (
                      <button
                        key={key}
                        onClick={() => handleOptionSelect(key)}
                        className={`group p-4 rounded-xl border text-left flex items-center gap-3 transition-all ${
                          isSelected 
                            ? 'bg-indigo-50 border-primary shadow-[0_0_0_1px_#4f46e5]' 
                            : 'bg-white border-slate-100 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all ${
                          isSelected ? 'border-primary bg-primary' : 'border-slate-200'
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />}
                        </div>
                        <span className="text-[14px] font-bold">{currentQ.options[key]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="fixed bottom-0 left-0 right-0 p-5 bg-white border-t border-slate-100 max-w-md mx-auto flex gap-3 pb-8">
                <button 
                  disabled={test.currentIdx === 0}
                  onClick={() => setTest({ ...test, currentIdx: test.currentIdx - 1 })}
                  className="px-6 h-11 bg-slate-100 disabled:opacity-30 text-slate-600 rounded-xl font-bold text-[14px] flex items-center justify-center gap-2"
                >
                  ← Prev
                </button>
                {test.currentIdx === test.questions.length - 1 ? (
                  <button 
                    onClick={() => setView('result')}
                    className="flex-1 h-11 bg-primary text-white rounded-xl font-bold text-[14px] shadow-lg shadow-primary/20"
                  >
                    Finish Test →
                  </button>
                ) : (
                  <button 
                    onClick={() => setTest({ ...test, currentIdx: test.currentIdx + 1 })}
                    className="flex-1 h-11 bg-primary text-white rounded-xl font-bold text-[14px] flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                  >
                    Next Step →
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {view === 'result' && (
            <motion.div 
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="pt-12 flex flex-col items-center text-center space-y-8"
            >
              <div className="relative">
                <div className="w-28 h-28 bg-indigo-50 rounded-[2rem] flex items-center justify-center">
                  <Award className="w-14 h-14 text-primary" />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-slate-900 text-white px-3 py-1.5 rounded-xl shadow-lg font-black text-sm">
                  {calculateScore().percent}%
                </div>
              </div>

              <div className="space-y-2">
                <h2 className="text-[28px] font-black text-slate-900 leading-tight">Session Results</h2>
                <p className="text-slate-400 text-[13px] font-bold uppercase tracking-wider">Module: {test?.module} | Set: {test?.setNumber}</p>
              </div>

              <div className="grid grid-cols-3 gap-2.5 w-full">
                <div className="bg-slate-100 p-4 rounded-xl border border-slate-200">
                  <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-1">Correct</p>
                  <p className="text-xl font-black text-indigo-700">{calculateScore().correct}</p>
                </div>
                <div className="bg-slate-100 p-4 rounded-xl border border-slate-200">
                  <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-1">Wrong</p>
                  <p className="text-xl font-black text-red-600">{calculateScore().wrong}</p>
                </div>
                <div className="bg-slate-100 p-4 rounded-xl border border-slate-200">
                  <p className="text-[10px] uppercase tracking-widest font-black text-slate-400 mb-1">Total</p>
                  <p className="text-xl font-black text-slate-900">{calculateScore().total}</p>
                </div>
              </div>

              <div className="space-y-3 w-full pt-4">
                <button 
                  onClick={() => setView('review')}
                  className="w-full h-14 bg-primary text-white rounded-2xl font-bold text-[15px] shadow-lg shadow-primary/20"
                >
                  Review Detailed Report
                </button>
                <button 
                  onClick={() => setView('home')}
                  className="w-full h-14 bg-slate-100 text-slate-600 rounded-2xl font-bold text-[15px]"
                >
                  Return to Dashboard
                </button>
              </div>
            </motion.div>
          )}

          {view === 'review' && test && (
             <motion.div 
               key="review"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               className="space-y-6 pt-8"
             >
               <div className="flex items-center gap-4">
                 <button onClick={() => setView('result')} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                   <ArrowLeft className="w-5 h-5" />
                 </button>
                 <h2 className="text-[20px] font-black tracking-tight">Performance Report</h2>
               </div>

               <div className="space-y-4 pb-12">
                 {test.questions.map((q, idx) => {
                   const userAns = test.answers[q.id!];
                   const isCorrect = userAns === q.correctAnswer;

                   return (
                     <div key={q.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                       <div className="flex justify-between items-start">
                         <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest">Item {idx + 1}</span>
                         {isCorrect ? (
                           <span className="flex items-center gap-1.5 text-[10px] font-black text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full uppercase tracking-widest">
                             <CheckCircle2 className="w-3 h-3" /> PASS
                           </span>
                         ) : (
                           <span className="flex items-center gap-1.5 text-[10px] font-black text-red-600 bg-red-50 px-3 py-1 rounded-full uppercase tracking-widest">
                             <XCircle className="w-3 h-3" /> FAIL
                           </span>
                         )}
                       </div>
                       <h4 className="text-[15px] font-bold text-slate-900 leading-tight">{q.text}</h4>
                       <div className="grid gap-2">
                         {(['A', 'B', 'C', 'D'] as const).map(key => (
                           <div 
                             key={key}
                             className={`text-[13px] p-3.5 rounded-xl border flex justify-between items-center transition-all ${
                               key === q.correctAnswer 
                                 ? 'bg-indigo-50 border-indigo-200 text-indigo-800 font-bold' 
                                 : key === userAns && !isCorrect 
                                   ? 'bg-red-50 border-red-200 text-red-800 font-bold'
                                   : 'bg-slate-50/50 border-slate-100 text-slate-400'
                             }`}
                           >
                             <span className="font-bold">{key}. {q.options[key]}</span>
                             {key === q.correctAnswer && <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />}
                           </div>
                         ))}
                       </div>
                     </div>
                   );
                 })}
               </div>
             </motion.div>
          )}

          {view === 'admin' && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6 pt-6"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-2xl font-extrabold tracking-tight">Admin Hub</h2>
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-widest">Signed in as {user?.displayName}</p>
                </div>
                <button onClick={logout} className="p-2 text-red-500 bg-red-50 rounded-xl">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>

              {/* Admin Tabs */}
              <div className="flex bg-gray-100 p-1 rounded-2xl">
                <button 
                   onClick={() => setAdminTab('upload')}
                   className={`flex-1 py-2 text-[11px] font-black rounded-xl transition-all uppercase tracking-widest ${adminTab === 'upload' ? 'bg-white text-primary shadow-sm' : 'text-slate-400'}`}
                >
                  Upload
                </button>
                <button 
                   onClick={() => {
                     setAdminTab('manual');
                     if (adminTab !== 'manual' && !editingQuestionId) {
                       setManualQuestion({
                         module: MODULES[0],
                         setNumber: 1,
                         questionNumber: 1,
                         text: '',
                         options: { A: '', B: '', C: '', D: '' },
                         correctAnswer: 'A'
                       });
                     }
                   }}
                   className={`flex-1 py-2 text-[11px] font-black rounded-xl transition-all uppercase tracking-widest ${adminTab === 'manual' ? 'bg-white text-primary shadow-sm' : 'text-slate-400'}`}
                >
                  {editingQuestionId ? 'Edit Mode' : 'Add Question'}
                </button>
                <button 
                   onClick={() => setAdminTab('notes')}
                   className={`flex-1 py-2 text-[11px] font-black rounded-xl transition-all uppercase tracking-widest ${adminTab === 'notes' ? 'bg-white text-primary shadow-sm' : 'text-slate-400'}`}
                >
                  Notes
                </button>
                <button 
                   onClick={() => setAdminTab('manage')}
                   className={`flex-1 py-2 text-[11px] font-black rounded-xl transition-all uppercase tracking-widest ${adminTab === 'manage' ? 'bg-white text-primary shadow-sm' : 'text-slate-400'}`}
                >
                  Manage
                </button>
              </div>

              {adminTab === 'upload' && (
                <div className="space-y-6">
                  <div className="bg-primary p-8 rounded-[2.5rem] text-white shadow-2xl shadow-primary/20 relative overflow-hidden group">
                    <Upload className="absolute -bottom-4 -right-4 w-32 h-32 opacity-10 group-hover:scale-110 transition-transform duration-500" />
                    <div className="relative space-y-5">
                      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                        <Upload className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-xl font-black">XLSX Data Entry</h3>
                        <p className="text-white/70 text-[12px] font-medium leading-relaxed">Ensure columns: Module, Set Number, Question Number, Question, Options A-D, Correct Answer.</p>
                      </div>
                      <label className="block w-full border-2 border-dashed border-white/30 p-8 rounded-[2rem] hover:bg-white/5 transition-colors cursor-pointer text-center group/label">
                        <input 
                          type="file" 
                          accept=".xlsx"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <div className="space-y-2">
                           <Database className="w-8 h-8 text-white/50 mx-auto" />
                           <p className="text-[13px] font-black group-hover/label:scale-110 transition-transform">TAP TO BROWSE FILES</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 space-y-4 shadow-sm">
                    <h4 className="font-black text-slate-900 text-[13px] uppercase tracking-widest flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                      Strict Validation
                    </h4>
                    <ul className="text-[12px] text-slate-400 space-y-2 font-medium">
                      <li>• Each set must have exactly 50 questions</li>
                      <li>• Module names must match core modules exactly</li>
                      <li>• Set Number must be between 1 and 50</li>
                    </ul>
                  </div>
                </div>
              )}

              {adminTab === 'manual' && (
                <form onSubmit={handleManualSubmit} className="space-y-5 pb-12">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${editingQuestionId ? 'bg-indigo-600 animate-pulse' : 'bg-green-600'}`} />
                      <h3 className="text-[14px] font-black text-slate-900 uppercase tracking-widest">
                        {editingQuestionId ? 'Edit Question' : 'Add Question'}
                      </h3>
                    </div>
                    {editingQuestionId && (
                      <button 
                        type="button"
                        onClick={() => {
                          setEditingQuestionId(null);
                          setManualQuestion({
                            module: MODULES[0],
                            setNumber: 1,
                            questionNumber: 1,
                            text: '',
                            options: { A: '', B: '', C: '', D: '' },
                            correctAnswer: 'A'
                          });
                        }}
                        className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-50 px-3 py-1 rounded-full flex items-center gap-1"
                      >
                        <XCircle className="w-3 h-3" />
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  {editingQuestionId && (
                    <div className="bg-indigo-600 p-4 rounded-2xl text-white shadow-lg shadow-indigo-100 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <Settings className="w-5 h-5" />
                         </div>
                         <div>
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-70">Editing Question</p>
                            <p className="text-[14px] font-bold truncate max-w-[180px]">{manualQuestion.text || 'Question Content'}</p>
                         </div>
                       </div>
                       <button onClick={() => setView('browse')} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-all" title="Back to Bank">
                          <Search className="w-4 h-4" />
                       </button>
                    </div>
                  )}
                  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2 space-y-1.5">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Subject</label>
                        <select 
                          value={manualQuestion.module}
                          onChange={(e) => setManualQuestion({ ...manualQuestion, module: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-[14px] font-bold outline-none focus:ring-2 focus:ring-primary/5"
                        >
                          {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Set</label>
                        <input 
                          type="number"
                          min="1"
                          max="50"
                          value={manualQuestion.setNumber || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setManualQuestion({ ...manualQuestion, setNumber: isNaN(val) ? 1 : val });
                          }}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-[14px] font-bold outline-none"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Question No</label>
                        <input 
                          type="number"
                          value={manualQuestion.questionNumber || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setManualQuestion({ ...manualQuestion, questionNumber: isNaN(val) ? 0 : val });
                          }}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-[14px] font-bold outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Question Text</label>
                      <textarea
                        rows={3}
                        value={manualQuestion.text}
                        onChange={(e) => setManualQuestion({ ...manualQuestion, text: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-[14px] font-bold outline-none resize-none"
                        placeholder="Type question here..."
                      />
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                    {(['A', 'B', 'C', 'D'] as const).map(opt => (
                      <div key={opt} className="space-y-1.5 text-left">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Option {opt}</label>
                        <input 
                          type="text"
                          value={manualQuestion.options[opt]}
                          onChange={(e) => setManualQuestion({ 
                            ...manualQuestion, 
                            options: { ...manualQuestion.options, [opt]: e.target.value } 
                          })}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-[14px] font-bold outline-none"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Correct Answer (Key)</label>
                      <select
                        value={manualQuestion.correctAnswer}
                        onChange={(e) => setManualQuestion({ ...manualQuestion, correctAnswer: e.target.value as any })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-[14px] font-bold outline-none focus:ring-2 focus:ring-primary/10 transition-all appearance-none cursor-pointer"
                      >
                        <option value="A">Option A</option>
                        <option value="B">Option B</option>
                        <option value="C">Option C</option>
                        <option value="D">Option D</option>
                      </select>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={loading}
                    className={`w-full h-14 text-white rounded-2xl font-black text-[15px] shadow-xl flex items-center justify-center gap-2 transition-all ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'} ${editingQuestionId ? 'bg-indigo-600 shadow-indigo-100' : 'bg-green-600 shadow-green-100'}`}
                  >
                    {loading ? (
                      <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        {editingQuestionId ? 'CONFIRM CHANGES' : 'SAVE QUESTION'}
                      </>
                    )}
                  </button>
                </form>
              )}

              {adminTab === 'notes' && (
                <div className="space-y-5 pb-12">
                   <div className="bg-white p-6 rounded-[3rem] border border-slate-100 shadow-sm space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Select Module</label>
                        <select 
                          value={noteEditModule}
                          onChange={async (e) => {
                            const mod = e.target.value;
                            setNoteEditModule(mod);
                            const n = await getModuleNote(mod);
                            setNoteEditContent(n?.content || '');
                            setNoteEditPdfUrl(n?.pdfUrl || '');
                          }}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-[14px] font-bold outline-none"
                        >
                          {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">PDF URL (Direct Link to PDF)</label>
                        <input 
                          type="url"
                          value={noteEditPdfUrl}
                          onChange={(e) => setNoteEditPdfUrl(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-[14px] font-bold outline-none"
                          placeholder="https://example.com/study-material.pdf"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Notes Content (Markdown Supported)</label>
                        <textarea
                          rows={12}
                          value={noteEditContent}
                          onChange={(e) => setNoteEditContent(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-[14px] font-bold outline-none resize-none"
                          placeholder="Type module notes here..."
                        />
                      </div>
                      <button 
                        onClick={handleNoteSave}
                        className="w-full h-14 bg-indigo-600 text-white rounded-2xl font-black text-[15px] shadow-xl shadow-indigo-100 flex items-center justify-center gap-2"
                      >
                        <BookOpen className="w-5 h-5" />
                        SAVE MODULE NOTES
                      </button>
                   </div>
                </div>
              )}

              {adminTab === 'manage' && (
                <div className="space-y-6 pb-12">
                   {/* Manage Filters */}
                   <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Module</label>
                          <select 
                            value={manageModule}
                            onChange={(e) => {
                              setManageModule(e.target.value);
                              setManageSet(null); // Reset set when changing module
                            }}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-[14px] font-bold outline-none"
                          >
                            {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Set Number</label>
                          <select 
                            value={manageSet || ''}
                            onChange={(e) => setManageSet(e.target.value ? parseInt(e.target.value) : null)}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-[14px] font-bold outline-none"
                          >
                            <option value="">All Sets</option>
                            {Array.from(new Set(questions.filter(q => q.module === manageModule).map(q => q.setNumber)))
                              .sort((a, b) => a - b)
                              .map(num => <option key={num} value={num}>Set {num}</option>)
                            }
                          </select>
                        </div>
                      </div>
                   </div>

                   <div className="space-y-8">
                     {(() => {
                        const modQs = questions.filter(q => q.module === manageModule);
                        const modSets = Array.from(new Set(modQs.map(q => q.setNumber)))
                          .sort((a, b) => a - b)
                          .filter(num => manageSet === null || num === manageSet);

                        if (modSets.length === 0) {
                          return (
                            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                               <Database className="w-12 h-12 text-slate-100" />
                               <p className="text-slate-400 text-sm font-medium">No questions found for this selection.</p>
                            </div>
                          );
                        }

                        return modSets.map(setNum => {
                          const setQs = modQs.filter(q => q.setNumber === setNum).sort((a, b) => (a.questionNumber || 0) - (b.questionNumber || 0));
                          return (
                            <div key={setNum} className="space-y-4">
                              <div className="flex items-center justify-between px-2">
                                <div className="flex items-center gap-3">
                                  <div className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                                  <h3 className="text-[15px] font-black text-slate-900 uppercase tracking-widest">{manageModule} | Set {setNum}</h3>
                                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full uppercase tracking-tighter">{setQs.length} Questions</span>
                                </div>
                                <button 
                                  onClick={async () => {
                                    if (!auth.currentUser) {
                                      showToast("Authentication required.", "error");
                                      signInWithGoogle();
                                      return;
                                    }
                                    
                                    if (purgingSetNum !== setNum) {
                                      setPurgingSetNum(setNum);
                                      setTimeout(() => setPurgingSetNum(null), 3000);
                                      return;
                                    }

                                    setLoading(true);
                                    try {
                                      await deleteSet(manageModule, setNum);
                                      showToast(`${manageModule} Set ${setNum} deleted.`, "success");
                                      setPurgingSetNum(null);
                                      await fetchQuestions();
                                    } catch (err: any) {
                                      showToast(err.message || "Failed to purge set", "error");
                                    } finally {
                                      setLoading(false);
                                    }
                                  }}
                                  className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1 transition-all px-3 py-1 rounded-full ${purgingSetNum === setNum ? 'bg-red-500 text-white animate-pulse' : 'text-red-400 hover:text-red-500'}`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                  {purgingSetNum === setNum ? 'Confirm Purge?' : 'Purge Set'}
                                </button>
                              </div>
                              <div className="grid gap-3">
                                {setQs.map(q => (
                                  <QuestionRow 
                                    key={q.id} 
                                    q={q} 
                                    onEdit={handleEditQuestion}
                                    onRemove={handleRemoveQuestion}
                                    isDeleting={deletingId === q.id}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        });
                     })()}
                   </div>
                </div>
              )}

              <div className="pt-4">
                <button 
                  onClick={() => setView('home')}
                  className="w-full text-gray-400 text-xs font-bold uppercase tracking-widest py-4 border border-dashed border-gray-200 rounded-2xl hover:border-blue-200 hover:text-blue-400 transition-all"
                >
                  Exit Admin Mode
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 bg-slate-100 rounded-full" />
    </main>

      {/* Persistent Bottom Tab (Conditional) */}
      {(view === 'home' || view === 'admin') && (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-xl border border-gray-100 py-3 px-8 rounded-full shadow-2xl flex gap-8 z-50">
          <button onClick={() => setView('home')} className={`transition-colors ${view === 'home' ? 'text-blue-600' : 'text-gray-400'}`}>
            <Play className="w-6 h-6" />
          </button>
          <button onClick={() => setView('admin')} className={`transition-colors ${view === 'admin' ? 'text-blue-600' : 'text-gray-400'}`}>
            <Settings className="w-6 h-6" />
          </button>
          {user && (
             <div className="w-6 h-6 rounded-full overflow-hidden border-2 border-gray-100">
               {user.photoURL ? <img src={user.photoURL} referrerPolicy="no-referrer" /> : <User className="text-gray-400 p-1" />}
             </div>
          )}
        </nav>
      )}

      {loading && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[100] flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
}
