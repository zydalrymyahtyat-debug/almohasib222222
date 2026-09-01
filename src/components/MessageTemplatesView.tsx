import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { MessageTemplate, TemplateType } from "../types";
import { motion, AnimatePresence } from "motion/react";
import { Plus, X, Edit2, Trash2, CheckCircle, MessageSquare, Save } from "lucide-react";

interface Props {
  currentUser?: any;
  onGoBack: () => void;
}

const TEMPLATE_TYPES: { value: TemplateType; label: string }[] = [
  { value: "sms_single", label: "رسالة SMS نصية" },
  { value: "wa_single", label: "واتساب - عملية واحدة" },
  { value: "wa_multiple", label: "واتساب - عمليات متعددة (جديدة)" },
  { value: "wa_all", label: "واتساب - كامل الكشف" },
  { value: "market_rawi", label: "واتساب - تصفية الرعوي (مقوت السوق)" },
  { value: "market_mqawet", label: "واتساب - كشف المقوت (مقوت السوق)" },
];

const AVAILABLE_VARIABLES = [
  { code: "{الاسم}", desc: "اسم العميل/الجهة" },
  { code: "{اللقب}", desc: "أستاذ/ة، السيد/ة، المشروع" },
  { code: "{الرصيد_السابق}", desc: "الرصيد قبل العملية" },
  { code: "{المبلغ_المضاف}", desc: "المبلغ الذي تم إضافته مؤخرًا" },
  { code: "{اتجاه_الاضافة}", desc: "عليك / لك" },
  { code: "{بيان_العملية}", desc: "نص بيان العملية / الملاحظة" },
  { code: "{الرصيد_الحالي}", desc: "الرصيد النهائي الإجمالي" },
  { code: "{اتجاه_الرصيد}", desc: "عليك / لك (للرصيد الحالي)" },
  { code: "{التاريخ}", desc: "تاريخ اليوم" },
  { code: "{العمليات_المتعددة}", desc: "قائمة العمليات التفصيلية (للواتساب فقط)" },
  { code: "{عدد_العمليات}", desc: "عدد العمليات المضافة" },
  { code: "{تفاصيل_المقاوتة}", desc: "تفاصيل السحبيات والتوزيع (لقسم مقوت السوق)" },
  { code: "{إجمالي_المطلوب}", desc: "إجمالي المبلغ المطلوب (لقسم مقوت السوق)" },
  { code: "{صافي_الرعوي}", desc: "المبلغ الخالص للرعوي (لقسم مقوت السوق)" },
  { code: "{إجمالي_الكمية}", desc: "الكمية الموردة (لقسم مقوت السوق)" },
];

