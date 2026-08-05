import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Delete, Copy, Check } from "lucide-react";

interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CalculatorModal({ isOpen, onClose }: CalculatorModalProps) {
  const [display, setDisplay] = useState("0");
  const [equation, setEquation] = useState("");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(display);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNum = (num: string) => {
    if (display === "0" || display === "Error") {
      setDisplay(num);
    } else {
      setDisplay(display + num);
    }
  };

  const handleOp = (op: string) => {
    setEquation(display + " " + op + " ");
    setDisplay("0");
  };

  const calculate = () => {
    try {
      // Very basic eval alternative for simple math
      const evalString = (equation + display).replace(/×/g, "*").replace(/÷/g, "/");

      // Security fix: strictly validate the string before evaluation
      // only allow numbers, basic math operators, spaces, and periods
      if (/[^0-9+\-*/. ]/.test(evalString)) {
        throw new Error("Invalid characters in expression");
      }

      // eslint-disable-next-line no-new-func
      const result = new Function('return ' + evalString)();
      setDisplay(String(Number(result.toFixed(4))));
      setEquation("");
    } catch (e) {
      setDisplay("Error");
      setEquation("");
    }
  };

  const clear = () => {
    setDisplay("0");
    setEquation("");
  };

  const backspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay("0");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/60  z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-slate-100"
            dir="ltr"
          >
            <div className="p-4 bg-slate-50 flex justify-between items-center border-b border-slate-100" dir="rtl">
              <h3 className="font-bold text-slate-700">آلة حاسبة</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg transition"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span className="text-xs font-bold">{copied ? 'تم النسخ' : 'نسخ الناتج'}</span>
                </button>
                <button onClick={onClose} className="p-2 bg-slate-200/50 hover:bg-slate-200 rounded-full text-slate-500 transition">
                  <X size={18} />
                </button>
              </div>
            </div>
            
            <div className="p-6 bg-slate-800 text-right relative overflow-hidden">
              <div className="text-slate-400 h-6 text-sm font-mono tracking-wider">{equation}</div>
              <div className="text-4xl text-white font-bold font-mono tracking-wider mt-1 truncate">{display}</div>

              <AnimatePresence>
                {copied && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute bottom-2 left-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full"
                  >
                    تم النسخ
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="p-4 grid grid-cols-4 gap-3 bg-slate-100">
              <button onClick={clear} className="col-span-2 p-4 bg-red-100 text-red-600 font-bold rounded-2xl active:scale-95 transition">AC</button>
              <button onClick={backspace} className="p-4 bg-slate-200 text-slate-700 font-bold rounded-2xl active:scale-95 transition flex justify-center items-center">
                <Delete size={20} />
              </button>
              <button onClick={() => handleOp("÷")} className="p-4 bg-indigo-100 text-indigo-600 font-bold text-xl rounded-2xl active:scale-95 transition">÷</button>
              
              <button onClick={() => handleNum("7")} className="p-4 bg-white text-slate-800 font-bold text-xl rounded-2xl active:scale-95 transition shadow-sm">7</button>
              <button onClick={() => handleNum("8")} className="p-4 bg-white text-slate-800 font-bold text-xl rounded-2xl active:scale-95 transition shadow-sm">8</button>
              <button onClick={() => handleNum("9")} className="p-4 bg-white text-slate-800 font-bold text-xl rounded-2xl active:scale-95 transition shadow-sm">9</button>
              <button onClick={() => handleOp("×")} className="p-4 bg-indigo-100 text-indigo-600 font-bold text-xl rounded-2xl active:scale-95 transition">×</button>
              
              <button onClick={() => handleNum("4")} className="p-4 bg-white text-slate-800 font-bold text-xl rounded-2xl active:scale-95 transition shadow-sm">4</button>
              <button onClick={() => handleNum("5")} className="p-4 bg-white text-slate-800 font-bold text-xl rounded-2xl active:scale-95 transition shadow-sm">5</button>
              <button onClick={() => handleNum("6")} className="p-4 bg-white text-slate-800 font-bold text-xl rounded-2xl active:scale-95 transition shadow-sm">6</button>
              <button onClick={() => handleOp("-")} className="p-4 bg-indigo-100 text-indigo-600 font-bold text-xl rounded-2xl active:scale-95 transition">-</button>
              
              <button onClick={() => handleNum("1")} className="p-4 bg-white text-slate-800 font-bold text-xl rounded-2xl active:scale-95 transition shadow-sm">1</button>
              <button onClick={() => handleNum("2")} className="p-4 bg-white text-slate-800 font-bold text-xl rounded-2xl active:scale-95 transition shadow-sm">2</button>
              <button onClick={() => handleNum("3")} className="p-4 bg-white text-slate-800 font-bold text-xl rounded-2xl active:scale-95 transition shadow-sm">3</button>
              <button onClick={() => handleOp("+")} className="p-4 bg-indigo-100 text-indigo-600 font-bold text-xl rounded-2xl active:scale-95 transition">+</button>
              
              <button onClick={() => handleNum("0")} className="col-span-2 p-4 bg-white text-slate-800 font-bold text-xl rounded-2xl active:scale-95 transition shadow-sm">0</button>
              <button onClick={() => handleNum(".")} className="p-4 bg-white text-slate-800 font-bold text-xl rounded-2xl active:scale-95 transition shadow-sm">.</button>
              <button onClick={calculate} className="p-4 bg-indigo-500 text-white font-bold text-xl rounded-2xl active:scale-95 transition shadow-md shadow-indigo-500/30">=</button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
