
import React, { useState, useEffect } from 'react';
import { SwipeLP, SwipeScreen, AppState, DesignSpec } from '../types';
import { Image as ImageIcon, Palette, RefreshCw, ChevronRight, Sparkles, Layout, StickyNote, Type, FileImage, Check, Lock, Loader2, Download, Video, Undo } from 'lucide-react';
// @ts-ignore
import JSZip from 'jszip';

interface SwipeLPPreviewProps {
  lpData: SwipeLP;
  appState: AppState;
  visualProgressIndex?: number;
  onUpdateScreen: (index: number, screen: SwipeScreen) => void;
  onRegenerateScreen: (index: number, instruction: string) => Promise<SwipeScreen>;
  onRegenerateVisual: (index: number, instruction: string) => Promise<DesignSpec>;
  onUndoVisual?: (index: number) => void;
}

export const SwipeLPPreview: React.FC<SwipeLPPreviewProps> = ({ 
  lpData, 
  appState, 
  visualProgressIndex = -1,
  onUpdateScreen, 
  onRegenerateScreen,
  onRegenerateVisual,
  onUndoVisual
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'copy' | 'visual'>('copy');
  const [isExportingVideo, setIsExportingVideo] = useState(false);

  // Safety check: ensure lpData and screens exist and is strictly an array
  const screens = (lpData && Array.isArray(lpData.screens)) ? lpData.screens : [];
  const currentScreen = screens[selectedIndex];
  
  const isGeneratingVisuals = appState === AppState.GENERATING_VISUALS;
  const visualsComplete = appState === AppState.VISUALS_COMPLETE;

  // Auto-switch tabs and indices based on state
  useEffect(() => {
    if (isGeneratingVisuals && visualProgressIndex !== -1) {
      setSelectedIndex(visualProgressIndex);
      setActiveTab('visual');
    } else if (visualsComplete && activeTab === 'copy') {
      setActiveTab('visual');
    }
  }, [appState, visualProgressIndex, isGeneratingVisuals, visualsComplete]);

  const handleDownloadAll = async () => {
    const zip = new JSZip();
    
    // Add images to zip
    screens.forEach((screen) => {
        if (screen && screen.imageData) {
            // Format filename: 01.jpg, 02.jpg ...
            const fileName = `${String(screen.order || 0).padStart(2, '0')}.jpg`;
            zip.file(fileName, screen.imageData, { base64: true });
        }
    });

    try {
        const content = await zip.generateAsync({ type: "blob" });
        const url = window.URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        a.download = `swipe_lp_content_${new Date().toISOString().slice(0,10)}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (e) {
        console.error("Failed to zip files", e);
        alert("ダウンロードに失敗しました。");
    }
  };

  const handleExportVideo = async () => {
    if (isExportingVideo) return;
    setIsExportingVideo(true);

    try {
        const canvas = document.createElement('canvas');
        const width = 1080;
        const height = 1920;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not get canvas context");

        // Fill black background initially
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, height);

        const stream = canvas.captureStream(30); // 30 FPS
        
        let mimeType = 'video/webm;codecs=vp9';
        if (MediaRecorder.isTypeSupported('video/mp4')) {
            mimeType = 'video/mp4';
        } else if (MediaRecorder.isTypeSupported('video/webm;codecs=h264')) {
            mimeType = 'video/webm;codecs=h264';
        }

        const recorder = new MediaRecorder(stream, { mimeType });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.start();

        const durationPerSlide = 3000;
        
        // Load all images first
        const images = await Promise.all(screens.map(async (screen) => {
            if (!screen || !screen.imageData) return null;
            const img = new Image();
            img.src = `data:image/jpeg;base64,${screen.imageData}`;
            await new Promise((resolve) => { img.onload = resolve; });
            return img;
        }));

        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            if (!img) continue;
            ctx.drawImage(img, 0, 0, width, height);
            await new Promise(r => setTimeout(r, durationPerSlide));
        }

        recorder.stop();
        
        await new Promise<void>((resolve) => {
             recorder.onstop = () => {
                 const blob = new Blob(chunks, { type: mimeType });
                 const url = window.URL.createObjectURL(blob);
                 const a = document.createElement('a');
                 a.href = url;
                 a.download = `swipe_lp_video_${new Date().toISOString().slice(0,10)}.${mimeType.includes('mp4') ? 'mp4' : 'webm'}`;
                 document.body.appendChild(a);
                 a.click();
                 document.body.removeChild(a);
                 window.URL.revokeObjectURL(url);
                 resolve();
             };
        });

    } catch (e) {
        console.error("Video export failed", e);
        alert("動画の書き出しに失敗しました。");
    } finally {
        setIsExportingVideo(false);
    }
  };

  // Safe Guard: If no screens, render nothing or loading
  if (!screens || screens.length === 0) {
    return <div className="p-8 text-center text-gray-500">データが読み込まれていません。</div>;
  }
  
  // Safe Guard: If currentScreen is undefined (index out of bounds), fallback
  if (!currentScreen) {
      return <div className="p-8 text-center text-gray-500">スライドを選択してください。</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
      
      {/* 1. Concept Summary */}
      <div className="bg-white px-6 py-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-50 p-2 rounded-lg">
             <Sparkles className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
             <p className="text-xs text-gray-500 font-semibold uppercase">LP コンセプト</p>
             <p className="text-sm text-gray-900 font-medium italic">"{lpData.concept || 'コンセプト未設定'}"</p>
          </div>
        </div>
        {visualsComplete && (
           <div className="flex gap-2">
             <button 
               onClick={handleDownloadAll}
               className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-bold rounded-lg hover:bg-gray-200 transition-colors shadow-sm"
             >
               <Download className="w-4 h-4" />
               一括ダウンロード (Zip)
             </button>
             <button 
               onClick={handleExportVideo}
               disabled={isExportingVideo}
               className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-colors shadow-sm disabled:opacity-70 disabled:cursor-wait"
             >
               {isExportingVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Video className="w-4 h-4" />}
               動画書き出し (MP4)
             </button>
           </div>
        )}
      </div>

      {/* 2. Storyboard Navigation */}
      <div>
        <div className="flex justify-between items-end mb-3">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <Layout className="w-4 h-4" />
            ストーリーボード (構成順)
          </h3>
          <div className="flex bg-gray-100 p-1 rounded-lg">
             <button
                onClick={() => !isGeneratingVisuals && setActiveTab('copy')}
                disabled={isGeneratingVisuals}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${
                  activeTab === 'copy' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700 disabled:opacity-50'
                }`}
             >
                <StickyNote className="w-3 h-3" />
                コピー
             </button>
             <button
                onClick={() => (visualsComplete || isGeneratingVisuals) && setActiveTab('visual')}
                disabled={!visualsComplete && !isGeneratingVisuals}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${
                  activeTab === 'visual' ? 'bg-white text-purple-600 shadow-sm' : 
                  'text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
             >
                <ImageIcon className="w-3 h-3" />
                ビジュアル (デザイン & 画像)
             </button>
          </div>
        </div>

        <div className="overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar">
          <div className="flex gap-3 w-max min-w-full">
            {screens.map((screen, index) => {
              if (!screen) return null; // Safe guard for null screens
              const isLocked = isGeneratingVisuals && index > visualProgressIndex;
              const isProcessing = isGeneratingVisuals && index === visualProgressIndex;
              
              const isActive = selectedIndex === index;
              let borderClass = 'border-gray-200 bg-white';
              if (isActive) {
                 if (activeTab === 'visual') borderClass = 'border-purple-500 bg-purple-50 shadow-md transform -translate-y-1';
                 else borderClass = 'border-indigo-600 bg-indigo-50 shadow-md transform -translate-y-1';
              } else if (isLocked) {
                 borderClass = 'border-gray-100 bg-gray-50 opacity-60';
              }

              return (
              <button
                key={screen.order || index}
                onClick={() => !isLocked && setSelectedIndex(index)}
                disabled={isLocked}
                className={`relative flex flex-col items-start p-3 w-40 rounded-lg border-2 transition-all text-left group ${borderClass}`}
              >
                <div className="flex justify-between w-full items-center mb-2">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                     isActive ? 'bg-white/50 text-gray-900' : 'bg-gray-100 text-gray-500'
                  }`}>
                    Scene {screen.order || index + 1}
                  </span>
                  {isActive && !isLocked && <div className={`w-2 h-2 rounded-full animate-pulse bg-current`} />}
                  {isLocked && <Lock className="w-3 h-3 text-gray-400" />}
                </div>
                
                <div className="w-full bg-gray-100 h-16 rounded mb-2 border border-gray-100 overflow-hidden relative flex items-center justify-center">
                   {isProcessing ? (
                      <Loader2 className="w-5 h-5 animate-spin text-purple-500" />
                   ) : screen.imageData ? (
                      <img src={`data:image/jpeg;base64,${screen.imageData}`} className="w-full h-full object-cover" alt="" />
                   ) : activeTab === 'visual' && screen.designSpec ? (
                     <p className="text-[8px] text-pink-600 font-mono leading-tight text-left w-full h-full p-1 bg-pink-50">
                       Design Ready...
                     </p>
                   ) : (
                     <p className="text-[9px] text-gray-400 font-mono text-left w-full h-full p-1">
                       {(screen.visualDescription || "").substring(0, 40)}...
                     </p>
                   )}
                </div>
                <p className="text-xs font-bold text-gray-900 line-clamp-2 leading-tight h-8 w-full">
                  {screen.title || "（タイトルなし）"}
                </p>
              </button>
            )})}
          </div>
        </div>
      </div>

      {/* 3. Editor & Preview Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Phone Preview */}
        <div className="lg:col-span-5 flex flex-col items-center">
             <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  {activeTab === 'visual' ? 'Final Output' : 'Wireframe Preview'} (9:16)
                </span>
             </div>
             <PhoneMockup 
               screen={currentScreen} 
               isLast={selectedIndex === screens.length - 1} 
               mode={activeTab}
               isProcessing={isGeneratingVisuals && visualProgressIndex === selectedIndex}
             />
             <p className="mt-4 text-xs text-gray-400 text-center max-w-xs">
               {activeTab === 'visual' ? "※ AI生成された最終イメージです。修正したい場合は右側のデザイン指示書を編集して再生成してください。" : 
                "※ テキスト構成確認用ワイヤーフレームです。画像の上に文字が乗るイメージで確認してください。"}
             </p>
        </div>

        {/* Right: Detail Editor */}
        <div className="lg:col-span-7 h-[650px]">
           {activeTab === 'copy' ? (
             <ScreenEditor 
               screen={currentScreen} 
               index={selectedIndex}
               onUpdate={(updated) => onUpdateScreen(selectedIndex, updated)}
               onRegenerate={(instruction) => onRegenerateScreen(selectedIndex, instruction)}
             />
           ) : (
             <VisualEditor
                screen={currentScreen}
                index={selectedIndex}
                isProcessing={isGeneratingVisuals && visualProgressIndex === selectedIndex}
                onUpdate={(updated) => onUpdateScreen(selectedIndex, updated)}
                onRegenerate={(instruction) => onRegenerateVisual(selectedIndex, instruction)}
                onUndo={() => onUndoVisual && onUndoVisual(selectedIndex)}
             />
           )}
        </div>
      </div>
    </div>
  );
};

const ScreenEditor: React.FC<{
  screen: SwipeScreen;
  index: number;
  onUpdate: (s: SwipeScreen) => void;
  onRegenerate: (instruction: string) => Promise<SwipeScreen>;
}> = ({ screen, index, onUpdate, onRegenerate }) => {
  const [regenerateInput, setRegenerateInput] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Safe guard in case screen is null inside editor
  if (!screen) return null;

  const handleTextChange = (field: keyof SwipeScreen, value: string) => {
    onUpdate({ ...screen, [field]: value });
  };

  const handleRegenerateSubmit = async () => {
    if (!regenerateInput.trim()) return;
    setIsRegenerating(true);
    try {
      await onRegenerate(regenerateInput);
      setRegenerateInput('');
    } catch (e) {
      console.error(e);
      alert("再生成に失敗しました。");
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-full flex flex-col animate-in slide-in-from-right-4 duration-500">
       <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <StickyNote className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-gray-900">Scene {screen.order}: コピー & 構成の編集</h3>
          </div>
          <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded">
             役割: {screen.type}
          </span>
       </div>

       <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          {/* Main Content Fields */}
          <div className="space-y-4">
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">キャッチコピー (Title)</label>
               <input 
                 type="text" 
                 value={screen.title || ''} // Default value
                 onChange={(e) => handleTextChange('title', e.target.value)}
                 className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 font-bold text-lg"
                 placeholder="読者の目を引く短い見出し"
               />
             </div>
             <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">本文コピー (Main Text)</label>
               <textarea 
                 rows={5}
                 value={screen.mainCopy || ''} // Default value
                 onChange={(e) => handleTextChange('mainCopy', e.target.value)}
                 className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm leading-relaxed"
                 placeholder="ストーリーを語る本文"
               />
             </div>
          </div>

          <div className="border-t border-gray-100 my-2"></div>

          {/* AI Instructions Fields */}
          <div className="space-y-4 bg-indigo-50/50 p-5 rounded-lg border border-indigo-100">
             <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                <h4 className="text-sm font-bold text-indigo-900">クリエイティブ指示 (AIへのメモ)</h4>
             </div>
             <div>
               <label className="block text-xs font-semibold text-indigo-800 uppercase tracking-wider mb-1 flex items-center gap-1">
                 <ImageIcon className="w-3 h-3" /> 画像イメージ (Visual Description)
               </label>
               <textarea 
                 rows={3}
                 value={screen.visualDescription || ''} // Default value
                 onChange={(e) => handleTextChange('visualDescription', e.target.value)}
                 className="w-full p-2 border border-indigo-200 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-xs bg-white text-gray-700"
               />
               <p className="text-[10px] text-indigo-600 mt-1">※ グラフ、図解、No.1バッジなどの視覚要素も含めて記述してください。</p>
             </div>
          </div>
       </div>

       {/* AI Regenerate Footer */}
       <div className="p-4 bg-gray-900 text-white mt-auto">
          <label className="block text-xs font-medium text-gray-300 mb-2 flex items-center gap-2">
            <RefreshCw className="w-3 h-3 text-indigo-400" />
            AIリテイク (このページを作り直す)
          </label>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="指示を入力 (例: もっと不安に寄り添う内容にして)"
              value={regenerateInput}
              onChange={(e) => setRegenerateInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRegenerateSubmit()}
              disabled={isRegenerating}
              className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:opacity-50"
            />
            <button 
              onClick={handleRegenerateSubmit}
              disabled={isRegenerating || !regenerateInput.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
            >
              {isRegenerating ? <RefreshCw className="w-3 h-3 animate-spin" /> : '修正実行'}
            </button>
          </div>
       </div>
    </div>
  );
}

const VisualEditor: React.FC<{
  screen: SwipeScreen;
  index: number;
  isProcessing: boolean;
  onUpdate: (s: SwipeScreen) => void;
  onRegenerate: (instruction: string) => Promise<DesignSpec>;
  onUndo: () => void;
}> = ({ screen, index, isProcessing, onUpdate, onRegenerate, onUndo }) => {
  const [regenerateInput, setRegenerateInput] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  
  // Safe access
  const spec = screen?.designSpec;
  const hasHistory = screen?.history && screen.history.length > 0;

  const handleSpecChange = (field: keyof DesignSpec, value: string) => {
    if (!spec) return;
    const newSpec = { ...spec, [field]: value };
    onUpdate({ ...screen, designSpec: newSpec });
  };

  const handleRegenerateSubmit = async () => {
    if (!regenerateInput.trim()) return;
    setIsRegenerating(true);
    try {
      await onRegenerate(regenerateInput);
      setRegenerateInput('');
    } catch (e) {
      console.error(e);
      alert("再生成に失敗しました。");
    } finally {
      setIsRegenerating(false);
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Shift+Enter if not composing (IME)
    if (e.key === 'Enter' && e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleRegenerateSubmit();
    }
  };

  if (!spec && isProcessing) {
     return (
       <div className="bg-white rounded-xl shadow-sm border border-purple-200 h-full flex flex-col items-center justify-center p-10 gap-4">
          <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
          <p className="text-gray-600 font-medium">Gemini 3 がデザイン指示と画像を生成中...</p>
          <p className="text-xs text-gray-400">9:16 レイアウト、配色、アセット配置を計算しています</p>
       </div>
     );
  }

  // Pending state for future slides
  if (!spec) return <div className="p-10 text-center text-gray-400">待機中...</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-purple-200 overflow-hidden h-full flex flex-col animate-in slide-in-from-right-4 duration-500">
       <div className="px-6 py-4 border-b border-purple-100 bg-purple-50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-purple-600" />
            <h3 className="font-bold text-gray-900">Scene {screen.order}: デザイン指示書の編集</h3>
          </div>
          <span className="text-xs font-bold text-purple-600 bg-white border border-purple-200 px-2 py-1 rounded">
             Design & Image
          </span>
       </div>

       <div className="p-6 space-y-6 flex-1 overflow-y-auto">
          <div className="bg-yellow-50 border border-yellow-200 p-3 rounded text-xs text-yellow-800 mb-4">
             💡 ここでの変更やAIリテイク指示は、即座に<strong>画像の再生成</strong>に反映されます。
          </div>

          {/* Design Fields */}
          <div className="grid grid-cols-1 gap-6">
             <div>
               <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                 <Layout className="w-3 h-3" /> レイアウト設計 (Layout Blueprint)
               </label>
               <textarea 
                 rows={3}
                 value={spec.layoutBlueprint || ''} // Default value
                 onChange={(e) => handleSpecChange('layoutBlueprint', e.target.value)}
                 className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-purple-500 focus:border-purple-500 text-sm bg-gray-50"
               />
             </div>

             <div>
               <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                 <FileImage className="w-3 h-3" /> 使用アセット指示 (Assets)
               </label>
               <textarea 
                 rows={3}
                 value={spec.visualAssetInstruction || ''} // Default value
                 onChange={(e) => handleSpecChange('visualAssetInstruction', e.target.value)}
                 className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-purple-500 focus:border-purple-500 text-sm bg-gray-50"
               />
             </div>

             <div className="grid grid-cols-2 gap-4">
               <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Type className="w-3 h-3" /> タイポグラフィ
                  </label>
                  <input 
                    type="text"
                    value={spec.typographyInstruction || ''} // Default value
                    onChange={(e) => handleSpecChange('typographyInstruction', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded shadow-sm focus:ring-purple-500 focus:border-purple-500 text-sm"
                  />
               </div>
               <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Palette className="w-3 h-3" /> 配色 (Color Palette)
                  </label>
                  <input 
                    type="text"
                    value={spec.colorPalette || ''} // Default value
                    onChange={(e) => handleSpecChange('colorPalette', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded shadow-sm focus:ring-purple-500 focus:border-purple-500 text-sm"
                  />
               </div>
             </div>
          </div>
       </div>

       {/* Approve / Regenerate Footer */}
       {!isProcessing && (
          <div className="p-4 bg-gray-900 text-white mt-auto border-t border-gray-800">
             <label className="block text-xs font-medium text-purple-300 mb-2 flex items-center gap-2">
               <Sparkles className="w-3 h-3" />
               デザイン修正 & 画像再生成
             </label>
             <div className="flex gap-2 items-start">
               <textarea 
                 placeholder="例: 背景をもっと明るくして (Shift+Enterで送信)"
                 value={regenerateInput}
                 onChange={(e) => setRegenerateInput(e.target.value)}
                 onKeyDown={handleKeyDown}
                 disabled={isRegenerating}
                 rows={1}
                 className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm text-white placeholder-gray-500 focus:ring-1 focus:ring-purple-500 outline-none disabled:opacity-50 resize-none"
               />
               <button 
                 onClick={handleRegenerateSubmit}
                 disabled={isRegenerating || !regenerateInput.trim()}
                 className="px-4 py-2 h-[38px] bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                 title="Shift+Enterで送信"
               >
                 {isRegenerating ? <RefreshCw className="w-3 h-3 animate-spin" /> : '更新'}
               </button>
               
               <button
                 onClick={onUndo}
                 disabled={!hasHistory || isRegenerating}
                 className="px-3 py-2 h-[38px] bg-gray-700 hover:bg-gray-600 text-white rounded text-xs font-bold transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1 whitespace-nowrap"
                 title="ひとつ前の状態に戻す"
               >
                 <Undo className="w-3 h-3" />
                 戻す
               </button>
             </div>
          </div>
       )}
    </div>
  );
}

const PhoneMockup: React.FC<{ 
  screen: SwipeScreen; 
  isLast: boolean; 
  mode: 'copy' | 'visual';
  isProcessing?: boolean 
}> = ({ screen, isLast, mode, isProcessing }) => {
  
  const handleSingleDownload = () => {
    if (!screen?.imageData) return;
    const link = document.createElement('a');
    link.href = `data:image/jpeg;base64,${screen.imageData}`;
    link.download = `swipe_lp_scene_${screen.order || 0}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={`relative w-[300px] border-[8px] rounded-[2.5rem] bg-white shadow-xl overflow-hidden aspect-[9/16] flex flex-col ring-1 ring-black/5 transition-all duration-300 ${mode === 'visual' ? 'border-purple-900' : 'border-gray-800'}`}>
        
        {/* Notch */}
        <div className="absolute top-0 w-full h-6 bg-gray-900 z-20 flex justify-center pointer-events-none">
            <div className="w-1/3 h-4 bg-black rounded-b-lg"></div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col relative overflow-hidden bg-white h-full">
            
            {isProcessing && (
               <div className="absolute inset-0 z-30 bg-white/90 flex flex-col items-center justify-center">
                  <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-2" />
                  <p className="text-xs text-gray-500 font-bold">Rendering Image...</p>
               </div>
            )}

            {mode === 'visual' && screen?.imageData ? (
                 <div className="w-full h-full relative group">
                    <img src={`data:image/jpeg;base64,${screen.imageData}`} className="w-full h-full object-cover" alt="Generated Content" />
                    
                    {/* Single Download Button Overlay */}
                    <div className="absolute bottom-4 right-4 z-40 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                           onClick={handleSingleDownload}
                           className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur-sm transition-colors"
                           title="この画像をダウンロード"
                        >
                           <Download className="w-4 h-4" />
                        </button>
                    </div>
                 </div>
            ) : (
              // WIREFRAME MODE VISUALIZATION (Overlay Style)
              <div className="relative w-full h-full overflow-hidden">
                  {/* Background Image Placeholder */}
                  <div className="absolute inset-0 w-full h-full bg-gray-200 flex flex-col items-center justify-center text-center p-6 z-0">
                      <ImageIcon className="w-16 h-16 text-gray-400 mb-4 opacity-50" />
                      <p className="text-[10px] text-gray-500 font-medium line-clamp-4 max-w-[80%] opacity-70">
                          {screen?.visualDescription || "背景画像エリア"}
                      </p>
                      {/* Dark Overlay for text readability in wireframe */}
                      <div className="absolute inset-0 bg-black/40"></div>
                  </div>

                  {/* Text Content Overlay */}
                  <div className="absolute inset-0 z-10 flex flex-col p-6 pointer-events-none">
                      {/* Tag */}
                      <div className="absolute top-12 right-5">
                          <span className="text-[9px] bg-white/20 backdrop-blur-sm text-white px-2 py-0.5 rounded-full font-mono border border-white/30 shadow-sm">
                              {screen?.type || 'Type'}
                          </span>
                      </div>

                      {/* Main Copy Area (Bottom aligned usually for vertical swipe) */}
                      <div className="mt-auto space-y-4 pb-16">
                          <h4 className="font-bold text-2xl leading-tight text-white drop-shadow-md break-words">
                              {screen?.title || "タイトル"}
                          </h4>
                          <p className="text-xs text-white/90 leading-relaxed whitespace-pre-wrap drop-shadow-sm font-medium">
                              {screen?.mainCopy || "本文テキストがここに入ります。"}
                          </p>
                          
                          {/* CTA Area */}
                          {(screen?.type === 'cta' || screen?.type === 'solution') && (
                              <div className="pt-2">
                                  <div className="w-full py-3 bg-white text-gray-900 text-center rounded-full font-bold text-xs shadow-lg transform transition-transform">
                                      詳細を見る
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
            )}
            
            {/* Vertical Swipe Indicator */}
            {!isLast && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center opacity-70 animate-bounce z-20 pointer-events-none">
                     <div className="flex flex-col items-center gap-0.5">
                        <div className="w-4 h-4 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/40">
                           <ChevronRight className="w-3 h-3 text-white rotate-90" />
                        </div>
                     </div>
                </div>
            )}
        </div>
        
        {/* Bottom Bar Indicator */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1/3 h-1 bg-white/30 rounded-full z-20 pointer-events-none"></div>
      </div>
  );
};
