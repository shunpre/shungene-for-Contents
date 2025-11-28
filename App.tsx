
import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { UploadSection } from './components/UploadSection';
import { AnalysisResult } from './components/AnalysisResult';
import { SwipeLPPreview } from './components/SwipeLPPreview';
import { UploadedFile, ProductProfile, AppState, SwipeLP, SwipeScreen, DesignSpec } from './types';
import { analyzeProductContext, generateSwipeLP, regenerateSwipeScreen, generateSingleDesignSpec, regenerateDesignSpec, generateSwipeScreenImage } from './services/geminiService';
import { AlertCircle, Sparkles, Loader2, Key, Layers, PenTool, Image as ImageIcon } from 'lucide-react';

const App: React.FC = () => {
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [apiKey, setApiKey] = useState<string>('');
  const [inputApiKey, setInputApiKey] = useState<string>('');
  const [isCheckingKey, setIsCheckingKey] = useState<boolean>(true);

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [productProfile, setProductProfile] = useState<ProductProfile | null>(null);
  const [swipeLP, setSwipeLP] = useState<SwipeLP | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Visual Phase State (Tracks current screen being processed)
  const [visualProgressIndex, setVisualProgressIndex] = useState<number>(-1);

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    setIsCheckingKey(true);
    // 1. Check AI Studio environment
    if (window.aistudio && window.aistudio.hasSelectedApiKey) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(hasKey);
    }
    // 2. Check Local Storage
    else {
      const storedKey = localStorage.getItem('gemini_api_key');
      if (storedKey) {
        setApiKey(storedKey);
        setHasApiKey(true);
      } else {
        setHasApiKey(false);
      }
    }
    setIsCheckingKey(false);
  };

  const handleSelectKey = async () => {
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    } else {
      // Focus on input if available (handled by UI state)
      console.warn("API Key selection is not available in this environment. Use manual input.");
    }
  };

  const handleSaveApiKey = () => {
    if (!inputApiKey.trim()) return;
    localStorage.setItem('gemini_api_key', inputApiKey.trim());
    setApiKey(inputApiKey.trim());
    setHasApiKey(true);
  };

  const handleClearApiKey = () => {
    localStorage.removeItem('gemini_api_key');
    setApiKey('');
    setHasApiKey(false);
    setInputApiKey('');
  };

  const handleFilesAdded = (newFiles: UploadedFile[]) => {
    setFiles(prev => [...prev, ...newFiles]);
  };

  const handleFileRemoved = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleFileUpdated = (id: string, updates: Partial<UploadedFile>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const handleAnalyze = async () => {
    if (files.length === 0) return;
    if (!hasApiKey) {
      alert("APIキーが必要です。");
      return;
    }

    setAppState(AppState.ANALYZING);
    setError(null);
    setProductProfile(null);
    setSwipeLP(null);
    setVisualProgressIndex(-1);

    try {
      const profile = await analyzeProductContext(files, apiKey);
      setProductProfile(profile);
      setAppState(AppState.ANALYSIS_COMPLETE);
    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes("Requested entity was not found")) {
        setHasApiKey(false);
        setError("APIキーが無効または選択されていません。キーを再選択してください。");
      } else {
        setError(err.message || "製品データの分析に失敗しました。もう一度お試しください。");
      }
      setAppState(AppState.ERROR);
    }
  };

  const handleGenerateLP = async () => {
    if (!productProfile) return;

    setAppState(AppState.GENERATING_LP);
    setError(null);
    setVisualProgressIndex(-1);

    try {
      const lp = await generateSwipeLP(productProfile, apiKey);
      setSwipeLP(lp);
      setAppState(AppState.LP_CREATED);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "LPの生成に失敗しました。");
      setAppState(AppState.ANALYSIS_COMPLETE);
    }
  };

  const handleStartVisualPhase = async () => {
    // Check API Key strictly
    let isKeyValid = hasApiKey;
    if (window.aistudio && window.aistudio.hasSelectedApiKey) {
      isKeyValid = await window.aistudio.hasSelectedApiKey();
      setHasApiKey(isKeyValid);
    }

    if (!isKeyValid) {
      alert("画像の生成にはAPIキーの設定が必須です。\n次の画面でAPIキーを選択・接続してください。");
      return;
    }

    if (!swipeLP || !Array.isArray(swipeLP.screens)) return;

    setAppState(AppState.GENERATING_VISUALS);
    setVisualProgressIndex(0);
    setError(null);

    // Use a copy of screens to update state incrementally
    // We cannot just mutate local variable, we need to update state to trigger re-renders
    let currentScreens = [...swipeLP.screens];

    // Sequential Generation: Design -> Image for each screen
    for (let i = 0; i < currentScreens.length; i++) {
      setVisualProgressIndex(i);

      // Safety check to ensure we are working with valid objects
      if (!currentScreens[i]) continue;

      try {
        // 1. Design Spec Generation
        if (!currentScreens[i].designSpec) {
          const spec = await generateSingleDesignSpec(currentScreens[i], currentScreens, files, swipeLP.concept, apiKey);
          currentScreens[i] = { ...currentScreens[i], designSpec: spec };

          // Update state immediately so user sees progress
          setSwipeLP(prev => {
            if (!prev || !prev.screens) return null;
            const updated = [...prev.screens];
            updated[i] = currentScreens[i];
            return { ...prev, screens: updated };
          });
        }

        // 2. Image Generation
        if (!currentScreens[i].imageData && currentScreens[i].designSpec) {
          const base64Image = await generateSwipeScreenImage(currentScreens[i], files, apiKey);
          currentScreens[i] = { ...currentScreens[i], imageData: base64Image };

          // Update state immediately
          setSwipeLP(prev => {
            if (!prev || !prev.screens) return null;
            const updated = [...prev.screens];
            updated[i] = currentScreens[i];
            return { ...prev, screens: updated };
          });
        }

      } catch (e: any) {
        console.error(`Error processing visual for screen ${i + 1}`, e);
        // Optionally continue or stop. Continuing allows partial completion.
        setError(`スライド ${i + 1} の生成中にエラーが発生しましたが、処理を継続します: ${e.message}`);
      }

      // Add a small delay to respect API rate limits (10 RPM)
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    setVisualProgressIndex(-1);
    setAppState(AppState.VISUALS_COMPLETE);
  };

  const handleUpdateScreen = (index: number, updatedScreen: SwipeScreen) => {
    if (!swipeLP || !Array.isArray(swipeLP.screens)) return;
    setSwipeLP(prev => {
      if (!prev) return null;
      const newScreens = [...prev.screens];
      newScreens[index] = updatedScreen;
      return { ...prev, screens: newScreens };
    });
  };

  const handleRegenerateScreen = async (index: number, instruction: string) => {
    if (!swipeLP || !Array.isArray(swipeLP.screens) || !productProfile) return;
    const originalScreen = swipeLP.screens[index];
    try {
      const newScreen = await regenerateSwipeScreen(productProfile, originalScreen, instruction, apiKey);
      // Keep existing visual data
      newScreen.order = originalScreen.order;
      newScreen.designSpec = originalScreen.designSpec;
      newScreen.imageData = originalScreen.imageData;
      newScreen.history = originalScreen.history;

      handleUpdateScreen(index, newScreen);
      return newScreen;
    } catch (err: any) {
      console.error("Regeneration failed", err);
      throw err;
    }
  };

  // Logic to regenerate Design AND Image
  const handleRegenerateVisual = async (index: number, instruction: string) => {
    if (!swipeLP || !Array.isArray(swipeLP.screens)) return;
    const screen = swipeLP.screens[index];

    // Save current state to history before regenerating
    const currentHistory = screen.history || [];
    const historyEntry = {
      designSpec: screen.designSpec,
      imageData: screen.imageData,
      timestamp: Date.now()
    };

    try {
      // 1. Regenerate Design Spec
      const newSpec = await regenerateDesignSpec(screen, files, instruction, apiKey);

      let updatedScreen: SwipeScreen = {
        ...screen,
        designSpec: newSpec,
        history: [...currentHistory, historyEntry] // Append history
      };

      // Update UI with new spec (image is still old or cleared?) 
      // Let's clear image to show it's regenerating
      updatedScreen.imageData = undefined;
      handleUpdateScreen(index, updatedScreen);

      // 2. Regenerate Image immediately
      const base64Image = await generateSwipeScreenImage(updatedScreen, files, apiKey);
      updatedScreen = { ...updatedScreen, imageData: base64Image };
      handleUpdateScreen(index, updatedScreen);

      return newSpec;
    } catch (err: any) {
      console.error("Visual Regeneration failed", err);
      // If failed, maybe revert? For now just throw
      throw err;
    }
  }

  const handleUndoVisual = (index: number) => {
    if (!swipeLP || !Array.isArray(swipeLP.screens)) return;
    const screen = swipeLP.screens[index];

    if (!screen.history || screen.history.length === 0) return;

    const newHistory = [...screen.history];
    const lastState = newHistory.pop(); // Remove last state

    if (lastState) {
      const restoredScreen: SwipeScreen = {
        ...screen,
        designSpec: lastState.designSpec,
        imageData: lastState.imageData,
        history: newHistory
      };
      handleUpdateScreen(index, restoredScreen);
    }
  };

  if (isCheckingKey) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="w-8 h-8 text-indigo-600 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 font-sans">
      <Header onApiKeyClick={handleClearApiKey} />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-10">

        {!hasApiKey && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center shadow-sm max-w-2xl mx-auto animate-in fade-in slide-in-from-top-4">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Key className="w-6 h-6 text-amber-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">APIキーの設定が必要です</h3>
            <p className="text-gray-600 mb-6">Gemini APIを使用するにはキーを入力してください。</p>

            {window.aistudio && window.aistudio.openSelectKey ? (
              <button onClick={handleSelectKey} className="px-6 py-3 bg-gray-900 text-white font-bold rounded-lg hover:bg-gray-800 transition-colors shadow-md">
                APIキーを選択・接続する (AI Studio)
              </button>
            ) : (
              <div className="flex flex-col gap-3 max-w-md mx-auto">
                <input
                  type="password"
                  placeholder="Gemini API Key (AI Studioで取得)"
                  className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  value={inputApiKey}
                  onChange={(e) => setInputApiKey(e.target.value)}
                />
                <button
                  onClick={handleSaveApiKey}
                  disabled={!inputApiKey}
                  className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  APIキーを保存して開始
                </button>
                <p className="text-xs text-gray-400 mt-2">
                  ※キーはブラウザのローカルストレージにのみ保存されます。<br />
                  <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-600">
                    APIキーをまだ持っていない場合はこちら
                  </a>
                </p>
              </div>
            )}
          </div>
        )}

        {hasApiKey && (
          <>
            <div className="text-center">
              <h2 className="text-3xl font-bold text-gray-900 mb-4 tracking-tight">瞬ジェネforコンテンツ</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                資料をアップロードして「分析」→「コピー生成」→「コンテンツ作成」の3ステップで、売れるスワイプLPを構築します。
              </p>
            </div>

            <PhaseStepper currentAppState={appState} />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className={`col-span-1 lg:col-span-${productProfile ? '5' : '12'} transition-all duration-500`}>
                <UploadSection
                  files={files}
                  onFilesAdded={handleFilesAdded}
                  onFileRemoved={handleFileRemoved}
                  onFileUpdated={handleFileUpdated}
                  onAnalyze={handleAnalyze}
                  isAnalyzing={appState === AppState.ANALYZING}
                />

                {error && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                )}
              </div>

              {productProfile && (
                <div className="col-span-1 lg:col-span-7 space-y-6">
                  <AnalysisResult profile={productProfile} />

                  {appState === AppState.ANALYSIS_COMPLETE && (
                    <div className="bg-gradient-to-r from-indigo-50 to-blue-50 p-6 rounded-xl border border-indigo-100 flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4">
                      <div>
                        <h3 className="font-bold text-indigo-900">Step 2: コピー構成案の作成</h3>
                        <p className="text-sm text-indigo-700">製品プロファイルを元にシナリオを設計します。</p>
                      </div>
                      <button
                        onClick={handleGenerateLP}
                        className="group relative inline-flex items-center justify-center px-6 py-3 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-all shadow-md hover:shadow-lg whitespace-nowrap"
                      >
                        <Sparkles className="w-4 h-4 mr-2 text-yellow-300" />
                        LP構成案を生成する
                      </button>
                    </div>
                  )}

                  {appState === AppState.GENERATING_LP && (
                    <div className="bg-white p-8 rounded-xl border border-gray-200 text-center space-y-4 shadow-sm">
                      <div className="flex justify-center"><Loader2 className="w-10 h-10 text-indigo-600 animate-spin" /></div>
                      <h3 className="font-bold text-gray-900">AIが構成案を作成中...</h3>
                      <p className="text-sm text-gray-500">スワイプLPの成功法則に基づいて構成を考えています。</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {swipeLP && (
              <div className="border-t border-gray-200 pt-10 animate-in fade-in slide-in-from-bottom-8">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    {appState === AppState.LP_CREATED ? '生成されたスワイプLP構成案' :
                      appState === AppState.GENERATING_VISUALS ? 'ビジュアルコンテンツ生成中...' :
                        '最終コンテンツ確認'}
                  </h2>

                  {appState === AppState.LP_CREATED && (
                    <button
                      onClick={handleStartVisualPhase}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-bold shadow-md hover:shadow-lg transition-all animate-pulse"
                    >
                      <ImageIcon className="w-4 h-4 text-white" />
                      Step 3: ビジュアルコンテンツを作成 (順次)
                    </button>
                  )}
                </div>

                <SwipeLPPreview
                  lpData={swipeLP}
                  appState={appState}
                  visualProgressIndex={visualProgressIndex}
                  onUpdateScreen={handleUpdateScreen}
                  onRegenerateScreen={handleRegenerateScreen}
                  onRegenerateVisual={handleRegenerateVisual}
                  onUndoVisual={handleUndoVisual}
                />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

const PhaseStepper: React.FC<{ currentAppState: AppState }> = ({ currentAppState }) => {
  const steps = [
    { id: 1, name: '分析', icon: Layers, activeStates: [AppState.ANALYZING, AppState.ANALYSIS_COMPLETE, AppState.GENERATING_LP, AppState.LP_CREATED, AppState.GENERATING_VISUALS, AppState.VISUALS_COMPLETE] },
    { id: 2, name: 'コピー', icon: Sparkles, activeStates: [AppState.LP_CREATED, AppState.GENERATING_VISUALS, AppState.VISUALS_COMPLETE] },
    { id: 3, name: 'ビジュアル', icon: ImageIcon, activeStates: [AppState.VISUALS_COMPLETE] }
  ];

  const getCurrentStepIndex = () => {
    if (currentAppState === AppState.VISUALS_COMPLETE) return 2;
    if (currentAppState === AppState.GENERATING_VISUALS) return 1.5; // In between
    if (currentAppState === AppState.LP_CREATED) return 1;
    if (currentAppState === AppState.GENERATING_LP) return 0.5;
    if (currentAppState === AppState.ANALYSIS_COMPLETE) return 0;
    return 0;
  };

  const currentIndex = getCurrentStepIndex();

  return (
    <div className="w-full max-w-4xl mx-auto mb-8">
      <div className="relative flex justify-between">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -z-10 rounded-full" />
        <div
          className="absolute top-1/2 left-0 h-1 bg-indigo-600 -z-10 rounded-full transition-all duration-500 ease-in-out"
          style={{ width: `${Math.min((currentIndex / (steps.length - 1)) * 100, 100)}%` }}
        />

        {steps.map((step, idx) => {
          const isActive = idx <= Math.floor(currentIndex);
          const isCurrent = idx === Math.floor(currentIndex) || (idx === steps.length - 1 && currentIndex >= steps.length - 1);
          const isProcessing = idx === Math.ceil(currentIndex) && currentIndex % 1 !== 0;

          return (
            <div key={step.id} className="flex flex-col items-center bg-gray-50 px-2">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isActive ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' : 'bg-white border-gray-300 text-gray-400'
                  } ${isCurrent ? 'ring-4 ring-indigo-100 scale-110' : ''} ${isProcessing ? 'animate-pulse border-indigo-400' : ''}`}
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin text-indigo-500" /> : <step.icon className="w-5 h-5" />}
              </div>
              <span className={`mt-2 text-xs font-bold ${isActive ? 'text-indigo-900' : 'text-gray-400'}`}>
                {step.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default App;
