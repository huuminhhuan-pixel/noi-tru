// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInAnonymously,
  signOut,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  getStorage, 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';

import {
  Calendar, BookOpen, CheckCircle2, Circle, Plus, Trash2, ChevronLeft,
  ChevronRight, LayoutList, CalendarDays, Target, BrainCircuit, Dna,
  Microscope, Stethoscope, Activity, Sparkles, X, Loader2, Paperclip,
  ArrowLeft, Cloud, AlertCircle, Bell, FileText, Edit2, LogOut
} from 'lucide-react';

// --- CẤU HÌNH FIREBASE (ĐÁM MÂY) ---
const rawConfig = typeof __firebase_config !== 'undefined' ? __firebase_config : null;
const firebaseConfig = {
  apiKey: "AIzaSyDmyno516slYBrEGombfm3Uf1xURP6MgFY",
  authDomain: "minh-5e426.firebaseapp.com",
  projectId: "minh-5e426",
  storageBucket: "minh-5e426.firebasestorage.app",
  messagingSenderId: "1099236716330",
  appId: "1:1099236716330:web:310556379821475993b853",
  measurementId: "G-21C38Y6V7R"
};
let app, auth, db, storage;
const isFirebaseConfigured = firebaseConfig.apiKey !== "YOUR_FIREBASE_API_KEY";

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  } catch (error) {
    console.error("Firebase init error:", error);
  }
}
const appId = typeof __app_id !== 'undefined' ? __app_id : 'medtrack-app';


// --- TIỆN ÍCH XỬ LÝ NGÀY THÁNG ---
const getTodayString = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

