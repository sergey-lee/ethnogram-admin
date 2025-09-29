import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPhoneNumber,
  RecaptchaVerifier,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc,
  addDoc,
  getDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Users, FileText, Bell, LogOut, Trash2, Edit, Plus, X, Check, Phone, Search, Filter, TrendingUp, Calendar, Image as ImageIcon, Mail } from 'lucide-react';

const firebaseConfig = {
  apiKey: "AIzaSyDk4pU2oEaRpx_hajUzIVrzzpSR0GtcwMA",
  authDomain: "ethnogram-1cd0f.firebaseapp.com",
  projectId: "ethnogram-1cd0f",
  storageBucket: "ethnogram-1cd0f.appspot.com",
  messagingSenderId: "316785912727",
  appId: "1:316785912727:web:43818038dc12d5af3532d2",
  measurementId: "G-0L6Y649070"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

const POST_TYPES = {
  0: { label: 'Обычный', color: 'bg-blue-100 text-blue-700' },
  1: { label: 'VIP', color: 'bg-purple-100 text-purple-700' },
  2: { label: 'Премиум', color: 'bg-amber-100 text-amber-700' }
};

export default function AdminPanel() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [loginError, setLoginError] = useState('');
  const [loginStep, setLoginStep] = useState('phone');

  const [posts, setPosts] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [editingPost, setEditingPost] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [showAddPost, setShowAddPost] = useState(false);
  const [newPost, setNewPost] = useState({
    title: '',
    description: '',
    imageUrl: '',
    type: 0,
    authorPhone: '',
    postValidUntil: '',
    promotedUntil: ''
  });
  const [notification, setNotification] = useState({ title: '', message: '' });
  const [showNotificationForm, setShowNotificationForm] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists() && userDoc.data().isAdmin) {
          setIsAdmin(true);
          loadData();
        } else {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user && !loading) {
      setupRecaptcha();
    }
    return () => {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    };
  }, [user, loading]);

  const setupRecaptcha = () => {
    try {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
      }
      
      auth.settings.appVerificationDisabledForTesting = false;
      
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'normal',
        callback: (response) => {
          console.log('reCAPTCHA verified:', response);
        },
        'expired-callback': () => {
          console.log('reCAPTCHA expired');
          setupRecaptcha();
        }
      });
      
      window.recaptchaVerifier.render().then((widgetId) => {
        console.log('reCAPTCHA rendered with widget ID:', widgetId);
        window.recaptchaWidgetId = widgetId;
      }).catch((error) => {
        console.error('Error rendering reCAPTCHA:', error);
      });
    } catch (error) {
      console.error('Error setting up reCAPTCHA:', error);
    }
  };

  const loadData = async () => {
    try {
      const postsQuery = query(collection(db, 'posts'), orderBy('created', 'desc'));
      const postsSnapshot = await getDocs(postsQuery);
      setPosts(postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const usersSnapshot = await getDocs(collection(db, 'users'));
      setUsers(usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleSendCode = async () => {
    setLoginError('');
    
    if (!phoneNumber) {
      setLoginError('Введите номер телефона');
      return;
    }

    let formattedPhone = phoneNumber.trim().replace(/\s/g, '');
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+' + formattedPhone;
    }

    try {
      if (!window.recaptchaVerifier) {
        setupRecaptcha();
      }
      
      const appVerifier = window.recaptchaVerifier;
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(confirmation);
      setLoginStep('code');
      setLoginError('');
    } catch (error) {
      console.error('Error sending code:', error);
      
      let errorMessage = 'Ошибка отправки кода. ';
      
      if (error.code === 'auth/invalid-phone-number') {
        errorMessage = 'Неверный формат номера телефона. Используйте формат: +79991234567';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Слишком много попыток. Попробуйте позже.';
      } else if (error.code === 'auth/quota-exceeded') {
        errorMessage = 'Превышена квота SMS. Обратитесь к администратору.';
      } else if (error.code === 'auth/captcha-check-failed') {
        errorMessage = 'Ошибка проверки reCAPTCHA. Попробуйте обновить страницу.';
      } else {
        errorMessage += error.message;
      }
      
      setLoginError(errorMessage);
      
      setTimeout(() => {
        if (window.recaptchaVerifier) {
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = null;
        }
        setupRecaptcha();
      }, 1000);
    }
  };

  const handleVerifyCode = async () => {
    setLoginError('');
    
    if (!verificationCode) {
      setLoginError('Введите код подтверждения');
      return;
    }

    try {
      await confirmationResult.confirm(verificationCode);
    } catch (error) {
      console.error('Error verifying code:', error);
      setLoginError('Неверный код. Попробуйте снова.');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setLoginStep('phone');
    setPhoneNumber('');
    setVerificationCode('');
    setConfirmationResult(null);
  };

  const handleDeletePost = async (postId) => {
    if (window.confirm('Удалить этот пост?')) {
      await deleteDoc(doc(db, 'posts', postId));
      loadData();
    }
  };

  const handleUpdatePost = async (postId, updatedData) => {
    const dataToUpdate = {
      ...updatedData,
      updated: new Date()
    };
    await updateDoc(doc(db, 'posts', postId), dataToUpdate);
    setEditingPost(null);
    loadData();
  };

  const handleAddPost = async () => {
    if (!newPost.title || !newPost.description) {
      alert('Заполните обязательные поля: заголовок и описание');
      return;
    }
    
    const postData = {
      ...newPost,
      created: new Date(),
      updated: new Date(),
      authorId: user.uid,
      likeList: [],
      type: parseInt(newPost.type),
      postValidUntil: newPost.postValidUntil ? new Date(newPost.postValidUntil) : null,
      promotedUntil: newPost.promotedUntil ? new Date(newPost.promotedUntil) : null
    };
    
    await addDoc(collection(db, 'posts'), postData);
    setShowAddPost(false);
    setNewPost({
      title: '',
      description: '',
      imageUrl: '',
      type: 0,
      authorPhone: '',
      postValidUntil: '',
      promotedUntil: ''
    });
    loadData();
  };

  const handleUpdateUser = async (userId, updatedData) => {
    const dataToUpdate = {
      ...updatedData,
      updated: new Date()
    };
    await updateDoc(doc(db, 'users', userId), dataToUpdate);
    setEditingUser(null);
    loadData();
  };

  const handleToggleUserAdmin = async (userId, currentStatus) => {
    await updateDoc(doc(db, 'users', userId), {
      isAdmin: !currentStatus,
      updated: new Date()
    });
    loadData();
  };

  const handleSendNotification = async () => {
    if (!notification.title || !notification.message) {
      alert('Заполните все поля уведомления');
      return;
    }
    
    await addDoc(collection(db, 'notifications'), {
      title: notification.title,
      message: notification.message,
      createdAt: new Date(),
      sentBy: user.uid
    });
    
    setShowNotificationForm(false);
    setNotification({ title: '', message: '' });
    alert('Уведомление отправлено!');
  };

  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         post.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || post.type === parseInt(filterType);
    return matchesSearch && matchesType;
  });

  const filteredUsers = users.filter(user => 
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.surname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.phone?.includes(searchTerm) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Загрузка...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-5 rounded-2xl shadow-lg">
              <Phone size={36} className="text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2 text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Админ Панель
          </h1>
          <p className="text-slate-600 text-center mb-6">Вход по номеру телефона</p>
          
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-xl mb-4 border border-blue-100">
            <p className="text-sm font-semibold text-slate-700 mb-2">📋 Инструкция:</p>
            <ol className="text-xs text-slate-600 space-y-1 list-decimal list-inside">
              <li>Включите Phone Authentication в Firebase Console</li>
              <li>Добавьте тестовый номер или используйте реальный</li>
              <li>Для теста: +1 650-555-1234 (код: 123456)</li>
            </ol>
          </div>

          <div id="recaptcha-container" className="flex justify-center mb-4"></div>

          {loginStep === 'phone' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Номер телефона
                </label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+79991234567"
                  onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Пример: +7 999 123 45 67
                </p>
              </div>
              
              {loginError && (
                <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                  {loginError}
                </div>
              )}
              
              <button
                onClick={handleSendCode}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <Phone size={20} />
                Отправить код
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Код подтверждения
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="123456"
                  maxLength="6"
                  onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent text-center text-2xl tracking-widest font-bold"
                />
                <p className="text-xs text-slate-500 mt-2 text-center">
                  Код отправлен на {phoneNumber}
                </p>
              </div>
              
              {loginError && (
                <div className="bg-red-50 border-2 border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                  {loginError}
                </div>
              )}
              
              <button
                onClick={handleVerifyCode}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-xl font-semibold hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                <Check size={20} />
                Подтвердить
              </button>
              
              <button
                onClick={() => {
                  setLoginStep('phone');
                  setVerificationCode('');
                  setLoginError('');
                }}
                className="w-full text-slate-600 py-2 rounded-xl hover:bg-slate-100 transition"
              >
                Изменить номер
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center max-w-md">
          <div className="text-6xl mb-4">🚫</div>
          <h2 className="text-2xl font-bold text-red-600 mb-4">Доступ запрещен</h2>
          <p className="text-slate-600 mb-6">У вас нет прав администратора</p>
          <button
            onClick={handleLogout}
            className="bg-slate-600 text-white px-6 py-3 rounded-xl hover:bg-slate-700 transition"
          >
            Выйти
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-6">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold text-white mb-1">Админ Панель</h1>
                <p className="text-blue-100 text-sm">Управление контентом и пользователями</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 bg-white/20 backdrop-blur-sm hover:bg-white/30 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg"
              >
                <LogOut size={20} />
                Выйти
              </button>
            </div>
          </div>

          <div className="flex border-b bg-slate-50">
            <button
              onClick={() => setActiveTab('posts')}
              className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all relative ${
                activeTab === 'posts'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <FileText size={20} />
              Посты
              <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-xs font-bold">
                {posts.length}
              </span>
              {activeTab === 'posts' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-purple-600"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all relative ${
                activeTab === 'users'
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <Users size={20} />
              Пользователи
              <span className="bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full text-xs font-bold">
                {users.length}
              </span>
              {activeTab === 'users' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-600 to-pink-600"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex items-center gap-2 px-6 py-4 font-semibold transition-all relative ${
                activeTab === 'notifications'
                  ? 'bg-white text-pink-600 shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <Bell size={20} />
              Уведомления
              {activeTab === 'notifications' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-600 to-rose-600"></div>
              )}
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'posts' && (
              <div>
                <div className="mb-6 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <h2 className="text-2xl font-bold text-slate-800">Управление постами</h2>
                    <button
                      onClick={() => setShowAddPost(true)}
                      className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-5 py-2.5 rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl"
                    >
                      <Plus size={20} />
                      Добавить пост
                    </button>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                      <input
                        type="text"
                        placeholder="Поиск по названию или описанию..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-11 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      />
                    </div>
                    <div className="relative">
                      <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                      <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="pl-11 pr-8 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white transition cursor-pointer"
                      >
                        <option value="all">Все типы</option>
                        <option value="0">Обычный</option>
                        <option value="1">VIP</option>
                        <option value="2">Премиум</option>
                      </select>
                    </div>
                  </div>
                </div>

                {showAddPost && (
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-2xl mb-6 border-2 border-blue-100 shadow-lg">
                    <h3 className="text-xl font-bold mb-4 text-slate-800">Новый пост</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input
                        type="text"
                        placeholder="Заголовок *"
                        value={newPost.title}
                        onChange={(e) => setNewPost({ ...newPost, title: e.target.value })}
                        className="px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        placeholder="Телефон автора"
                        value={newPost.authorPhone}
                        onChange={(e) => setNewPost({ ...newPost, authorPhone: e.target.value })}
                        className="px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <textarea
                        placeholder="Описание *"
                        value={newPost.description}
                        onChange={(e) => setNewPost({ ...newPost, description: e.target.value })}
                        className="md:col-span-2 px-4 py-3 border-2 border-slate-200 rounded-xl h-32 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <input
                        type="text"
                        placeholder="URL изображения"
                        value={newPost.imageUrl}
                        onChange={(e) => setNewPost({ ...newPost, imageUrl: e.target.value })}
                        className="md:col-span-2 px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <select
                        value={newPost.type}
                        onChange={(e) => setNewPost({ ...newPost, type: e.target.value })}
                        className="px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="0">Обычный</option>
                        <option value="1">VIP</option>
                        <option value="2">Премиум</option>
                      </select>
                      <input
                        type="datetime-local"
                        placeholder="Действителен до"
                        value={newPost.postValidUntil}
                        onChange={(e) => setNewPost({ ...newPost, postValidUntil: e.target.value })}
                        className="px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <input
                        type="datetime-local"
                        placeholder="Продвигается до"
                        value={newPost.promotedUntil}
                        onChange={(e) => setNewPost({ ...newPost, promotedUntil: e.target.value })}
                        className="md:col-span-2 px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <div className="flex gap-3 mt-4">
                      <button
                        onClick={handleAddPost}
                        className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-3 rounded-xl hover:from-green-700 hover:to-emerald-700 transition shadow-lg"
                      >
                        <Check size={18} />
                        Создать
                      </button>
                      <button
                        onClick={() => setShowAddPost(false)}
                        className="flex items-center gap-2 bg-slate-400 text-white px-6 py-3 rounded-xl hover:bg-slate-500 transition"
                      >
                        <X size={18} />
                        Отмена
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid gap-4">
                  {filteredPosts.map((post) => (
                    <div key={post.id} className="bg-white border-2 border-slate-200 rounded-2xl p-6 hover:shadow-xl transition-all hover:border-blue-200">
                      {editingPost?.id === post.id ? (
                        <div className="space-y-4">
                          <input
                            type="text"
                            value={editingPost.title}
                            onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })}
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl font-semibold"
                          />
                          <textarea
                            value={editingPost.description}
                            onChange={(e) => setEditingPost({ ...editingPost, description: e.target.value })}
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl h-24"
                          />
                          <input
                            type="text"
                            placeholder="URL изображения"
                            value={editingPost.imageUrl || ''}
                            onChange={(e) => setEditingPost({ ...editingPost, imageUrl: e.target.value })}
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl"
                          />
                          <input
                            type="text"
                            placeholder="Телефон автора"
                            value={editingPost.authorPhone || ''}
                            onChange={(e) => setEditingPost({ ...editingPost, authorPhone: e.target.value })}
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl"
                          />
                          <select
                            value={editingPost.type}
                            onChange={(e) => setEditingPost({ ...editingPost, type: parseInt(e.target.value) })}
                            className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl"
                          >
                            <option value="0">Обычный</option>
                            <option value="1">VIP</option>
                            <option value="2">Премиум</option>
                          </select>
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleUpdatePost(post.id, editingPost)}
                              className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-5 py-2.5 rounded-xl hover:from-green-700 hover:to-emerald-700 transition shadow-lg"
                            >
                              <Check size={18} />
                              Сохранить
                            </button>
                            <button
                              onClick={() => setEditingPost(null)}
                              className="flex items-center gap-2 bg-slate-400 text-white px-5 py-2.5 rounded-xl hover:bg-slate-500 transition"
                            >
                              <X size={18} />
                              Отмена
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-xl font-bold text-slate-800">{post.title}</h3>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${POST_TYPES[post.type]?.color || POST_TYPES[0].color}`}>
                                  {POST_TYPES[post.type]?.label || POST_TYPES[0].label}
                                </span>
                              </div>
                              <p className="text-slate-600 mb-3">{post.description}</p>
                              {post.imageUrl && (
                                <div className="mb-3 flex items-center gap-2 text-sm text-blue-600">
                                  <ImageIcon size={16} />
                                  <a href={post.imageUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                                    Посмотреть изображение
                                  </a>
                                </div>
                              )}
                              <div className="flex flex-wrap gap-3 text-sm text-slate-500">
                                {post.authorPhone && (
                                  <span className="flex items-center gap-1">
                                    <Phone size={14} />
                                    {post.authorPhone}
                                  </span>
                                )}
                                {post.created && (
                                  <span className="flex items-center gap-1">
                                    <Calendar size={14} />
                                    {new Date(post.created.seconds * 1000).toLocaleDateString('ru-RU')}
                                  </span>
                                )}
                                {post.likeList && post.likeList.length > 0 && (
                                  <span className="flex items-center gap-1 text-red-500">
                                    ❤️ {post.likeList.length}
                                  </span>
                                )}
                              </div>
                              {post.promotedUntil && (
                                <div className="mt-2 inline-flex items-center gap-2 bg-amber-50 text-amber-700 px-3 py-1 rounded-lg text-xs font-semibold">
                                  <TrendingUp size={14} />
                                  Продвигается
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={() => setEditingPost(post)}
                              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl hover:from-blue-700 hover:to-purple-700 transition shadow-md"
                            >
                              <Edit size={18} />
                              Редактировать
                            </button>
                            <button
                              onClick={() => handleDeletePost(post.id)}
                              className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-rose-600 text-white px-4 py-2 rounded-xl hover:from-red-700 hover:to-rose-700 transition shadow-md"
                            >
                              <Trash2 size={18} />
                              Удалить
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {filteredPosts.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                      <FileText size={48} className="mx-auto mb-3 opacity-30" />
                      <p>Посты не найдены</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-slate-800 mb-4">Управление пользователями</h2>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
                    <input
                      type="text"
                      placeholder="Поиск по имени, телефону или email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                    />
                  </div>
                </div>
                
                <div className="grid gap-4">
                  {filteredUsers.map((u) => (
                    <div key={u.id} className="bg-white border-2 border-slate-200 rounded-2xl p-6 hover:shadow-xl transition-all hover:border-purple-200">
                      {editingUser?.id === u.id ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <input
                              type="text"
                              placeholder="Имя"
                              value={editingUser.name || ''}
                              onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                              className="px-4 py-3 border-2 border-slate-200 rounded-xl"
                            />
                            <input
                              type="text"
                              placeholder="Фамилия"
                              value={editingUser.surname || ''}
                              onChange={(e) => setEditingUser({ ...editingUser, surname: e.target.value })}
                              className="px-4 py-3 border-2 border-slate-200 rounded-xl"
                            />
                            <input
                              type="tel"
                              placeholder="Телефон"
                              value={editingUser.phone || ''}
                              onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                              className="px-4 py-3 border-2 border-slate-200 rounded-xl"
                            />
                            <input
                              type="text"
                              placeholder="Instagram"
                              value={editingUser.instagram || ''}
                              onChange={(e) => setEditingUser({ ...editingUser, instagram: e.target.value })}
                              className="px-4 py-3 border-2 border-slate-200 rounded-xl"
                            />
                            <input
                              type="text"
                              placeholder="Telegram"
                              value={editingUser.telegram || ''}
                              onChange={(e) => setEditingUser({ ...editingUser, telegram: e.target.value })}
                              className="px-4 py-3 border-2 border-slate-200 rounded-xl"
                            />
                            <input
                              type="text"
                              placeholder="WhatsApp"
                              value={editingUser.whatsApp || ''}
                              onChange={(e) => setEditingUser({ ...editingUser, whatsApp: e.target.value })}
                              className="px-4 py-3 border-2 border-slate-200 rounded-xl"
                            />
                            <textarea
                              placeholder="Био"
                              value={editingUser.bio || ''}
                              onChange={(e) => setEditingUser({ ...editingUser, bio: e.target.value })}
                              className="md:col-span-2 px-4 py-3 border-2 border-slate-200 rounded-xl h-24"
                            />
                            <input
                              type="text"
                              placeholder="URL изображения"
                              value={editingUser.image || ''}
                              onChange={(e) => setEditingUser({ ...editingUser, image: e.target.value })}
                              className="md:col-span-2 px-4 py-3 border-2 border-slate-200 rounded-xl"
                            />
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={editingUser.isPublic || false}
                                onChange={(e) => setEditingUser({ ...editingUser, isPublic: e.target.checked })}
                                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                              />
                              <label className="text-sm font-medium text-slate-700">Публичный профиль</label>
                            </div>
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={editingUser.phoneIsAvailable || false}
                                onChange={(e) => setEditingUser({ ...editingUser, phoneIsAvailable: e.target.checked })}
                                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                              />
                              <label className="text-sm font-medium text-slate-700">Телефон доступен</label>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleUpdateUser(u.id, editingUser)}
                              className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-5 py-2.5 rounded-xl hover:from-green-700 hover:to-emerald-700 transition shadow-lg"
                            >
                              <Check size={18} />
                              Сохранить
                            </button>
                            <button
                              onClick={() => setEditingUser(null)}
                              className="flex items-center gap-2 bg-slate-400 text-white px-5 py-2.5 rounded-xl hover:bg-slate-500 transition"
                            >
                              <X size={18} />
                              Отмена
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-start justify-between">
                            <div className="flex gap-4 flex-1">
                              {u.image && (
                                <img src={u.image} alt={u.name} className="w-16 h-16 rounded-full object-cover border-2 border-slate-200" />
                              )}
                              <div className="flex-1">
                                <h3 className="text-xl font-bold text-slate-800 mb-1">
                                  {u.name || 'Без имени'} {u.surname || ''}
                                </h3>
                                {u.bio && (
                                  <p className="text-sm text-slate-600 mb-2">{u.bio}</p>
                                )}
                                <div className="flex flex-wrap gap-3 text-sm text-slate-500 mb-3">
                                  {u.phone && (
                                    <span className="flex items-center gap-1">
                                      <Phone size={14} />
                                      {u.phone}
                                    </span>
                                  )}
                                  {u.instagram && (
                                    <span className="text-pink-600">@{u.instagram}</span>
                                  )}
                                  {u.telegram && (
                                    <span className="text-blue-600">TG: {u.telegram}</span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${u.isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}`}>
                                    {u.isAdmin ? '👑 Администратор' : '👤 Пользователь'}
                                  </span>
                                  {u.isPublic && (
                                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                                      🌐 Публичный
                                    </span>
                                  )}
                                  {u.likes && u.likes.length > 0 && (
                                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                                      ❤️ {u.likes.length} лайков
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-3 mt-4">
                            <button
                              onClick={() => setEditingUser(u)}
                              className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-xl hover:from-blue-700 hover:to-purple-700 transition shadow-md"
                            >
                              <Edit size={18} />
                              Редактировать
                            </button>
                            <button
                              onClick={() => handleToggleUserAdmin(u.id, u.isAdmin)}
                              className={`px-4 py-2 rounded-xl font-semibold transition shadow-md ${
                                u.isAdmin
                                  ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white hover:from-slate-700 hover:to-slate-800'
                                  : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
                              }`}
                            >
                              {u.isAdmin ? 'Снять права' : 'Сделать админом'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {filteredUsers.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                      <Users size={48} className="mx-auto mb-3 opacity-30" />
                      <p>Пользователи не найдены</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-6">Отправка уведомлений</h2>
                <button
                  onClick={() => setShowNotificationForm(!showNotificationForm)}
                  className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl hover:from-purple-700 hover:to-pink-700 transition shadow-lg hover:shadow-xl mb-6"
                >
                  <Bell size={20} />
                  Создать уведомление
                </button>

                {showNotificationForm && (
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-2xl border-2 border-purple-100 shadow-lg">
                    <h3 className="text-xl font-bold mb-4 text-slate-800">Новое уведомление</h3>
                    <input
                      type="text"
                      placeholder="Заголовок уведомления"
                      value={notification.title}
                      onChange={(e) => setNotification({ ...notification, title: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl mb-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <textarea
                      placeholder="Текст уведомления"
                      value={notification.message}
                      onChange={(e) => setNotification({ ...notification, message: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl mb-3 h-32 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <div className="flex gap-3">
                      <button
                        onClick={handleSendNotification}
                        className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl hover:from-purple-700 hover:to-pink-700 transition shadow-lg"
                      >
                        <Bell size={18} />
                        Отправить всем
                      </button>
                      <button
                        onClick={() => setShowNotificationForm(false)}
                        className="flex items-center gap-2 bg-slate-400 text-white px-6 py-3 rounded-xl hover:bg-slate-500 transition"
                      >
                        <X size={18} />
                        Отмена
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-8 bg-gradient-to-br from-blue-50 to-purple-50 p-8 rounded-2xl border-2 border-blue-100 text-center">
                  <Bell size={48} className="mx-auto mb-4 text-purple-600 opacity-50" />
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">Массовые уведомления</h3>
                  <p className="text-slate-600 text-sm">
                    Уведомления будут отправлены всем пользователям приложения
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}