import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../firebase";
import { Well } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { Plus, X, Trash2, Edit2, Droplets, MapPin, Search } from "lucide-react";

interface Props {
  currentUser: any;
  onSelectWell: (wellId: string, wellName: string) => void;
}

export default function WellsList({ currentUser, onSelectWell }: Props) {
  const [wells, setWells] = useState<Well[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [owner, setOwner] = useState("");
  const [wellNumber, setWellNumber] = useState("");
  const [note, setNote] = useState("");

  const [editingWell, setEditingWell] = useState<Well | null>(null);

  useEffect(() => {
    if (!currentUser) return;

    // Auto-create default well if none exists and there are old customers
    // This is handled in App.tsx or here - we'll just listen to wells here
    const q = query(
      collection(db, "wells"),
      where("userId", "==", currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snap) => {
      const loaded: Well[] = [];
      snap.forEach((d) => {
        loaded.push({ id: d.id, ...d.data() } as Well);
      });
      // Sort alphabetically
      loaded.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
      setWells(loaded);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      if (editingWell) {
        await updateDoc(doc(db, "wells", editingWell.id), {
          name,
          location,
          owner,
          wellNumber,
          note
        });
      } else {
        await addDoc(collection(db, "wells"), {
          userId: currentUser.uid,
          name,
          location,
          owner,
          wellNumber,
          note,
          createdAt: serverTimestamp()
        });
      }
      setShowAddModal(false);
      resetForm();
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء حفظ بيانات البئر");
    }
  };

  const handleDelete = async (id: string, wname: string) => {
    if (window.confirm(`هل أنت متأكد من حذف البئر: ${wname}؟ لا يمكن التراجع عن هذا الإجراء.`)) {
      try {
        await deleteDoc(doc(db, "wells", id));
      } catch (err) {
        console.error(err);
        alert("حدث خطأ أثناء الحذف");
      }
    }
  };

  const openEdit = (w: Well) => {
    setEditingWell(w);
    setName(w.name);
    setLocation(w.location || "");
    setOwner(w.owner || "");
    setWellNumber(w.wellNumber || "");
    setNote(w.note || "");
    setShowAddModal(true);
  };

  const resetForm = () => {
    setName("");
    setLocation("");
    setOwner("");
    setWellNumber("");
    setNote("");
    setEditingWell(null);
  };

  const filteredWells = wells.filter(w => w.name.includes(searchQuery) || (w.location && w.location.includes(searchQuery)));

  return (
    <div className="pb-24 pt-4 px-4 max-w-lg mx-auto" dir="rtl">

      {/* Search and Add */}
      <div className="flex gap-2 mb-6 sticky top-2 z-10">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="ابحث عن بئر..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white/80 backdrop-blur-md border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white outline-none transition shadow-sm"
          />
          <Search className="absolute left-3 top-3 text-slate-400" size={20} />
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowAddModal(true);
          }}
          className="w-12 h-12 bg-cyan-600 hover:bg-cyan-700 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-600/30 transition cursor-pointer"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Wells Grid */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="text-center py-10 text-slate-400 font-bold">جاري تحميل الآبار...</div>
        ) : filteredWells.length === 0 ? (
          <div className="text-center py-12 px-6 bg-slate-50 border border-slate-100 rounded-3xl">
            <div className="w-16 h-16 bg-cyan-100 text-cyan-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Droplets size={32} />
            </div>
            <h3 className="text-lg font-black text-slate-800 mb-2">لا توجد آبار مسجلة</h3>
            <p className="text-sm font-bold text-slate-500 mb-6">قم بإضافة بئر جديد للبدء في إدارة المزارعين والسقايات.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-cyan-600 text-white font-bold rounded-xl shadow-lg shadow-cyan-600/20"
            >
              إضافة بئر جديد
            </button>
          </div>
        ) : (
          filteredWells.map((w) => (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              key={w.id}
              onClick={() => onSelectWell(w.id, w.name)}
              className="bg-white border border-slate-200 rounded-[2rem] p-5 shadow-sm hover:shadow-md transition cursor-pointer relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-2 h-full bg-cyan-500"></div>

              <div className="flex justify-between items-start mb-3 pl-2 pr-4">
                <div>
                  <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <Droplets className="text-cyan-500" size={18} />
                    {w.name}
                  </h3>
                  {w.location && (
                    <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1">
                      <MapPin size={12} /> {w.location}
                    </p>
                  )}
                </div>

                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => openEdit(w)} className="p-2 bg-slate-100 text-slate-600 rounded-full hover:bg-slate-200">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => handleDelete(w.id, w.name)} className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-3 mr-4 flex justify-between items-center text-xs font-bold text-slate-600">
                <span>المالك: {w.owner || "غير محدد"}</span>
                <span>رقم: {w.wellNumber || "---"}</span>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[2.5rem] p-6 max-w-sm w-full shadow-2xl relative"
            >
              <button
                onClick={() => setShowAddModal(false)}
                className="absolute top-5 left-5 p-2 bg-slate-100 text-slate-500 hover:text-slate-800 rounded-full transition"
              >
                <X size={20} />
              </button>

              <h2 className="text-xl font-black text-slate-800 mb-6 flex items-center gap-2">
                <div className="p-2 bg-cyan-100 text-cyan-600 rounded-xl">
                  <Droplets size={24} />
                </div>
                {editingWell ? "تعديل البئر" : "إضافة بئر جديد"}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">اسم البئر (مطلوب)</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: بئر التوفيق..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white outline-none transition"
                  />
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">الموقع</label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="المنطقة..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white outline-none transition"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">المالك</label>
                    <input
                      type="text"
                      value={owner}
                      onChange={(e) => setOwner(e.target.value)}
                      placeholder="اسم المالك..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-500 mb-1 mr-1">ملاحظات / رقم البئر</label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="أي ملاحظات إضافية..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-bold focus:bg-white outline-none transition"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-4 bg-cyan-600 hover:bg-cyan-700 text-white font-black rounded-2xl shadow-lg shadow-cyan-600/20 mt-2 transition"
                >
                  {editingWell ? "حفظ التعديلات" : "إنشاء البئر"}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
