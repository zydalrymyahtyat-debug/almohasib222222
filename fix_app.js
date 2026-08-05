import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Add historyStackRef
code = code.replace(
`  const currentViewRef = useRef(currentView);
  const sidebarOpenRef = useRef(sidebarOpen);

  useEffect(() => {
    currentViewRef.current = currentView;
    sidebarOpenRef.current = sidebarOpen;
  }, [currentView, sidebarOpen]);`,
`  const currentViewRef = useRef(currentView);
  const sidebarOpenRef = useRef(sidebarOpen);
  const historyStackRef = useRef(historyStack);

  useEffect(() => {
    currentViewRef.current = currentView;
    sidebarOpenRef.current = sidebarOpen;
    historyStackRef.current = historyStack;
  }, [currentView, sidebarOpen, historyStack]);`
);

// Fix performBack
code = code.replace(
`      if (currentViewRef.current !== "dashboard") {
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
      }`,
`      if (currentViewRef.current !== "dashboard") {
        const hStack = historyStackRef.current;
        if (hStack.length > 0) {
          const prev = hStack[hStack.length - 1];
          setCurrentView(prev.view);
          setViewTitle(prev.title);
          setSelectedPersonId(prev.selectedPersonId || "");
          setActiveSection(prev.section || "");
          setHistoryStack(hStack.slice(0, -1));
        } else {
          setCurrentView("dashboard");
          setViewTitle("الرئيسية");
          setSelectedPersonId("");
          setActiveSection("");
          setHistoryStack([]);
        }
        return true; // prevent exit
      }`
);

fs.writeFileSync('src/App.tsx', code);
