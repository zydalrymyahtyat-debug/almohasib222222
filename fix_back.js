import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Replace the performBack and CapApp.addListener block
code = code.replace(
`    const performBack = () => {
      if (sidebarOpenRef.current) {
        setSidebarOpen(false);
        return;
      }
      if (typeof (window as any).customBackHandler === "function") {
        (window as any).customBackHandler();
        return;
      }
      if (currentViewRef.current !== "dashboard") {
        // Reproduce handleGoBack
        setHistoryStack((prevStack) => {
          if (prevStack.length > 0) {
            const prev = prevStack[prevStack.length - 1];
            setCurrentView(prev.view);
            setViewTitle(prev.title);
            setSelectedPersonId(prev.selectedPersonId || "");
            setActiveSection(prev.section || "");
            return prevStack.slice(0, -1);
          } else {
            setCurrentView("dashboard");
            setViewTitle("الرئيسية");
            setSelectedPersonId("");
            setActiveSection("");
            return prevStack;
          }
        });
      } else {
        const now = Date.now();
        if (now - lastBackPressed < 2000) {
          CapApp.exitApp();
        } else {
          lastBackPressed = now;
          
          // Show non-blocking arabic toast prompt
          const toast = document.createElement("div");
          toast.className = "fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white font-bold text-xs px-5 py-3 rounded-full z-50 animate-bounce shadow-xl";
          toast.innerText = "اضغط مرة أخرى للخروج من التطبيق";
          document.body.appendChild(toast);
          setTimeout(() => toast.remove(), 2000);
        }
      }
    };

    const backListener = CapApp.addListener("backButton", performBack);

    return () => {
      backListener.then((h) => h.remove());
    };
  }, []);`,
`    const performBack = () => {
      if (sidebarOpenRef.current) {
        setSidebarOpen(false);
        return true; // prevent exit
      }
      if (typeof (window as any).customBackHandler === "function") {
        (window as any).customBackHandler();
        return true; // prevent exit
      }
      if (currentViewRef.current !== "dashboard") {
        setHistoryStack((prevStack) => {
          if (prevStack.length > 0) {
            const prev = prevStack[prevStack.length - 1];
            setCurrentView(prev.view);
            setViewTitle(prev.title);
            setSelectedPersonId(prev.selectedPersonId || "");
            setActiveSection(prev.section || "");
            return prevStack.slice(0, -1);
          } else {
            setCurrentView("dashboard");
            setViewTitle("الرئيسية");
            setSelectedPersonId("");
            setActiveSection("");
            return prevStack;
          }
        });
        return true; // prevent exit
      }
      return false; // allow exit logic
    };

    const handleHardwareBack = () => {
      const prevented = performBack();
      if (!prevented) {
        const now = Date.now();
        if (now - lastBackPressed < 2000) {
          CapApp.exitApp();
        } else {
          lastBackPressed = now;
          const toast = document.createElement("div");
          toast.className = "fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white font-bold text-xs px-5 py-3 rounded-full z-50 animate-bounce shadow-xl";
          toast.innerText = "اضغط مرة أخرى للخروج من التطبيق";
          document.body.appendChild(toast);
          setTimeout(() => toast.remove(), 2000);
        }
      }
    };

    const backListener = CapApp.addListener("backButton", handleHardwareBack);
    
    // For PWA (Browser back button = Mobile hardware back)
    const handlePopState = (e: PopStateEvent) => {
      const prevented = performBack();
      if (prevented) {
        window.history.pushState(null, "", window.location.href);
      }
    };
    
    window.addEventListener("popstate", handlePopState);
    
    return () => {
      backListener.then((h) => h.remove());
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Sync PWA history state
  useEffect(() => {
    if (historyStack.length > 0) {
      window.history.pushState(null, "", window.location.href);
    }
  }, [historyStack.length]);
`
);

fs.writeFileSync('src/App.tsx', code);