const formatDateObj = (date) => {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();


// --- THUẬT TOÁN LÊN KẾ HOẠCH KHOA HỌC (Bắt đầu 03/04/2026 - T8 Tổng Ôn 160 suất) ---
const EXAM_DATE = new Date('2026-09-01');
const SUBJECTS = [
  { name: 'Hoá sinh', icon: Microscope, color: 'text-emerald-500' },
  { name: 'Giải phẫu', icon: Stethoscope, color: 'text-rose-500' },
  { name: 'Sinh lý', icon: Activity, color: 'text-blue-500' },
  { name: 'Di truyền', icon: Dna, color: 'text-purple-500' },
];
const LESSONS_PER_SUBJECT = 20;

const generateBalancedStudyPlan = () => {
  const generatedItems = [];
  const generatedEvents = [];

  // CHỈNH SỬA: Lịch bắt đầu cứng từ ngày 03/04/2026 (Tháng đếm từ 0 nên 3 là tháng 4)
  const startDate = new Date(2026, 3, 3); 
  
  const endLearningDate = new Date('2026-08-05');
  if (startDate >= endLearningDate) {
    endLearningDate.setDate(EXAM_DATE.getDate() - 15);
  }

  const totalDaysForNewLessons = Math.max(1, Math.floor((endLearningDate - startDate) / (1000 * 60 * 60 * 24)));
  const totalLessons = LESSONS_PER_SUBJECT * SUBJECTS.length;

  let lessonCounter = 0;
  const allLessonsInfo = []; 

  for (let lesson = 1; lesson <= LESSONS_PER_SUBJECT; lesson++) {
    for (const subject of SUBJECTS) {
      const itemId = `med_${subject.name}_${lesson}`;
      const title = `Bài ${lesson}`;

      generatedItems.push({
        id: itemId,
        title: title,
        subject: subject.name,
        createdAt: getTodayString(),
      });

      const daysOffset = Math.floor((lessonCounter / totalLessons) * totalDaysForNewLessons);
      const learnDate = new Date(startDate);
      learnDate.setDate(startDate.getDate() + daysOffset);

      generatedEvents.push({
        id: `ev_learn_${itemId}`,
        date: formatDateObj(learnDate),
        title: `Học mới: ${subject.name} - ${title}`,
        subject: subject.name,
        studyItemId: itemId,
        completed: false,
        type: 'learn',
      });

      const spacedIntervals = [1, 3, 7, 14, 30, 50];
      const startSprintDate = new Date('2026-08-01'); 
      
      spacedIntervals.forEach((interval, idx) => {
        const revDate = new Date(learnDate);
        revDate.setDate(revDate.getDate() + interval);

        if (revDate < startSprintDate && revDate < EXAM_DATE) {
          generatedEvents.push({
            id: `ev_rev_${itemId}_${idx}`,
            date: formatDateObj(revDate),
            title: `Ôn lần ${idx + 1}: ${subject.name} - ${title}`,
            subject: subject.name,
            studyItemId: itemId,
            completed: false,
            type: 'review',
          });
        }
      });

      allLessonsInfo.push({ itemId, subject: subject.name, title });
      lessonCounter++;
    }
  }

  const sprintStartDate = new Date('2026-08-01');
  const sprintEndDate = new Date('2026-08-31');
  const sprintDaysCount = Math.round((sprintEndDate - sprintStartDate) / (1000 * 60 * 60 * 24)) + 1; 
  const totalSprintSlots = 160; 

  let sprintPool = [...allLessonsInfo, ...allLessonsInfo];

  let poolIndex = 0;
  for (let i = 0; i < sprintDaysCount; i++) {
    const currentDate = new Date(sprintStartDate);
    currentDate.setDate(sprintStartDate.getDate() + i);
    const dateStr = formatDateObj(currentDate);

    const itemsToday = Math.floor((i + 1) * totalSprintSlots / sprintDaysCount) - Math.floor(i * totalSprintSlots / sprintDaysCount);

    for (let j = 0; j < itemsToday; j++) {
      const lesson = sprintPool[poolIndex];
      generatedEvents.push({
        id: `ev_rev_sprint_${lesson.itemId}_${i}_${j}`,
        date: dateStr,
        title: `🔥 TỔNG ÔN: ${lesson.subject} - ${lesson.title}`,
        subject: lesson.subject,
        studyItemId: lesson.itemId,
        completed: false,
        type: 'review',
      });
      poolIndex++;
    }
  }

  return { items: generatedItems, events: generatedEvents };
};


export default function App() {
  const [activeTab, setActiveTab] = useState('calendar');
  const [studyItems, setStudyItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [upcomingFilter, setUpcomingFilter] = useState('today');
  
  // Trạng thái lưu ngày đang được click trên Lịch để mở popup
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(null);

  const [newItemTitle, setNewItemTitle] = useState('');
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [subjectNewItemTitle, setSubjectNewItemTitle] = useState('');
  const [editingItemId, setEditingItemId] = useState(null);
  const [editingItemTitle, setEditingItemTitle] = useState('');

  const [uploadingFileId, setUploadingFileId] = useState(null); 

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiCurrentTask, setAiCurrentTask] = useState(null);
  const [aiContent, setAiContent] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setAuthLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        }
      } catch (e) {
        console.error("Auth Token Error:", e);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;

    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'studyData', 'main');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setStudyItems(data.items || []);
        setEvents(data.events || []);
        setIsDataLoaded(true);
      } else {
        const { items, events } = generateBalancedStudyPlan();
        setDoc(docRef, { items, events }).catch(e => console.error("Lỗi tạo plan:", e));
      }
    }, (error) => {
      console.error("Lỗi tải dữ liệu:", error);
      setErrorMessage('Không thể đồng bộ dữ liệu lúc này.');
    });

    return () => unsubscribe();
  }, [user]);

  const updateCloudData = async (newItems, newEvents) => {
    setStudyItems(newItems);
    setEvents(newEvents);
    
    if (user && db) {
      try {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'studyData', 'main');
        await setDoc(docRef, { items: newItems, events: newEvents });
      } catch (e) {
        console.error("Lỗi đồng bộ:", e);
        setErrorMessage('Lỗi đồng bộ! Vui lòng kiểm tra mạng.');
      }
    }
  };

  const handleAddStudyItem = (e) => {
    e.preventDefault();
    if (!newItemTitle.trim()) return;

    const newItemId = Date.now().toString();
    const todayStr = getTodayString();

    const newItem = { id: newItemId, title: newItemTitle, subject: 'Khác', createdAt: todayStr, attachments: [] };
    const newItemsList = [...studyItems, newItem];

    const newEvents = [
      { id: `ev_${Date.now()}_start`, date: todayStr, title: `Học mới: ${newItemTitle}`, subject: 'Khác', studyItemId: newItemId, completed: false, type: 'learn' },
    ];

    updateCloudData(newItemsList, [...events, ...newEvents]);
    setNewItemTitle('');
    setActiveTab('today');
  };

  const handleAddSubjectItem = (e, subjectName) => {
    e.preventDefault();
    if (!subjectNewItemTitle.trim()) return;

    const newItemId = Date.now().toString();
    const todayStr = getTodayString();

    const newItem = { id: newItemId, title: subjectNewItemTitle, subject: subjectName, createdAt: todayStr, attachments: [] };
    const newItemsList = [...studyItems, newItem];

    const newEvents = [
      { id: `ev_${Date.now()}_start`, date: todayStr, title: `Học mới: ${subjectName} - ${subjectNewItemTitle}`, subject: subjectName, studyItemId: newItemId, completed: false, type: 'learn' },
    ];

    updateCloudData(newItemsList, [...events, ...newEvents]);
    setSubjectNewItemTitle('');
  };

  const handleFileUpload = async (itemId, e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!storage || !user) {
      setErrorMessage("Firebase Storage chưa được kết nối.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("Vui lòng chọn file dưới 10MB.");
      return;
    }

    try {
      setUploadingFileId(itemId); 
      const storageRef = ref(storage, `artifacts/${appId}/users/${user.uid}/files/${itemId}/${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      const newItems = studyItems.map((it) =>
        it.id === itemId
          ? { ...it, attachments: [...(it.attachments || []), { name: file.name, url: downloadURL }] }
          : it
      );
      await updateCloudData(newItems, events);
    } catch (error) {
      console.error("Lỗi khi tải file:", error);
      setErrorMessage("Không thể tải file. Hãy chắc chắn đã bật Rules trong mục Storage.");
    } finally {
      setUploadingFileId(null); 
      e.target.value = null; 
    }
  };

  const toggleEventCompletion = (eventId) => {
    const newEvents = events.map((ev) => ev.id === eventId ? { ...ev, completed: !ev.completed } : ev);
    updateCloudData(studyItems, newEvents);
  };

  const handleSaveEditItem = (itemId) => {
    if (!editingItemTitle.trim()) { setEditingItemId(null); return; }
    const oldItem = studyItems.find((it) => it.id === itemId);
    const oldTitle = oldItem.title;
    const newItems = studyItems.map((it) => it.id === itemId ? { ...it, title: editingItemTitle } : it);
    const newEvents = events.map((ev) => {
      if (ev.studyItemId === itemId) {
        return { ...ev, title: ev.title.replace(oldTitle, editingItemTitle) };
      }
      return ev;
    });
    updateCloudData(newItems, newEvents);
    setEditingItemId(null);
    setEditingItemTitle('');
  };

  const deleteStudyItem = (itemId) => {
    const newItems = studyItems.filter((item) => item.id !== itemId);
    const newEvents = events.filter((ev) => ev.studyItemId !== itemId);
    updateCloudData(newItems, newEvents);
  };

  const handleLoginGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e) {
      setErrorMessage("Không thể đăng nhập Google: " + e.message);
    }
  };

  const handleLoginAnonymous = async () => {
    try {
      await signInAnonymously(auth);
    } catch (e) {
      setErrorMessage("Không thể tạo tài khoản khách: " + e.message);
    }
  };

  const handleExportCalendar = () => {
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//MedTrack Pro//VN\nCALSCALE:GREGORIAN\n";

    events.forEach((ev) => {
      if (ev.completed) return; 
      const dateParts = ev.date.split('-'); 
      const yyyymmdd = dateParts.join('');

      icsContent += "BEGIN:VEVENT\n";
      icsContent += `DTSTART;VALUE=DATE:${yyyymmdd}\n`; 
      icsContent += `SUMMARY:${ev.title}\n`;
      icsContent += `DESCRIPTION:Nhiệm vụ ôn thi Y khoa: ${ev.subject}\n`;
      icsContent += "END:VEVENT\n";
    });

    icsContent += "END:VCALENDAR";

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Lich_MedTrack.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAskGemini = async (eventTask) => {
    setAiCurrentTask(eventTask);
    setAiModalOpen(true);
    setAiLoading(true);
    setAiContent('');

    const prompt = `Tôi đang ôn thi Y khoa. Môn học: ${eventTask.subject}, Chủ đề: ${eventTask.title} (Loại nhiệm vụ: ${eventTask.type === 'learn' ? 'Học mới' : 'Ôn tập'}).\n\nHãy đóng vai một giáo sư y khoa tận tâm và thực hiện 2 việc sau bằng tiếng Việt:\n1. Tóm tắt 3-4 điểm kiến thức cốt lõi (key takeaways) của chủ đề này một cách ngắn gọn, dễ nhớ.\n2. Đưa ra 1 câu hỏi trắc nghiệm (MCQ) mức độ khó để kiểm tra sự hiểu biết của tôi, kèm theo đáp án và giải thích chi tiết ở ngay bên dưới.`;

    const fetchWithBackoff = async (url, options, retries = 5, delay = 1000) => {
      try {
        const res = await fetch(url, options);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return await res.json();
      } catch (error) {
        if (retries === 0) throw error;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchWithBackoff(url, options, retries - 1, delay * 2);
      }
    };

    try {
      const apiKey = ''; // Gemini API Key
      const data = await fetchWithBackoff(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          systemInstruction: { parts: [{ text: 'Bạn là giáo sư Y khoa nhiệt tình. Trình bày ngắn gọn, dùng emoji hợp lý. Các phần quan trọng hãy in đậm bằng **nội dung**.' }] },
        })
      });
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Không thể tạo nội dung lúc này. Vui lòng thử lại.';
      setAiContent(text);
    } catch (error) {
      setAiContent('Hệ thống AI đang bận hoặc thiếu API Key. Vui lòng thử lại sau.');
    } finally {
      setAiLoading(false);
    }
  };

  const getSubjectColor = (subjectName) => {
    const subj = SUBJECTS.find((s) => s.name === subjectName);
    return subj ? subj.color : 'text-gray-600';
  };
  const getSubjectBg = (subjectName) => {
    const subj = SUBJECTS.find((s) => s.name === subjectName);
    return subj ? subj.color.replace('text-', 'bg-').replace('500', '100') : 'bg-gray-100';
  };

  // Hàm render chung cho 1 dòng nhiệm vụ (dùng ở cả tab Hôm nay và Modal Lịch)
  const renderEventItem = (event) => (
    <li key={event.id} className="p-4 hover:bg-gray-50 transition-colors flex items-start gap-3 cursor-pointer border-b border-gray-50 last:border-0" onClick={() => toggleEventCompletion(event.id)}>
      <button className="mt-0.5 focus:outline-none shrink-0">
        {event.completed ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <Circle className={`w-6 h-6 ${event.type === 'learn' ? 'text-gray-300 hover:text-blue-400' : 'text-gray-300 hover:text-purple-400'}`} />}
      </button>
      <div className={`flex-1 ${event.completed ? 'opacity-50 line-through' : ''}`}>
        <p className={`font-semibold ${event.type === 'learn' ? getSubjectColor(event.subject) : 'text-gray-800'}`}>{event.title}</p>
      </div>
      <button onClick={(e) => { e.stopPropagation(); handleAskGemini(event); }} className="ml-2 p-1.5 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold border border-amber-200 bg-amber-50" title="Tóm tắt & Trắc nghiệm với AI">
        <Sparkles className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Trợ giảng</span>
      </button>
    </li>
  );

  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
        <AlertCircle className="w-16 h-16 text-amber-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Chưa cấu hình Cơ Sở Dữ Liệu</h1>
        <p className="text-gray-600 max-w-md mb-6">
          Hệ thống lưu trữ đám mây chưa được thiết lập. Vui lòng nhập các khóa cấu hình Firebase của bạn vào.
        </p>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <p className="text-gray-500 font-medium">Đang kiểm tra tài khoản...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-[20%] right-[-10%] w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

        <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl border border-white/50 z-10 w-full max-w-md flex flex-col items-center text-center">
          <div className="bg-indigo-100 p-4 rounded-2xl mb-6 shadow-sm border border-indigo-50">
            <Stethoscope className="w-12 h-12 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-black text-gray-900 mb-3 tracking-tight">MedTrack <span className="text-indigo-600">Pro</span></h1>
          <p className="text-gray-500 mb-8 font-medium leading-relaxed">
            Nền tảng học thuật chuẩn y khoa. <br/>Tự động lập kế hoạch và đồng bộ dữ liệu của bạn trên đám mây.
          </p>

          <div className="w-full space-y-3">
            <button 
              onClick={handleLoginGoogle}
              className="w-full bg-white border-2 border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 text-gray-700 font-bold py-3.5 px-4 rounded-xl transition-all flex items-center justify-center gap-3 group"
            >
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Tiếp tục với Google
            </button>
            <button 
              onClick={handleLoginAnonymous}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-md hover:shadow-lg"
            >
              Học thử nghiệm (Tài khoản Khách)
            </button>
          </div>
        </div>
      </div>
    );
  }

  const renderToday = () => {
    const todayStr = formatDateObj(new Date());
    let endDate = new Date();
    if (upcomingFilter === '3days') endDate.setDate(endDate.getDate() + 2); 
    if (upcomingFilter === '7days') endDate.setDate(endDate.getDate() + 6); 
    const endDateStr = formatDateObj(endDate);

    const targetEvents = events.filter((ev) => ev.date >= todayStr && ev.date <= endDateStr);
    const totalEvents = targetEvents.length;
    const completedEvents = targetEvents.filter((ev) => ev.completed).length;
    const progress = totalEvents > 0 ? Math.round((completedEvents / totalEvents) * 100) : 0;

    const groupedEvents = targetEvents.reduce((acc, ev) => {
      if (!acc[ev.date]) acc[ev.date] = [];
      acc[ev.date].push(ev);
      return acc;
    }, {});

    const dates = Object.keys(groupedEvents).sort();
    const headerTitle = upcomingFilter === 'today' ? 'Mục tiêu Hôm nay' : `Mục tiêu ${upcomingFilter === '3days' ? '3' : '7'} ngày tới`;

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <header className="mb-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Target className="text-red-500" /> {headerTitle}
            </h2>
            <button 
              onClick={handleExportCalendar} 
              className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
              title="Thêm lịch học vào ứng dụng Lịch trên máy để nhận chuông báo"
            >
              <Bell className="w-4 h-4" /> Bật nhắc nhở
            </button>
          </div>

          <div className="flex bg-gray-100/80 p-1 rounded-xl mb-4 w-full sm:w-max border border-gray-200/60 shadow-sm">
            <button onClick={() => setUpcomingFilter('today')} className={`flex-1 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${upcomingFilter === 'today' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}>Hôm nay</button>
            <button onClick={() => setUpcomingFilter('3days')} className={`flex-1 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${upcomingFilter === '3days' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}>3 ngày tới</button>
            <button onClick={() => setUpcomingFilter('7days')} className={`flex-1 sm:px-6 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${upcomingFilter === '7days' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'}`}>7 ngày tới</button>
          </div>

          {totalEvents > 0 && (
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
              <div className="flex justify-between text-sm mb-2 font-medium">
                <span className="text-gray-600">Tiến độ ({completedEvents}/{totalEvents} nhiệm vụ):</span>
                <span className="text-blue-600">{progress}%</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </header>

        {totalEvents === 0 ? (
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-10 text-center">
            <h3 className="text-lg font-medium text-gray-800">Tuyệt vời!</h3>
            <p className="text-gray-500 mt-1">Bạn không có lịch học nào trong thời gian này.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {dates.map((date) => {
              const dayEvents = groupedEvents[date];
              dayEvents.sort((a, b) => {
                if (a.completed !== b.completed) return a.completed ? 1 : -1;
                if (a.type !== b.type) return a.type === 'learn' ? -1 : 1;
                return 0;
              });

              const learnEvents = dayEvents.filter((ev) => ev.type === 'learn');
              const reviewEvents = dayEvents.filter((ev) => ev.type === 'review');
              const isToday = date === todayStr;
              const dateObj = new Date(date);
              const dateLabel = isToday ? 'Hôm nay' : `${dateObj.toLocaleDateString('vi-VN', { weekday: 'long' })}, ${dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}`;

              return (
                <div key={date} className="relative">
                  {upcomingFilter !== 'today' && (
                    <h3 className="text-md font-bold text-gray-800 mb-3 flex items-center gap-2 border-b border-gray-200 pb-2">
                      <Calendar className="w-5 h-5 text-indigo-500" /> {dateLabel}
                      <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{dayEvents.length} việc</span>
                    </h3>
                  )}
                  <div className="space-y-4">
                    {learnEvents.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 pl-1 flex items-center gap-2"><BookOpen className="w-3.5 h-3.5" /> Kiến thức mới ({learnEvents.length})</h3>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                          <ul className="divide-y divide-gray-100">{learnEvents.map(renderEventItem)}</ul>
                        </div>
                      </div>
                    )}
                    {reviewEvents.length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 pl-1 flex items-center gap-2"><BrainCircuit className="w-3.5 h-3.5" /> Nhiệm vụ Ôn tập ({reviewEvents.length})</h3>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                          <ul className="divide-y divide-gray-100">{reviewEvents.map(renderEventItem)}</ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderCalendar = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    let firstDay = getFirstDayOfMonth(year, month);
    firstDay = firstDay === 0 ? 6 : firstDay - 1;

    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    const todayStr = formatDateObj(new Date());

    return (
      <div className="space-y-6 animate-in slide-in-from-left-4 duration-300">
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <CalendarDays className="text-indigo-500" /> Lịch Trình Ôn Thi
            </h2>
            <p className="text-sm text-gray-500 mt-1">Mục tiêu: Kì thi Y khoa 01/09/2026</p>
          </div>
          <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-100">
            <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ChevronLeft className="w-5 h-5 text-gray-600" /></button>
            <span className="font-bold text-lg min-w-[120px] text-center text-indigo-900">Tháng {month + 1}, {year}</span>
            <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 hover:bg-gray-100 rounded-full transition-colors"><ChevronRight className="w-5 h-5 text-gray-600" /></button>
          </div>
        </header>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
            {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day) => (
              <div key={day} className="py-3 text-center text-sm font-bold text-gray-500">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-gray-200">
            {days.map((day, index) => {
              if (day === null) return <div key={`empty-${index}`} className="bg-gray-50 min-h-[120px]" />;

              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEvents = events.filter((ev) => ev.date === dateStr);
              const isToday = dateStr === todayStr;

              const learnEvs = dayEvents.filter((e) => e.type === 'learn');
              const reviewEvs = dayEvents.filter((e) => e.type === 'review');

              return (
                <div 
                  key={day} 
                  onClick={() => setSelectedCalendarDate(dateStr)} // THÊM TÍNH NĂNG CLICK VÀO NGÀY
                  className={`bg-white min-h-[120px] p-2 transition-colors cursor-pointer hover:bg-indigo-50/50 ${isToday ? 'bg-indigo-50 ring-2 ring-indigo-500 inset-0' : ''}`}
                >
                  <div className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mb-2 ${isToday ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-700'}`}>{day}</div>
                  <div className="space-y-1.5">
                    {learnEvs.map((ev) => (
                      <div key={ev.id} className={`text-[10px] sm:text-xs font-semibold truncate px-2 py-1 rounded-md shadow-sm ${ev.completed ? 'bg-gray-100 text-gray-400 line-through' : 'bg-blue-600 text-white'}`} title={ev.title}>🆕 {ev.title.split(':')[1]}</div>
                    ))}
                    {reviewEvs.length > 0 && (
                      <div className={`text-[10px] sm:text-xs font-medium px-2 py-1 rounded-md border ${reviewEvs.every((e) => e.completed) ? 'bg-gray-50 text-gray-400 border-gray-200 line-through' : 'bg-purple-50 text-purple-700 border-purple-200'}`}>🔄 {reviewEvs.length} bài ôn tập</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderStudyItems = () => {
    if (selectedSubject) {
      const subject = SUBJECTS.find((s) => s.name === selectedSubject);
      const Icon = subject.icon;
      const subjectItems = studyItems.filter((item) => item.subject === selectedSubject);

      return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
          <header className="mb-6">
            <button onClick={() => setSelectedSubject(null)} className="flex items-center gap-2 text-gray-500 hover:text-indigo-600 transition-colors mb-4 font-medium"><ArrowLeft className="w-5 h-5" /> Quay lại Tổng Quan</button>
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${getSubjectBg(subject.name)}`}><Icon className={`w-8 h-8 ${subject.color}`} /></div>
              <div><h2 className="text-3xl font-bold text-gray-800">{subject.name}</h2><p className="text-gray-500">Quản lý {subjectItems.length} bài học</p></div>
            </div>
          </header>

          <form onSubmit={(e) => handleAddSubjectItem(e, subject.name)} className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex gap-2 items-center">
            <div className="bg-gray-50 p-2 rounded-lg text-gray-400"><FileText className="w-5 h-5" /></div>
            <input type="text" placeholder={`Nhập tên bài mới cho ${subject.name}...`} className="flex-1 px-2 py-2 bg-transparent focus:outline-none font-medium" value={subjectNewItemTitle} onChange={(e) => setSubjectNewItemTitle(e.target.value)} />
            <button type="submit" className={`px-6 py-2 rounded-lg font-bold text-white transition-colors flex items-center gap-2 ${subject.color.replace('text-', 'bg-')} hover:opacity-90`}><Plus className="w-5 h-5" /> Thêm</button>
          </form>

          <div className="space-y-3">
            {subjectItems.length === 0 ? (
              <div className="text-center p-10 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">Chưa có bài học nào.</div>
            ) : (
              subjectItems.map((item, idx) => {
                const itemEvents = events.filter((ev) => ev.studyItemId === item.id);
                const progress = itemEvents.length > 0 ? Math.round((itemEvents.filter((ev) => ev.completed).length / itemEvents.length) * 100) : 0;
                
                return (
                  <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col hover:border-indigo-100 transition-colors">
                    <div className="flex sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        {editingItemId === item.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 w-6">#{idx + 1}</span>
                            <input type="text" className="font-bold text-gray-800 text-lg border-b-2 border-indigo-500 focus:outline-none bg-transparent w-full max-w-[250px]" value={editingItemTitle} onChange={(e) => setEditingItemTitle(e.target.value)} autoFocus onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEditItem(item.id); if (e.key === 'Escape') setEditingItemId(null); }} />
                            <button onClick={() => handleSaveEditItem(item.id)} className="text-green-500 hover:bg-green-50 p-1 rounded transition-colors" title="Lưu"><CheckCircle2 className="w-5 h-5" /></button>
                            <button onClick={() => setEditingItemId(null)} className="text-gray-400 hover:bg-gray-100 p-1 rounded transition-colors" title="Hủy"><X className="w-5 h-5" /></button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            <span className="text-xs font-bold text-gray-400 w-6">#{idx + 1}</span>
                            <h4 className="font-bold text-gray-800 text-lg">{item.title}</h4>
                            <button onClick={() => { setEditingItemId(item.id); setEditingItemTitle(item.title); }} className="p-1 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all md:opacity-0 md:group-hover:opacity-100"><Edit2 className="w-4 h-4" /></button>
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-3 max-w-xs">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${subject.color.replace('text-', 'bg-')} transition-all`} style={{ width: `${progress}%` }} /></div>
                          <span className="text-[10px] font-bold text-gray-400">{progress}%</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <label className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${uploadingFileId === item.id ? 'text-blue-500 bg-blue-50 cursor-wait' : 'text-gray-300 hover:text-blue-500 hover:bg-blue-50 cursor-pointer'}`} title="Đính kèm tài liệu lên đám mây">
                          {uploadingFileId === item.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <>
                              <Paperclip className="w-5 h-5" />
                              <input type="file" className="hidden" onChange={(e) => handleFileUpload(item.id, e)} disabled={uploadingFileId === item.id} />
                            </>
                          )}
                        </label>
                        <button onClick={() => deleteStudyItem(item.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Xoá bài học"><Trash2 className="w-5 h-5" /></button>
                      </div>
                    </div>

                    {item.attachments && item.attachments.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2 pt-3 border-t border-gray-50">
                        {item.attachments.map((att, i) => (
                          <a key={i} href={att.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-md flex items-center gap-1.5 transition-colors">
                            <Cloud className="w-3.5 h-3.5"/> <span className="max-w-[150px] truncate">{att.name}</span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <header className="mb-6 flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><LayoutList className="text-emerald-500" /> Tổng Quan Môn Học</h2>
            <p className="text-gray-500">Nhấn vào từng môn học để xem chi tiết.</p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SUBJECTS.map((subject) => {
            const subjectItems = studyItems.filter((item) => item.subject === subject.name);
            const subjectEvents = events.filter((ev) => ev.subject === subject.name);
            const progress = subjectEvents.length > 0 ? Math.round((subjectEvents.filter((ev) => ev.completed).length / subjectEvents.length) * 100) : 0;

            return (
              <div key={subject.name} onClick={() => setSelectedSubject(subject.name)} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col cursor-pointer transition-all hover:shadow-md hover:border-indigo-200 hover:-translate-y-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-3 rounded-xl ${getSubjectBg(subject.name)}`}><subject.icon className={`w-6 h-6 ${subject.color}`} /></div>
                  <div><h3 className="text-lg font-bold text-gray-800">{subject.name}</h3><p className="text-sm text-gray-500">{subjectItems.length} bài học</p></div>
                </div>
                <div className="mt-auto">
                  <div className="flex justify-between text-xs font-medium text-gray-500 mb-1.5"><span>Tiến độ hoàn thành:</span><span>{progress}%</span></div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden"><div className={`h-full ${subject.color.replace('text-', 'bg-')} transition-all duration-500`} style={{ width: `${progress}%` }} /></div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-10">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 pl-1">Thêm bài học ngoài chương trình</h3>
          <form onSubmit={handleAddStudyItem} className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 flex gap-2">
            <input type="text" placeholder="Nhập tên tài liệu/bài tập muốn học thêm..." className="flex-1 px-4 py-2 bg-transparent focus:outline-none" value={newItemTitle} onChange={(e) => setNewItemTitle(e.target.value)} />
            <button type="submit" className="bg-gray-900 hover:bg-black text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"><Plus className="w-5 h-5" /> Thêm</button>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-gray-900 pb-20 md:pb-0">
      {errorMessage && (
        <div className="fixed top-4 right-4 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-3 animate-in slide-in-from-top-4">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium text-sm">{errorMessage}</span>
          <button onClick={() => setErrorMessage('')}><X className="w-4 h-4 hover:text-red-200" /></button>
        </div>
      )}

      <div className="max-w-6xl mx-auto md:flex min-h-screen">
        <aside className="md:w-72 bg-white border-r border-gray-200 md:min-h-screen p-6 hidden md:flex flex-col">
          <div className="flex items-center gap-3 mb-10 text-indigo-700">
            <div className="bg-indigo-100 p-2 rounded-xl"><Stethoscope className="w-7 h-7" /></div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">MedTrack</h1>
              <p className="text-[10px] uppercase font-bold text-indigo-400 tracking-wider">Thi 01/09/2026</p>
            </div>
          </div>

          <nav className="space-y-2 flex-1">
            <button onClick={() => setActiveTab('calendar')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${activeTab === 'calendar' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}><Calendar className="w-5 h-5" /> Lịch Trình</button>
            <button onClick={() => setActiveTab('today')} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-colors ${activeTab === 'today' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}>
              <span className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5" /> Hôm nay</span>
              {events.filter((ev) => ev.date === formatDateObj(new Date()) && !ev.completed).length > 0 && <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{events.filter((ev) => ev.date === formatDateObj(new Date()) && !ev.completed).length}</span>}
            </button>
            <button onClick={() => setActiveTab('study')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${activeTab === 'study' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}><LayoutList className="w-5 h-5" /> Tổng Quan</button>
          </nav>

          <div className="mt-auto pt-6 border-t border-gray-100 space-y-4">
            <div className="bg-gray-50 p-4 rounded-xl flex items-center gap-3 border border-gray-200">
              <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-full flex items-center justify-center font-bold">
                {user.isAnonymous ? 'Kh' : user.displayName?.charAt(0) || 'U'}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-bold text-gray-800 truncate">{user.isAnonymous ? 'Tài khoản Khách' : user.displayName}</p>
                <p className="text-[10px] text-green-600 font-bold flex items-center gap-1"><Cloud className="w-3 h-3"/> Đã đồng bộ</p>
              </div>
              <button onClick={() => auth.signOut()} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Đăng xuất"><LogOut className="w-5 h-5" /></button>
            </div>
          </div>
        </aside>

        <header className="md:hidden bg-white px-6 py-4 flex items-center justify-between border-b border-gray-200 sticky top-0 z-10">
          <div className="flex items-center gap-2 text-indigo-700">
            <Stethoscope className="w-6 h-6" />
            <div><h1 className="text-lg font-bold leading-none">MedTrack</h1><span className="text-[10px] font-bold text-indigo-400">Thi 01/09/2026</span></div>
          </div>
          <button onClick={() => auth.signOut()} className="w-8 h-8 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center font-bold">
             {user.isAnonymous ? 'Kh' : user.displayName?.charAt(0) || 'U'}
          </button>
        </header>

        <main className="flex-1 p-4 md:p-10 max-h-screen overflow-y-auto relative">
          <div className="max-w-4xl mx-auto">
            {!isDataLoaded ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
                <p>Đang tải lộ trình học tập từ đám mây...</p>
              </div>
            ) : (
              <>
                {activeTab === 'today' && renderToday()}
                {activeTab === 'calendar' && renderCalendar()}
                {activeTab === 'study' && renderStudyItems()}
              </>
            )}
          </div>
        </main>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2 z-10 pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <button onClick={() => setActiveTab('calendar')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'calendar' ? 'text-indigo-600' : 'text-gray-400'}`}><Calendar className="w-6 h-6" /><span className="text-[10px] font-bold">Lịch</span></button>
          <button onClick={() => setActiveTab('today')} className={`flex flex-col items-center gap-1 p-2 relative ${activeTab === 'today' ? 'text-indigo-600' : 'text-gray-400'}`}><CheckCircle2 className="w-6 h-6" /><span className="text-[10px] font-bold">Hôm nay</span>{events.filter((ev) => ev.date === formatDateObj(new Date()) && !ev.completed).length > 0 && <span className="absolute top-1 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>}</button>
          <button onClick={() => setActiveTab('study')} className={`flex flex-col items-center gap-1 p-2 ${activeTab === 'study' ? 'text-indigo-600' : 'text-gray-400'}`}><LayoutList className="w-6 h-6" /><span className="text-[10px] font-bold">Tổng quan</span></button>
        </nav>

        {/* MODAL HIỂN THỊ CHI TIẾT NGÀY TRÊN LỊCH */}
        {selectedCalendarDate && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95">
              <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-indigo-500" />
                  Nhiệm vụ ngày {new Date(selectedCalendarDate).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </h3>
                <button onClick={() => setSelectedCalendarDate(null)} className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"><X className="w-5 h-5"/></button>
              </div>
              <div className="p-4 overflow-y-auto flex-1 bg-white">
                 {(() => {
                    const dayEvents = events.filter(ev => ev.date === selectedCalendarDate);
                    if (dayEvents.length === 0) return (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3"><Calendar className="w-8 h-8 text-gray-300" /></div>
                        <p className="text-gray-500 font-medium">Bạn không có lịch học nào trong ngày này.</p>
                      </div>
                    );

                    dayEvents.sort((a, b) => {
                      if (a.completed !== b.completed) return a.completed ? 1 : -1;
                      if (a.type !== b.type) return a.type === 'learn' ? -1 : 1;
                      return 0;
                    });

                    const learnEvents = dayEvents.filter((ev) => ev.type === 'learn');
                    const reviewEvents = dayEvents.filter((ev) => ev.type === 'review');

                    return (
                        <div className="space-y-6">
                            {learnEvents.length > 0 && (
                              <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 pl-1 flex items-center gap-2"><BookOpen className="w-3.5 h-3.5" /> Kiến thức mới</h4>
                                <ul className="border border-gray-100 rounded-xl divide-y divide-gray-50">{learnEvents.map(renderEventItem)}</ul>
                              </div>
                            )}
                            {reviewEvents.length > 0 && (
                              <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 pl-1 flex items-center gap-2"><BrainCircuit className="w-3.5 h-3.5" /> Nhiệm vụ ôn tập</h4>
                                <ul className="border border-gray-100 rounded-xl divide-y divide-gray-50">{reviewEvents.map(renderEventItem)}</ul>
                              </div>
                            )}
                        </div>
                    )
                 })()}
              </div>
            </div>
          </div>
        )}

        {aiModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-5 border-b border-orange-100 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50">
                <div className="flex items-center gap-3 text-amber-700">
                  <div className="p-2 bg-white rounded-xl shadow-sm"><Sparkles className="w-5 h-5 text-amber-500" /></div>
                  <h3 className="font-bold text-lg">Giáo sư AI </h3>
                </div>
                <button onClick={() => setAiModalOpen(false)} className="p-2 hover:bg-orange-100 rounded-full text-amber-700 transition-colors"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 bg-white">
                {aiLoading ? (
                  <div className="flex flex-col items-center justify-center h-48 text-amber-600 gap-4">
                    <Loader2 className="w-10 h-10 animate-spin" />
                    <p className="font-medium animate-pulse text-center">Đang soạn bài giảng cho <br /><span className="font-bold text-amber-800">{aiCurrentTask?.subject} - {aiCurrentTask?.title}</span>...</p>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap text-gray-700 leading-relaxed text-sm md:text-base font-medium">
                    {aiContent.split('**').map((part, i) => i % 2 === 1 ? <strong key={i} className="text-gray-900 bg-amber-50 px-1 rounded">{part}</strong> : part)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}