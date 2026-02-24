/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  LayoutDashboard, Calendar as CalendarIcon, DoorOpen, BookOpen, Bell, Plus, Search, MapPin, Users,
  CheckCircle2, StickyNote, ChevronLeft, ChevronRight, Utensils, Star, Edit3, Trash2, Sparkles,
  Download, Hourglass, X, AlertCircle, Phone, Info, Settings, FileText, Image as ImageIcon, User, LogIn, LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ViewType, Reservation, Room, Dish, Period, CategoryProportion, ToastMessage } from './types';
import { supabase } from './supabase';
import { GoogleGenAI } from "@google/genai";
import { toPng } from 'html-to-image';
import { useRef } from 'react';

// --- Mock Data ---
const INITIAL_ROOMS: Room[] = [
  { id: 'r1', name: '蘭庭', capacity: 18 },
  { id: 'r2', name: '松月', capacity: 12 },
  { id: 'r3', name: '梅香', capacity: 10 },
  { id: 'r4', name: '竹韵', capacity: 8 },
  { id: 'r5', name: '菊篁', capacity: 8 },
];

const INITIAL_DISHES: Dish[] = [];

const INITIAL_RESERVATIONS: Reservation[] = [];

// --- Components ---

const Toast: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 3000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
    error: <AlertCircle className="w-5 h-5 text-rose-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      className="bg-white dark:bg-slate-800 shadow-xl border border-slate-100 dark:border-slate-700 rounded-xl p-4 flex items-center gap-3 min-w-[240px]"
    >
      {icons[toast.type]}
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{toast.message}</p>
      <button onClick={() => onDismiss(toast.id)} className="ml-auto text-slate-400 hover:text-slate-600">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6">{children}</div>
      </motion.div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeView, setActiveView] = useState<ViewType>('dashboard');
  const [activePeriod, setActivePeriod] = useState<Period>('lunch');
  const [activeDateTab, setActiveDateTab] = useState<'today' | 'tomorrow'>('today');
  const [rooms, setRooms] = useState<Room[]>(INITIAL_ROOMS);
  const [dishes, setDishes] = useState<Dish[]>(INITIAL_DISHES);
  const [reservations, setReservations] = useState<Reservation[]>(INITIAL_RESERVATIONS);
  const [proportions, setProportions] = useState<CategoryProportion[]>([
    { category: '前菜', percentage: 20 },
    { category: '主菜', percentage: 60 },
    { category: '甜点', percentage: 20 },
  ]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [menuSearch, setMenuSearch] = useState('');
  const [categories, setCategories] = useState<string[]>(['鸡', '鸭', '猪肉', '牛肉', '海鲜', '蔬菜', '甜点', '其他']);
  const [selectedResIdForMenu, setSelectedResIdForMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Modals
  const [editingReservation, setEditingReservation] = useState<Partial<Reservation> | null>(null);
  const [editingRoom, setEditingRoom] = useState<Partial<Room> | null>(null);
  const [editingDish, setEditingDish] = useState<Partial<Dish> | null>(null);
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [isAddingFromLibrary, setIsAddingFromLibrary] = useState(false);
  const [addingCategory, setAddingCategory] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'room' | 'res' | 'dish' | 'category'; id: string } | null>(null);

  // PWA Install Prompt State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      addToast('如无法自动添加，请点击浏览器底部“分享”或菜单图标，选择“添加到主屏幕”', 'info');
    }
  };

  // Auth & Sync
  const [isLoggedIn, setIsLoggedIn] = useState(!!localStorage.getItem('admin-token'));
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });

  // Fetch data from server on mount or login
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const skipNextSync = useRef(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: roomsData } = await supabase.from('rooms').select('*');
        const { data: dishesData } = await supabase.from('dishes').select('*');
        const { data: reservationsData } = await supabase.from('reservations').select('*');
        const { data: categoriesData } = await supabase.from('categories').select('*');

        skipNextSync.current = true;

        if (roomsData) setRooms(roomsData);
        if (dishesData) {
          // Map snake_case or specific struct cases if necessary, currently matching Dish interface
          setDishes(dishesData.map(d => ({
            id: d.id, name: d.name, price: Number(d.price), category: d.category_name, tags: d.tags || []
          })));
        }
        if (reservationsData) {
          setReservations(reservationsData.map(r => ({
            id: r.id, roomId: r.room_id, customerName: r.customer_name, phone: r.phone,
            pax: r.pax, standardPrice: Number(r.standard_price), totalPrice: Number(r.total_price),
            period: r.period, date: r.reservation_date, notes: r.notes, status: r.status, menu: r.menu
          })));
        }
        if (categoriesData) setCategories(categoriesData.map(c => c.name));

        setIsDataLoaded(true);
        setTimeout(() => skipNextSync.current = false, 100);
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setIsDataLoaded(true); // Stop blocking even on error
      }
    };
    fetchData();
  }, [isLoggedIn]);

  // Sync data to server on changes
  useEffect(() => {
    if (!isLoggedIn || !isDataLoaded || skipNextSync.current) return;
    const syncData = async () => {
      try {
        // Rooms sync
        for (const room of rooms) {
          await supabase.from('rooms').upsert({
            id: room.id.startsWith('r') ? undefined : room.id, // Only send UUIDs or omit for new
            name: room.name,
            capacity: room.capacity
          }, { onConflict: 'id' }).select();
        }

        // Categories sync
        for (const cat of categories) {
          await supabase.from('categories').upsert({ name: cat }, { onConflict: 'name' });
        }

        // Dishes sync
        for (const dish of dishes) {
          await supabase.from('dishes').upsert({
            id: dish.id.startsWith('d') ? undefined : dish.id,
            name: dish.name,
            price: dish.price,
            category_name: dish.category,
            tags: dish.tags
          }, { onConflict: 'id' });
        }

        // Reservations sync
        for (const res of reservations) {
          await supabase.from('reservations').upsert({
            id: res.id.startsWith('res') ? undefined : res.id,
            room_id: res.roomId,
            customer_name: res.customerName,
            phone: res.phone || '',
            pax: res.pax,
            standard_price: res.standardPrice,
            total_price: res.totalPrice,
            period: res.period,
            reservation_date: res.date,
            notes: res.notes || '',
            status: res.status,
            menu: res.menu || []
          }, { onConflict: 'id' });
        }
      } catch (err) {
        console.error("Sync partial failure:", err);
      }
    };
    // Debounce sync
    const timer = setTimeout(syncData, 1500);
    return () => clearTimeout(timer);
  }, [rooms, dishes, reservations, categories, isLoggedIn, isDataLoaded]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      if (res.ok) {
        const { token } = await res.json();
        localStorage.setItem('admin-token', token);
        setIsLoggedIn(true);
        addToast('登录成功');
      } else {
        addToast('用户名或密码错误', 'error');
      }
    } catch (err) {
      addToast('登录失败', 'error');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin-token');
    setIsLoggedIn(false);
    addToast('已退出登录');
  };

  const addToast = (message: string, type: ToastMessage['type'] = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  // --- Logic ---

  const handleSaveReservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReservation) return;

    const res = editingReservation as Reservation;

    const isDuplicate = reservations.some(
      r => r.roomId === res.roomId &&
        r.date === res.date &&
        r.period === res.period &&
        r.status !== 'cancelled' &&
        r.id !== res.id
    );

    if (isDuplicate) {
      addToast('该包厢在此日期此时段已被预订', 'error');
      return;
    }

    if (res.id) {
      setReservations(prev => prev.map(r => r.id === res.id ? res : r));
      addToast('预订已更新');
    } else {
      const newRes = { ...res, id: 'res' + Date.now(), status: 'pending' as const, menu: [] };
      setReservations(prev => [...prev, newRes]);
      addToast('预订已创建');
    }
    setEditingReservation(null);
  };

  const handleGenerateMenu = (resId: string) => {
    const res = reservations.find(r => r.id === resId);
    if (!res) return;

    const pax = res.pax;

    // 固定默认菜品 - 冷菜（根据人数）
    let coldDishCount = 4;
    let coldDishUnitPrice = 30;
    if (pax >= 10) {
      coldDishCount = 8;
    } else if (pax >= 8) {
      coldDishCount = 6;
    } else {
      coldDishCount = 4;
    }
    const coldDishTotal = coldDishCount * coldDishUnitPrice;

    // 固定末尾四道菜
    const fixedEndDishes: Dish[] = [
      { id: 'fixed-dim-sum', name: '点心', price: 30, category: '点心', tags: [] },
      { id: 'fixed-veg', name: '时蔬', price: 30, category: '时蔬', tags: [] },
      { id: 'fixed-staple', name: '主食', price: 30, category: '主食', tags: [] },
      { id: 'fixed-fruit', name: '水果', price: 30, category: '水果', tags: [] },
    ];
    const fixedEndTotal = fixedEndDishes.reduce((s, d) => s + d.price, 0);

    // 固定第一道（冷菜）
    const coldDishEntry: Dish = {
      id: 'fixed-cold',
      name: `冷菜${coldDishCount}碟`,
      price: coldDishTotal,
      category: '冷菜',
      tags: []
    };

    // 从菜品库中选菜填充中间部分
    const fixedTotal = coldDishTotal + fixedEndTotal;
    const targetForMiddle = res.totalPrice - fixedTotal;
    const maxTargetForMiddle = targetForMiddle * 1.15; // 允许超出 15%
    const middleDishes: Dish[] = [];
    let middleTotal = 0;

    let availableDishes = [...dishes];
    let hasGuestDish = false;

    // 果餐标 >= 200，先强制加入一道各客菜
    if (res.standardPrice >= 200) {
      const guestDishes = availableDishes.filter(d => d.category === '各客');
      if (guestDishes.length > 0) {
        const randomGuestDish = guestDishes[Math.floor(Math.random() * guestDishes.length)];
        const guestDishPrice = randomGuestDish.price * pax; // 各客类的总价计算规则为订单人数*各客菜价格

        middleDishes.push({ ...randomGuestDish, price: guestDishPrice });
        middleTotal += guestDishPrice;
        hasGuestDish = true;

        // 从可用列表中移除已选的各客菜避免重复
        availableDishes = availableDishes.filter(d => d.id !== randomGuestDish.id);
      }
    }

    const shuffledDishes = availableDishes.sort(() => Math.random() - 0.5);
    for (const dish of shuffledDishes) {
      let finalDish = dish;
      let dishPrice = dish.price;

      if (dish.category === '各客') {
        // 如果已经加过各客菜，或者餐标不够，不再添加
        if (hasGuestDish || res.standardPrice < 200) {
          continue;
        }
        dishPrice = dish.price * pax;
        finalDish = { ...dish, price: dishPrice };
        hasGuestDish = true; // 记录已选各客菜
      }

      // 允许总价超出预订价 15%
      if (middleTotal + dishPrice <= maxTargetForMiddle) {
        middleDishes.push(finalDish);
        middleTotal += dishPrice;
      }

      // 判断结束条件：达到目标价位附近即可停止（例如允许 50 元误差或者已非常接近 15% 溢价极限）
      if (middleTotal >= targetForMiddle && middleTotal <= maxTargetForMiddle) {
        // 我们可能在一个比较理想的范围内了，可以考虑 break，但也可能没达到正好，这里允许继续直到不超过 1.15
        // 为了不让每次都卡在刚好低于标准，可以加点随机或者直接继续填满
      }
    }

    const finalMenu = [coldDishEntry, ...middleDishes, ...fixedEndDishes];
    setReservations(prev => prev.map(r => r.id === resId ? { ...r, menu: finalMenu } : r));
    addToast('菜单已自动生成');
  };

  const handleExportMenu = async () => {
    if (menuRef.current === null) return;
    try {
      const dataUrl = await toPng(menuRef.current, {
        cacheBust: true,
        backgroundColor: '#fff',
        filter: (node: any) => {
          if (node.classList && node.classList.contains('no-export')) {
            return false;
          }
          return true;
        }
      });
      const link = document.createElement('a');
      link.download = `菜单-${selectedResIdForMenu}.png`;
      link.href = dataUrl;
      link.click();
      addToast('菜单已导出为图片');
    } catch (err) {
      addToast('导出失败', 'error');
    }
  };

  const handleDeleteRoom = (id: string) => {
    const hasHistory = reservations.some(r => r.roomId === id);
    if (hasHistory) {
      addToast('无法删除：该包厢已有预订记录', 'error');
    } else {
      setRooms(prev => prev.filter(r => r.id !== id));
      addToast('包厢已删除');
    }
    setConfirmDelete(null);
  };

  const autoGenerateMenu = (totalPrice: number, standardPrice: number = 0, pax: number = 1) => {
    // Simple logic: pick dishes based on proportions and price
    const newMenu: Dish[] = [];
    const maxTotalPrice = totalPrice * 1.15; // 允许超出 15%
    let currentTotal = 0;

    let availableDishes = [...dishes];
    let hasGuestDish = false;

    // 果餐标 >= 200，先强制加入一道各客菜
    if (standardPrice >= 200) {
      const guestDishes = availableDishes.filter(d => d.category === '各客');
      if (guestDishes.length > 0) {
        const randomGuestDish = guestDishes[Math.floor(Math.random() * guestDishes.length)];
        const guestDishPrice = randomGuestDish.price * pax; // 各客类的总价计算规则为订单人数*各客菜价格

        newMenu.push({ ...randomGuestDish, price: guestDishPrice });
        currentTotal += guestDishPrice;
        hasGuestDish = true;

        // 从可用列表中移除已选的各客菜避免重复
        availableDishes = availableDishes.filter(d => d.id !== randomGuestDish.id);
      }
    }

    proportions.forEach(prop => {
      // 从剩余的部分计算目标金额
      const remainingTarget = (totalPrice - currentTotal) > 0 ? (totalPrice - currentTotal) : 0;
      // TODO: proportions logic should ideally be adjusted if guest dish takes up a lot, but for simplicity we re-calculate
      // A more robust way would be to just target the prop.percentage of the *original* totalPrice.
      const targetAmount = totalPrice * (prop.percentage / 100);
      let catDishes = availableDishes.filter(d => d.category === prop.category);
      let catTotal = 0;

      while (catTotal < targetAmount && catDishes.length > 0) {
        const dishIndex = Math.floor(Math.random() * catDishes.length);
        const dish = catDishes[dishIndex];

        let finalDish = dish;
        let dishPrice = dish.price;

        if (dish.category === '各客') {
          // 如果已经加过各客菜，或者餐标不够，不再添加
          if (hasGuestDish || standardPrice < 200) {
            catDishes.splice(dishIndex, 1);
            continue;
          }
          dishPrice = dish.price * pax;
          finalDish = { ...dish, price: dishPrice };
          hasGuestDish = true; // 记录已选各客菜
        }

        if (currentTotal + dishPrice <= maxTotalPrice) {
          newMenu.push(finalDish);
          catTotal += dishPrice;
          currentTotal += dishPrice;
          catDishes.splice(dishIndex, 1); // 避免重复选同一道菜
        } else break;
      }
    });

    return newMenu;
  };

  // --- Renderers ---

  const renderDashboard = () => {
    const targetDate = new Date();
    if (activeDateTab === 'tomorrow') targetDate.setDate(targetDate.getDate() + 1);
    const dateStr = targetDate.toISOString().split('T')[0];

    const filtered = reservations.filter(r => r.date === dateStr && r.status !== 'cancelled');

    return (
      <div className="space-y-6">
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          {(['today', 'tomorrow'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveDateTab(tab)}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activeDateTab === tab ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
            >
              {tab === 'today' ? '今日' : '明日'}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-slate-400">暂无预订</div>
          ) : (
            filtered.map(res => {
              const room = rooms.find(r => r.id === res.roomId);
              const isLunch = res.period === 'lunch';
              return (
                <motion.div
                  key={res.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border-l-4 ${isLunch ? 'border-primary' : 'border-dinner-accent'}`}
                  onClick={() => setEditingReservation(res)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{res.customerName}</h3>
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3" /> {room?.name} • {isLunch ? '午市' : '晚市'}
                      </p>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${isLunch ? 'bg-primary/10 text-primary' : 'bg-dinner-accent/10 text-dinner-accent'}`}>
                      <Users className="w-3 h-3" /> {res.pax} 人
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-50 dark:border-slate-800">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">餐标</p>
                      <p className="text-base font-semibold">￥{res.standardPrice}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">总价</p>
                      <p className={`text-base font-bold ${isLunch ? 'text-primary' : 'text-dinner-accent'}`}>￥{res.totalPrice}</p>
                    </div>
                  </div>
                  {res.notes && (
                    <div className="mt-3 flex items-start gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl">
                      <StickyNote className="w-3 h-3 text-slate-400 mt-0.5" />
                      <p className="text-xs text-slate-600 dark:text-slate-400 italic">"{res.notes}"</p>
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const renderCalendar = () => {
    return (
      <div className="space-y-6">
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          {(['lunch', 'dinner'] as const).map(p => (
            <button
              key={p}
              onClick={() => setActivePeriod(p)}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${activePeriod === p ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}
            >
              {p === 'lunch' ? '只看中午' : '只看晚上'}
            </button>
          ))}
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-6">
            <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronLeft className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold">2026年2月</h2>
            <button className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"><ChevronRight className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['日', '一', '二', '三', '四', '五', '六'].map(d => (
              <div key={d} className="text-slate-400 text-[10px] font-bold uppercase">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 28 }, (_, i) => {
              const day = i + 1;
              const dateStr = `2026-02-${day.toString().padStart(2, '0')}`;
              const count = reservations.filter(r => r.date === dateStr && r.period === activePeriod && r.status !== 'cancelled').length;
              const isSelected = selectedDate === dateStr;

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`aspect-square flex flex-col items-center justify-center rounded-xl cursor-pointer transition-all ${isSelected ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                >
                  <span className="text-sm font-bold">{day}</span>
                  {count > 0 && <span className={`text-[9px] ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>{count} 桌</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            {selectedDate} {activePeriod === 'lunch' ? '午市' : '晚市'} 状态
          </h3>
          <div className="grid gap-3">
            {rooms.map(room => {
              const res = reservations.find(r => r.roomId === room.id && r.date === selectedDate && r.period === activePeriod && r.status !== 'cancelled');
              return (
                <div
                  key={room.id}
                  onClick={() => !res && setEditingReservation({ roomId: room.id, date: selectedDate, period: activePeriod, pax: 2, standardPrice: 100, totalPrice: 200 })}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between cursor-pointer hover:border-primary/50 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${res ? 'bg-slate-100 text-slate-400' : 'bg-primary/10 text-primary'}`}>
                      <DoorOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold">{room.name}</h4>
                      <p className="text-xs text-slate-500">{res ? `已订: ${res.customerName}` : '空闲'}</p>
                    </div>
                  </div>
                  {res ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('确定要取消此预订吗？此操作不可逆。')) {
                          setReservations(prev => prev.map(r => r.id === res.id ? { ...r, status: 'cancelled' } : r));
                          addToast('预订已取消');
                        }
                      }}
                      className="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-500 hover:bg-red-200 transition-colors"
                    >
                      取消预定
                    </button>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase bg-primary/20 text-primary">
                      空闲
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderRooms = () => {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">包厢列表</h2>
          <button onClick={() => setEditingRoom({ name: '', capacity: 10 })} className="flex items-center gap-1 text-primary font-bold text-sm">
            <Plus className="w-4 h-4" /> 新增包厢
          </button>
        </div>
        <div className="grid gap-3">
          {rooms.map(room => (
            <div key={room.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <DoorOpen className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold">{room.name}</p>
                  <p className="text-xs text-slate-400">容纳 {room.capacity} 人</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setEditingRoom(room)} className="p-2 text-slate-400 hover:text-primary transition-colors"><Edit3 className="w-4 h-4" /></button>
                <button onClick={() => setConfirmDelete({ type: 'room', id: room.id })} className="p-2 text-slate-400 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderMenu = () => {
    const filteredDishes = dishes.filter(d => d.name.includes(menuSearch) || d.category.includes(menuSearch));
    const selectedRes = reservations.find(r => r.id === selectedResIdForMenu);

    return (
      <div className="space-y-8">
        {/* Reservation Selector for Menu Generation */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-primary" /> 菜单生成与导出</h3>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase">选择预订信息</label>
            <select
              value={selectedResIdForMenu || ''}
              onChange={e => setSelectedResIdForMenu(e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="">请选择一个预订...</option>
              {reservations.filter(r => r.status !== 'cancelled').map(r => (
                <option key={r.id} value={r.id}>
                  {r.date} {r.period === 'lunch' ? '午' : '晚'} - {r.customerName} ({rooms.find(rm => rm.id === r.roomId)?.name})
                </option>
              ))}
            </select>
          </div>

          {selectedRes && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
              <button
                onClick={() => handleGenerateMenu(selectedRes.id)}
                className="flex-1 py-3 bg-primary/10 text-primary font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-primary/20 transition-all"
              >
                <Sparkles className="w-4 h-4" /> 自动生成菜单
              </button>
              {selectedRes.menu && selectedRes.menu.length > 0 && (
                <button
                  onClick={handleExportMenu}
                  className="flex-1 py-3 bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 hover:scale-105 active:scale-95 transition-all"
                >
                  <ImageIcon className="w-4 h-4" /> 导出为图片
                </button>
              )}
            </div>
          )}
        </div>

        {/* Generated Menu Display */}
        {selectedRes && (
          <div className="space-y-4">
            <h3 className="font-bold px-2">当前菜单预览</h3>
            <div
              ref={menuRef}
              className="bg-white p-8 rounded-2xl border border-slate-200 shadow-lg space-y-8 text-slate-900"
            >
              <div className="text-center space-y-2 border-b-2 border-slate-900 pb-6">
                <h2 className="text-3xl font-serif font-bold tracking-widest uppercase">
                  {rooms.find(r => r.id === selectedRes.roomId)?.name}
                </h2>
                <div className="flex flex-col items-center gap-1 text-xs text-slate-500">
                  <span>日期: {selectedRes.date} ({selectedRes.period === 'lunch' ? '午市' : '晚市'})</span>
                  <span>餐标: ￥{selectedRes.standardPrice}/位</span>
                </div>
              </div>

              <div className="grid gap-1">
                {selectedRes.menu && selectedRes.menu.map((dish, idx) => (
                  <div
                    key={`${dish.id}-${idx}`}
                    className="flex items-center justify-between group py-1.5 px-2 rounded-lg transition-colors hover:bg-slate-50"
                  >
                    <div
                      className="flex-1 flex items-center justify-between cursor-pointer pr-2"
                      onClick={() => {
                        const newName = prompt('修改菜品名称:', dish.name);
                        if (newName === null) return;
                        const newPriceStr = prompt('修改菜品价格:', dish.price.toString());
                        if (newPriceStr === null) return;
                        const newPrice = parseFloat(newPriceStr);

                        const newMenu = [...selectedRes.menu!];
                        newMenu[idx] = { ...dish, name: newName, price: isNaN(newPrice) ? dish.price : newPrice };
                        setReservations(prev => prev.map(r => r.id === selectedRes.id ? { ...r, menu: newMenu } : r));
                        addToast('菜品已修改');
                      }}
                    >
                      <span className="text-lg font-bold">{dish.name}</span>
                      <span className="text-base text-slate-500">¥{dish.price}</span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const newMenu = selectedRes.menu!.filter((_, i) => i !== idx);
                        setReservations(prev => prev.map(r => r.id === selectedRes.id ? { ...r, menu: newMenu } : r));
                        addToast('菜品已删除');
                      }}
                      className="no-export p-2 text-slate-300 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {/* 菜单总价 */}
                {selectedRes.menu && selectedRes.menu.length > 0 && (
                  <div className="mt-4 pt-3 border-t-2 border-slate-300 flex items-center justify-between px-2">
                    <span className="text-base font-bold text-slate-700">菜单总价</span>
                    <span className="text-xl font-bold text-slate-900">
                      ¥{selectedRes.menu.reduce((sum, d) => sum + d.price, 0)}
                    </span>
                  </div>
                )}

                <div className="mt-4 no-export">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingFromLibrary(true);
                      setAddingCategory(null);
                    }}
                    className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:text-primary hover:border-primary transition-all text-sm font-bold flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> 从库中添加菜品
                  </button>
                </div>
              </div>

              <div className="pt-6 border-t-2 border-slate-900 flex justify-center items-center">
                <span className="text-sm text-slate-500 italic">祝您用餐愉快</span>
              </div>
            </div>
          </div>
        )}

        {/* Dish Library */}
        <div className="space-y-6 pt-8 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2"><Utensils className="w-5 h-5" /> 菜品库管理</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setIsManagingCategories(true)}
                className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 hover:text-primary transition-colors"
                title="管理分类"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button onClick={() => setEditingDish({ name: '', price: 0, category: categories[0], tags: [] })} className="bg-primary text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-1 shadow-lg shadow-primary/20">
                <Plus className="w-4 h-4" /> 新增菜品
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              value={menuSearch}
              onChange={e => setMenuSearch(e.target.value)}
              placeholder="搜索菜品名称或食材分类..."
              className="w-full pl-10 pr-4 py-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm focus:ring-2 focus:ring-primary/50 outline-none"
            />
          </div>

          <div className="grid gap-4">
            {filteredDishes.map(dish => (
              <div key={dish.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between group hover:border-primary/50 transition-all">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold">{dish.name}</h4>
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded font-bold">{dish.category}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-lg font-bold text-primary">￥{dish.price}</span>
                    <div className="flex gap-4">
                      <button onClick={() => setEditingDish(dish)} className="text-slate-400 hover:text-primary transition-colors"><Edit3 className="w-4 h-4" /></button>
                      <button onClick={() => setConfirmDelete({ type: 'dish', id: dish.id })} className="text-slate-400 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex flex-col max-w-2xl mx-auto shadow-2xl relative overflow-x-hidden">
      {!isLoggedIn ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-8">
          <div className="text-center space-y-4">
            <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto">
              <Utensils className="text-primary w-10 h-10" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">智能餐厅管理系统</h1>
            <p className="text-slate-500 dark:text-slate-400">请登录以访问您的餐厅数据</p>
          </div>

          <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4 bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">用户名</label>
              <input
                required
                value={loginForm.username}
                onChange={e => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="请输入用户名"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">密码</label>
              <input
                type="password"
                required
                value={loginForm.password}
                onChange={e => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="请输入密码"
              />
            </div>
            <button type="submit" className="w-full py-4 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2">
              <LogIn className="w-5 h-5" />
              立即登录
            </button>
            <p className="text-center text-[10px] text-slate-400 uppercase tracking-widest pt-2">
              数据多端实时同步
            </p>
          </form>
        </div>
      ) : (
        <>
          {/* Header */}
          <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Utensils className="text-primary w-8 h-8" />
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {activeView === 'dashboard' ? '智能看板' : activeView === 'calendar' ? '预订日历' : activeView === 'rooms' ? '包厢管理' : '菜单管理'}
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 hover:text-primary transition-colors text-sm font-bold"
                >
                  <Settings className="w-4 h-4" />
                  <span>设置</span>
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 p-6 pb-32">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {activeView === 'dashboard' && renderDashboard()}
                {activeView === 'calendar' && renderCalendar()}
                {activeView === 'rooms' && renderRooms()}
                {activeView === 'menu' && renderMenu()}
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Floating Action Button */}
          <button
            onClick={() => setEditingReservation({ date: new Date().toISOString().split('T')[0], period: 'lunch', pax: 2, standardPrice: 100, totalPrice: 200 })}
            className="fixed bottom-24 right-6 w-14 h-14 bg-primary text-white rounded-full shadow-xl flex items-center justify-center z-40 hover:scale-110 active:scale-95 transition-all"
          >
            <Plus className="w-8 h-8" />
          </button>

          {/* Bottom Nav */}
          <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-6 py-4 z-50">
            <div className="flex items-center justify-between max-w-2xl mx-auto w-full">
              {[
                { id: 'dashboard', icon: <LayoutDashboard />, label: '看板' },
                { id: 'calendar', icon: <CalendarIcon />, label: '日历' },
                { id: 'rooms', icon: <DoorOpen />, label: '包厢' },
                { id: 'menu', icon: <BookOpen />, label: '菜单' }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id as ViewType)}
                  className={`flex flex-col items-center gap-1 transition-all ${activeView === item.id ? 'text-primary' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <div className={`transition-transform ${activeView === item.id ? 'scale-110' : ''}`}>
                    {item.icon}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest">{item.label}</span>
                  {activeView === item.id && <motion.div layoutId="nav-dot" className="w-1 h-1 bg-primary rounded-full mt-0.5" />}
                </button>
              ))}
            </div>
          </nav>
        </>
      )}

      {/* Toasts */}
      <div className="fixed bottom-32 right-6 z-[200] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map(t => <Toast key={t.id} toast={t} onDismiss={removeToast} />)}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <Modal isOpen={!!editingReservation} onClose={() => setEditingReservation(null)} title={editingReservation?.id ? '编辑预订' : '新建预订'}>
        <form onSubmit={handleSaveReservation} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">预订日期</label>
              <input type="date" required value={editingReservation?.date || ''} onChange={e => setEditingReservation(prev => ({ ...prev, date: e.target.value }))} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">餐次</label>
              <select value={editingReservation?.period || 'lunch'} onChange={e => setEditingReservation(prev => ({ ...prev, period: e.target.value as Period }))} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50">
                <option value="lunch">午市</option>
                <option value="dinner">晚市</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">顾客姓名</label>
              <input required value={editingReservation?.customerName || ''} onChange={e => setEditingReservation(prev => ({ ...prev, customerName: e.target.value }))} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">联系电话</label>
              <input required value={editingReservation?.phone || ''} onChange={e => setEditingReservation(prev => ({ ...prev, phone: e.target.value }))} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">人数</label>
              <input type="number" required value={editingReservation?.pax || ''} onChange={e => {
                const pax = parseInt(e.target.value);
                setEditingReservation(prev => ({ ...prev, pax, totalPrice: pax * (prev?.standardPrice || 0) }));
              }} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">餐标 (每人)</label>
              <input type="number" required value={editingReservation?.standardPrice || ''} onChange={e => {
                const standardPrice = parseInt(e.target.value);
                setEditingReservation(prev => ({ ...prev, standardPrice, totalPrice: (prev?.pax || 0) * standardPrice }));
              }} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">包厢</label>
            <select value={editingReservation?.roomId || ''} onChange={e => setEditingReservation(prev => ({ ...prev, roomId: e.target.value }))} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50">
              <option value="">请选择包厢</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name} (容纳 {r.capacity}人)</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">备注</label>
            <textarea value={editingReservation?.notes || ''} onChange={e => setEditingReservation(prev => ({ ...prev, notes: e.target.value }))} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50 h-20" />
          </div>
          <div className="pt-4 flex gap-3">
            {editingReservation?.id && (
              <button type="button" onClick={() => setConfirmDelete({ type: 'res', id: editingReservation.id! })} className="flex-1 py-3 bg-rose-50 text-rose-500 font-bold rounded-xl hover:bg-rose-100 transition-colors">取消预订</button>
            )}
            <button type="submit" className="flex-[2] py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-all">保存预订</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="系统设置">
        <div className="space-y-4">
          <button
            onClick={handleInstallClick}
            className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl hover:bg-primary/10 group transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                <Download className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="font-bold text-slate-800 dark:text-slate-200">添加到手机桌面</p>
                <p className="text-xs text-slate-500">将系统安装到主屏幕，体验原生App</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary" />
          </button>

          <button
            onClick={() => {
              setIsSettingsOpen(false);
              handleLogout();
            }}
            className="w-full flex items-center justify-between p-4 bg-rose-50 dark:bg-rose-500/10 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-500/20 group transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-500/20 flex items-center justify-center text-rose-500">
                <LogOut className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="font-bold text-rose-600 dark:text-rose-400">退出登录</p>
                <p className="text-xs text-rose-500/70">清除本地缓存并返回登录页</p>
              </div>
            </div>
          </button>
        </div>
      </Modal>

      <Modal isOpen={!!editingRoom} onClose={() => setEditingRoom(null)} title={editingRoom?.id ? '编辑包厢' : '新增包厢'}>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">包厢名称</label>
            <input value={editingRoom?.name || ''} onChange={e => setEditingRoom(prev => ({ ...prev, name: e.target.value }))} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">最大容纳人数</label>
            <input type="number" value={editingRoom?.capacity || ''} onChange={e => setEditingRoom(prev => ({ ...prev, capacity: parseInt(e.target.value) }))} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <button
            onClick={() => {
              if (editingRoom?.id) {
                setRooms(prev => prev.map(r => r.id === editingRoom.id ? editingRoom as Room : r));
                addToast('包厢已更新');
              } else {
                setRooms(prev => [...prev, { ...editingRoom, id: 'r' + Date.now() } as Room]);
                addToast('包厢已创建');
              }
              setEditingRoom(null);
            }}
            className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-all"
          >
            保存包厢
          </button>
        </div>
      </Modal>

      <Modal isOpen={!!editingDish} onClose={() => setEditingDish(null)} title={editingDish?.id ? '编辑菜品' : '新增菜品'}>
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">菜品名称</label>
            <input value={editingDish?.name || ''} onChange={e => setEditingDish(prev => ({ ...prev, name: e.target.value }))} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">食材分类</label>
            <select value={editingDish?.category || ''} onChange={e => setEditingDish(prev => ({ ...prev, category: e.target.value }))} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50">
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">单价 (￥)</label>
            <input type="number" value={editingDish?.price || ''} onChange={e => setEditingDish(prev => ({ ...prev, price: parseFloat(e.target.value) }))} className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <button
            onClick={() => {
              if (!editingDish?.name?.trim()) {
                addToast('请输入菜品名称', 'error');
                return;
              }

              const normalizedName = editingDish.name.trim();

              // Helper function for string similarity (Dice's Coefficient approximation for Chinese chars)
              const getSimilarity = (s1: string, s2: string) => {
                if (s1 === s2) return 1.0;
                if (s1.length < 2 || s2.length < 2) return 0.0;

                let bigrams1 = new Set();
                for (let i = 0; i < s1.length - 1; i++) {
                  bigrams1.add(s1.substring(i, i + 2));
                }
                let bigrams2 = new Set();
                for (let i = 0; i < s2.length - 1; i++) {
                  bigrams2.add(s2.substring(i, i + 2));
                }

                let intersection = 0;
                for (let item of bigrams1) {
                  if (bigrams2.has(item)) intersection++;
                }

                return (2.0 * intersection) / (bigrams1.size + bigrams2.size);
              };

              // 检查完全重复 (即使是在编辑模式，如果改成了已有的其他菜名也要拦截)
              const isExactDuplicate = dishes.some(d => d.name === normalizedName && d.id !== editingDish.id);
              if (isExactDuplicate) {
                addToast('该菜名已存在，无法重复添加', 'error');
                return;
              }

              // 检查 80% 相似度 (只在新增时或者改名时检查)
              if (!editingDish.id || dishes.find(d => d.id === editingDish.id)?.name !== normalizedName) {
                const similarDishes = dishes.filter(d =>
                  d.id !== editingDish.id && getSimilarity(d.name, normalizedName) >= 0.8
                );

                if (similarDishes.length > 0) {
                  const similarNames = similarDishes.map(d => d.name).join('、');
                  const confirmed = window.confirm(`发现已存在相似菜品：【${similarNames}】。\n确定要继续添加/保存吗？`);
                  if (!confirmed) {
                    return;
                  }
                }
              }

              if (editingDish?.id) {
                setDishes(prev => prev.map(d => d.id === editingDish.id ? { ...editingDish, name: normalizedName } as Dish : d));
                addToast('菜品已更新');
              } else {
                setDishes(prev => [...prev, { ...editingDish, name: normalizedName, id: 'd' + Date.now(), tags: [] } as Dish]);
                addToast('菜品已创建');
              }
              setEditingDish(null);
            }}
            className="w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 active:scale-95 transition-all"
          >
            保存菜品
          </button>
        </div>
      </Modal>

      <Modal isOpen={isAddingFromLibrary} onClose={() => setIsAddingFromLibrary(false)} title="从菜品库添加">
        <div className="space-y-4">
          {!addingCategory ? (
            <div className="grid grid-cols-2 gap-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setAddingCategory(cat)}
                  className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl font-bold text-slate-600 hover:bg-primary/10 hover:text-primary transition-all"
                >
                  {cat}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <button
                onClick={() => setAddingCategory(null)}
                className="flex items-center gap-1 text-xs font-bold text-primary uppercase tracking-widest"
              >
                <ChevronLeft className="w-4 h-4" /> 返回分类
              </button>
              <div className="max-h-80 overflow-y-auto space-y-2 pr-2">
                {dishes
                  .filter(d => d.category === addingCategory)
                  .filter(d => !reservations.find(r => r.id === selectedResIdForMenu)?.menu?.some(m => m.id === d.id))
                  .map(dish => (
                    <button
                      key={dish.id}
                      onClick={() => {
                        const resId = selectedResIdForMenu;
                        if (!resId) return;
                        setReservations(prev => prev.map(r => {
                          if (r.id !== resId) return r;
                          const currentMenu = r.menu || [];
                          const coldIdx = currentMenu.findIndex(d => d.category === '冷菜');
                          const insertIdx = coldIdx >= 0 ? coldIdx + 1 : 0;
                          const newMenu = [...currentMenu];
                          newMenu.splice(insertIdx, 0, dish);
                          return { ...r, menu: newMenu };
                        }));
                        addToast(`已添加: ${dish.name}`);
                        setIsAddingFromLibrary(false);
                      }}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-800 rounded-xl flex justify-between items-center hover:bg-primary/10 transition-all group"
                    >
                      <span className="font-bold group-hover:text-primary">{dish.name}</span>
                      <span className="text-sm font-bold text-slate-400">￥{dish.price}</span>
                    </button>
                  ))}
                {dishes.filter(d => d.category === addingCategory).filter(d => !reservations.find(r => r.id === selectedResIdForMenu)?.menu?.some(m => m.id === d.id)).length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-sm italic">
                    该分类下暂无可选菜品
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal isOpen={isManagingCategories} onClose={() => setIsManagingCategories(false)} title="管理食材分类">
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              id="new-category-input"
              type="text"
              placeholder="新分类名称"
              className="flex-1 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg outline-none border border-transparent focus:border-primary"
            />
            <button
              onClick={() => {
                const input = document.getElementById('new-category-input') as HTMLInputElement;
                const val = input.value.trim();
                if (val && !categories.includes(val)) {
                  setCategories(prev => [...prev, val]);
                  input.value = '';
                  addToast('分类已添加');
                }
              }}
              className="px-4 py-2 bg-primary text-white font-bold rounded-lg"
            >
              添加
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-2 pr-2">
            {categories.map(cat => (
              <div key={cat} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-lg group">
                <span className="font-medium">{cat}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      const newName = prompt('修改分类名称:', cat);
                      if (newName && newName !== cat) {
                        setCategories(prev => prev.map(c => c === cat ? newName : c));
                        setDishes(prev => prev.map(d => d.category === cat ? { ...d, category: newName } : d));
                        addToast('分类已更新');
                      }
                    }}
                    className="p-1 text-slate-400 hover:text-primary"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete({ type: 'category', id: cat })}
                    className="p-1 text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="确认操作">
        <div className="space-y-6">
          <div className="flex items-center gap-4 text-rose-500 bg-rose-50 p-4 rounded-2xl">
            <AlertCircle className="w-8 h-8 shrink-0" />
            <p className="text-sm font-medium">确定要删除吗？此操作不可撤销。</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 bg-slate-100 font-bold rounded-xl">取消</button>
            <button
              onClick={() => {
                if (confirmDelete?.type === 'room') handleDeleteRoom(confirmDelete.id);
                else if (confirmDelete?.type === 'dish') {
                  setDishes(prev => prev.filter(d => d.id !== confirmDelete.id));
                  addToast('菜品已删除');
                  setConfirmDelete(null);
                }
                else if (confirmDelete?.type === 'category') {
                  setCategories(prev => prev.filter(c => c !== confirmDelete.id));
                  setDishes(prev => prev.map(d => d.category === confirmDelete.id ? { ...d, category: '其他' } : d));
                  addToast('分类已删除');
                  setConfirmDelete(null);
                }
                else {
                  setReservations(prev => prev.filter(r => r.id !== confirmDelete?.id));
                  addToast('预订已取消');
                  setEditingReservation(null);
                  setConfirmDelete(null);
                }
              }}
              className="flex-1 py-3 bg-rose-500 text-white font-bold rounded-xl shadow-lg shadow-rose-200"
            >
              确定删除
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
