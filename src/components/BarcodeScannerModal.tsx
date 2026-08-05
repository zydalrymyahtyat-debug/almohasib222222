import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { X, Camera } from "lucide-react";

interface Props {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

export default function BarcodeScannerModal({ onScan, onClose }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    let html5QrCode: Html5Qrcode;
    let isMounted = true;

    Html5Qrcode.getCameras().then(devices => {
      if (!isMounted) return;
      if (devices && devices.length) {
        html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;
        
        // prefer back camera
        const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
        const cameraId = backCamera ? backCamera.id : devices[0].id;

        html5QrCode.start(
          cameraId,
          {
            fps: 10,
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            if (scannerRef.current) {
              scannerRef.current.stop().then(() => {
                scannerRef.current?.clear();
                onScan(decodedText);
              }).catch(console.error);
            }
          },
          () => {} // ignore frame errors
        ).catch(err => {
          console.error("Failed to start camera:", err);
          if (isMounted) setErrorMsg("تعذر تشغيل الكاميرا. يرجى التحقق من الصلاحيات.");
        });
      } else {
        if (isMounted) setErrorMsg("لم يتم العثور على كاميرا في جهازك.");
      }
    }).catch(err => {
      console.error("Error getting cameras:", err);
      if (isMounted) setErrorMsg("يرجى منح صلاحية الكاميرا للتطبيق لقراءة الباركود.");
    });

    return () => {
      isMounted = false;
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().then(() => {
          scannerRef.current?.clear();
        }).catch(console.error);
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/90  p-4">
      <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 left-4 p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full z-10">
          <X size={20} />
        </button>
        <h2 className="text-xl font-black text-slate-800 mb-6 text-center">امسح الباركود</h2>
        
        <div className="w-full overflow-hidden rounded-2xl bg-slate-100 flex flex-col items-center justify-center min-h-[300px] relative">
          {errorMsg ? (
            <div className="text-center p-6 z-10 relative">
              <Camera size={48} className="text-slate-300 mx-auto mb-4" />
              <p className="text-sm font-bold text-red-500">{errorMsg}</p>
            </div>
          ) : null}
          <div id="reader" className={`w-full h-full absolute inset-0 ${errorMsg ? 'opacity-0' : 'opacity-100'}`} />
        </div>
        
        <p className="text-xs font-bold text-slate-500 text-center mt-4">قم بتوجيه الكاميرا نحو الباركود لقراءته تلقائياً</p>
      </div>
    </div>
  );
}