export default function MessageTemplatesView({ currentUser, onGoBack }: Props) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TemplateType>("sms_single");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const [formName, setFormName] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formType, setFormType] = useState<TemplateType>("sms_single");
  const [formIsActive, setFormIsActive] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "message_templates"), where("userId", "==", currentUser.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: MessageTemplate[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as MessageTemplate));
      // Provide default templates if none exist
      if (list.length === 0 && snap.metadata.hasPendingWrites === false) {
        seedDefaultTemplates(currentUser.uid);
      } else {
        setTemplates(list);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  const seedDefaultTemplates = async (userId: string) => {
    const batch = writeBatch(db);
    const defaults: Omit<MessageTemplate, "id">[] = [
      {
        userId,
        type: "sms_single",
        name: "SMS افتراضي",
        isActive: true,
        isDefault: true,
        content: `مرحباً {اللقب} {الاسم}،\nتم تحديث حسابكم في الدفتر الآمن.\nتم إضافة {المبلغ_المضاف} ر.ي {اتجاه_الاضافة} — البيان: {بيان_العملية}.\nالرصيد الحالي: {الرصيد_الحالي} ر.ي {اتجاه_الرصيد}`,
        createdAt: new Date() as any
      },
      {
        userId,
        type: "wa_single",
        name: "واتساب عملية واحدة افتراضي",
        isActive: true,
        isDefault: true,
        content: `مرحباً {اللقب} {الاسم}،\n\nتم تحديث حسابكم في الدفتر الآمن:\n\n• الرصيد السابق: {الرصيد_السابق}\n• تم إضافة: {المبلغ_المضاف} ر.ي {اتجاه_الاضافة}\n• البيان: {بيان_العملية}\n• الرصيد الحالي: {الرصيد_الحالي} {اتجاه_الرصيد}\n\nشكراً لتعاملكم معنا.`,
        createdAt: new Date() as any
      },
      {
        userId,
        type: "wa_multiple",
        name: "واتساب عمليات متعددة افتراضي",
        isActive: true,
        isDefault: true,
        content: `مرحباً {اللقب} {الاسم}،\n\nتم إضافة {عدد_العمليات} عمليات جديدة في حسابكم:\n\n{العمليات_المتعددة}------------------------\nالرصيد الإجمالي الحالي: {الرصيد_الحالي} {اتجاه_الرصيد}\n\nنسعد بخدمتكم، وشكراً لثقتكم.`,
        createdAt: new Date() as any
      },
      {
        userId,
        type: "wa_all",
        name: "واتساب كشف شامل افتراضي",
        isActive: true,
        isDefault: true,
        content: `مرحباً {اللقب} {الاسم}،\n\nسجل العمليات:\n\n{العمليات_المتعددة}------------------------\nالرصيد الإجمالي الحالي: {الرصيد_الحالي} {اتجاه_الرصيد}\n\nنسعد بخدمتكم، وشكراً لثقتكم.`,
        createdAt: new Date() as any
      },
      {
        userId,
        type: "market_rawi",
        name: "تصفية الرعوي الافتراضي",
        isActive: true,
        isDefault: true,
        content: `*تصفية وتفريغ شحنة الأخ / {الاسم}*\n📅 *التاريخ:* {التاريخ}\n📦 *إجمالي المورد:* {إجمالي_الكمية} بسعر {سعر_الوحدة}\n--------------------------------\n*تفاصيل التوزيع:*\n{تفاصيل_المقاوتة}\n--------------------------------\n💵 *صافي المستحق (خالص):* {صافي_الرعوي} ريال\n\nشاكرين تعاملكم.`,
        createdAt: new Date() as any
      },
      {
        userId,
        type: "market_mqawet",
        name: "كشف حساب المقوت الافتراضي",
        isActive: true,
        isDefault: true,
        content: `*كشف حساب الأخ / {الاسم}*\nتحية طيبة، تفاصيل مسحوباتكم كالتالي:\n--------------------------------\n{تفاصيل_المقاوتة}--------------------------------\n💰 *الرصيد الإجمالي المطلوب سداده:* {إجمالي_المطلوب} ريال\nشاكرين حسن تعاونكم.`,
        createdAt: new Date() as any
      }
    ];

    defaults.forEach(t => {
      const ref = doc(collection(db, "message_templates"));
      batch.set(ref, t);
    });

    await batch.commit();
  };

  const handleOpenAdd = () => {
    setEditingId("");
    setFormName("");
    setFormContent("");
    setFormType(activeTab);
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (t: MessageTemplate) => {
    setEditingId(t.id);
    setFormName(t.name);
    setFormContent(t.content);
    setFormType(t.type);
    setFormIsActive(t.isActive);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string, isDefault: boolean) => {
    if (isDefault) {
      alert("لا يمكن حذف القالب الافتراضي المباشر.");
      return;
    }
    if (window.confirm("هل أنت متأكد من حذف القالب؟")) {
      await deleteDoc(doc(db, "message_templates", id));
    }
  };

  const handleSetDefault = async (t: MessageTemplate) => {
    if (t.isDefault) return;
    const sameType = templates.filter(x => x.type === t.type);
    const batch = writeBatch(db);
    sameType.forEach(x => {
      batch.update(doc(db, "message_templates", x.id), { isDefault: x.id === t.id });
    });
    await batch.commit();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formContent.trim()) {
      alert("الاسم والمحتوى مطلوبان.");
      return;
    }
    setIsSaving(true);
    try {
      const data: any = {
        name: formName.trim(),
        content: formContent.trim(),
        type: formType,
        isActive: formIsActive,
        updatedAt: serverTimestamp()
      };

      if (editingId) {
        await updateDoc(doc(db, "message_templates", editingId), data);
      } else {
        const isFirstOfType = !templates.some(x => x.type === formType);
        data.userId = currentUser.uid;
        data.isDefault = isFirstOfType;
        data.createdAt = serverTimestamp();
        await addDoc(collection(db, "message_templates"), data);
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء الحفظ");
    } finally {
      setIsSaving(false);
    }
  };

  const insertVar = (code: string) => {
    setFormContent(prev => prev + code);
  };

  const filteredTemplates = templates.filter(t => t.type === activeTab);

  return (
    <div className="p-5 select-none" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-600 to-blue-700 rounded-3xl p-6 text-white shadow-lg mb-6 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black mb-1 flex items-center gap-2">
              <MessageSquare size={24} />
              قوالب الرسائل
            </h2>
            <p className="text-indigo-100 text-sm font-bold">تخصيص نصوص التواصل التلقائية</p>
          </div>
          <button
            onClick={handleOpenAdd}
            className="w-12 h-12 bg-white text-indigo-600 rounded-2xl flex items-center justify-center shadow-lg hover:scale-105 transition cursor-pointer"
          >
            <Plus size={24} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2 mb-4 scrollbar-hide">
        {TEMPLATE_TYPES.map(type => (
          <button
            key={type.value}
            onClick={() => setActiveTab(type.value)}
            className={`px-4 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition ${activeTab === type.value ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200"}`}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center text-slate-400 py-10 font-bold">جاري التحميل...</div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center text-slate-400 py-10 font-bold">لا توجد قوالب مخصصة لهذا النوع</div>
        ) : (
          filteredTemplates.map(t => (
            <div key={t.id} className={`bg-white rounded-2xl p-4 border ${t.isDefault ? "border-indigo-500 shadow-sm" : "border-slate-200"}`}>
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-black text-slate-800 flex items-center gap-2">
                    {t.name}
                    {t.isDefault && <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">الافتراضي</span>}
                    {!t.isActive && <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full">معطل</span>}
                  </h3>
                </div>
                <div className="flex gap-2">
                  {!t.isDefault && (
                    <button onClick={() => handleSetDefault(t)} className="p-1.5 text-slate-400 hover:text-emerald-600 bg-slate-50 hover:bg-emerald-50 rounded-lg transition" title="تعيين كافتراضي">
                      <CheckCircle size={16} />
                    </button>
                  )}
                  <button onClick={() => handleOpenEdit(t)} className="p-1.5 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded-lg transition">
                    <Edit2 size={16} />
                  </button>
                  {!t.isDefault && (
                    <button onClick={() => handleDelete(t.id, t.isDefault)} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded-lg transition">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap text-sm text-slate-600 font-medium">
                {t.content}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-lg rounded-[2rem] overflow-hidden shadow-2xl relative z-10 p-6 max-h-[90vh] flex flex-col"
              dir="rtl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-black text-slate-800">
                  {editingId ? "تعديل القالب" : "إضافة قالب جديد"}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full transition">
                  <X size={20} />
                </button>
              </div>

              <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar">
                <form id="templateForm" onSubmit={handleSave} className="space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">النوع</label>
                    <select
                      value={formType}
                      onChange={e => setFormType(e.target.value as TemplateType)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none focus:border-indigo-500"
                    >
                      {TEMPLATE_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">اسم القالب المرجعي</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      placeholder="مثال: فاتورة رسمية"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-bold focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block text-sm font-bold text-slate-700">محتوى الرسالة</label>
                      {formType.startsWith("sms") && (
                        <span className="text-xs font-bold text-slate-400" dir="ltr">
                          {formContent.length} chars
                        </span>
                      )}
                    </div>
                    <textarea
                      value={formContent}
                      onChange={e => setFormContent(e.target.value)}
                      rows={6}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-medium focus:outline-none focus:border-indigo-500 text-sm"
                      placeholder="اكتب رسالتك هنا واستخدم المتغيرات..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">المتغيرات المتاحة للاستخدام</label>
                    <div className="flex flex-wrap gap-2">
                      {AVAILABLE_VARIABLES.map(v => (
                        <button
                          key={v.code}
                          type="button"
                          onClick={() => insertVar(v.code)}
                          title={v.desc}
                          className="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-bold transition"
                        >
                          {v.code}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer mt-2">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={e => setFormIsActive(e.target.checked)}
                      className="w-5 h-5 text-indigo-600 rounded"
                    />
                    <span className="text-sm font-bold text-slate-700">تفعيل القالب</span>
                  </label>
                </form>
              </div>

              <div className="pt-4 border-t border-slate-100 mt-4 flex gap-3">
                <button
                  type="submit"
                  form="templateForm"
                  disabled={isSaving}
                  className="flex-2 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition"
                >
                  <Save size={18} />
                  {isSaving ? "جاري الحفظ..." : "حفظ القالب"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
