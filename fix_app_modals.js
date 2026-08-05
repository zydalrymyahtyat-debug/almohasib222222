import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
`  const currentViewRef = useRef(currentView);
  const sidebarOpenRef = useRef(sidebarOpen);
  const historyStackRef = useRef(historyStack);

  useEffect(() => {
    currentViewRef.current = currentView;
    sidebarOpenRef.current = sidebarOpen;
    historyStackRef.current = historyStack;
  }, [currentView, sidebarOpen, historyStack]);`,
`  const currentViewRef = useRef(currentView);
  const sidebarOpenRef = useRef(sidebarOpen);
  const historyStackRef = useRef(historyStack);
  const modalsRef = useRef({ ann: showAnnModal, overdue: showOverdueModal });

  useEffect(() => {
    currentViewRef.current = currentView;
    sidebarOpenRef.current = sidebarOpen;
    historyStackRef.current = historyStack;
    modalsRef.current = { ann: showAnnModal, overdue: showOverdueModal };
  }, [currentView, sidebarOpen, historyStack, showAnnModal, showOverdueModal]);`
);

code = code.replace(
`    const performBack = () => {
      if (sidebarOpenRef.current) {
        setSidebarOpen(false);
        return true; // prevent exit
      }`,
`    const performBack = () => {
      if (modalsRef.current.ann) {
        setShowAnnModal(false);
        return true;
      }
      if (modalsRef.current.overdue) {
        setShowOverdueModal(false);
        return true;
      }
      if (sidebarOpenRef.current) {
        setSidebarOpen(false);
        return true; // prevent exit
      }`
);

fs.writeFileSync('src/App.tsx', code);
