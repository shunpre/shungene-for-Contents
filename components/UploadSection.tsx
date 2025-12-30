import React, { useRef, useState } from 'react';
import { Upload, FileText, HardDrive, Plus, X, Globe, Clipboard, Zap, Image, Video, FileType2, Link, Search, Sparkles, Camera, BookOpen } from 'lucide-react';
import { UploadedFile } from '../types';
import { processFiles } from '../services/fileHelper';

interface UploadSectionProps {
  files: UploadedFile[];
  onFilesAdded: (newFiles: UploadedFile[]) => void;
  onFileRemoved: (id: string) => void;
  onFileUpdated?: (id: string, updates: Partial<UploadedFile>) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

export const UploadSection: React.FC<UploadSectionProps> = ({
  files,
  onFilesAdded,
  onFileRemoved,
  onFileUpdated,
  onAnalyze,
  isAnalyzing
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'paste' | 'url' | 'search'>('upload');
  const [pastedText, setPastedText] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [competitorUrlInput, setCompetitorUrlInput] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = await processFiles(e.target.files);
      onFilesAdded(newFiles);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newFiles = await processFiles(e.dataTransfer.files);
      onFilesAdded(newFiles);
    }
  };

  const handlePasteAdd = () => {
    if (!pastedText.trim()) return;
    const newFile: UploadedFile = {
      id: crypto.randomUUID(),
      name: `手動入力 ${new Date().toLocaleTimeString()} `,
      content: pastedText,
      source: 'paste',
      size: pastedText.length,
      mimeType: 'text/plain',
      assetType: 'other'
    };
    onFilesAdded([newFile]);
    setPastedText('');
  };

  const handleUrlAdd = (isCompetitor: boolean = false) => {
    const input = isCompetitor ? competitorUrlInput : urlInput;
    if (!input.trim()) return;

    const newFile: UploadedFile = {
      id: crypto.randomUUID(),
      name: isCompetitor ? `[競合] ${input} ` : input,
      content: isCompetitor ? `COMPETITOR_URL: ${input} ` : input, // Special prefix for AI to recognize
      source: 'url',
      size: input.length,
      mimeType: 'text/uri-list',
      assetType: isCompetitor ? 'competitor_info' : 'product_info'
    };
    onFilesAdded([newFile]);

    if (isCompetitor) {
      setCompetitorUrlInput('');
    } else {
      setUrlInput('');
    }
  };

  const handleSearchAdd = () => {
    if (!searchInput.trim()) return;
    const newFile: UploadedFile = {
      id: crypto.randomUUID(),
      name: `検索: ${searchInput} `,
      content: `SEARCH_QUERY: ${searchInput}`,
      source: 'url', // Treating as URL type helper for now or 'other'
      size: searchInput.length,
      mimeType: 'text/plain',
      assetType: 'other'
    };
    onFilesAdded([newFile]);
    setSearchInput('');
  };

  const getFileIcon = (file: UploadedFile) => {
    if (file.mimeType?.startsWith('image/')) return <Image className="w-5 h-5" />;
    if (file.mimeType?.startsWith('video/')) return <Video className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50/50 overflow-x-auto">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 py-4 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${activeTab === 'upload' ? 'bg-white text-indigo-600 border-t-2 border-t-indigo-600' : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <Upload className="w-4 h-4" />
            ファイル
          </button>
          <button
            onClick={() => setActiveTab('url')}
            className={`flex-1 py-4 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${activeTab === 'url' ? 'bg-white text-indigo-600 border-t-2 border-t-indigo-600' : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <Link className="w-4 h-4" />
            LPのURL
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-4 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${activeTab === 'search' ? 'bg-white text-indigo-600 border-t-2 border-t-indigo-600' : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <Search className="w-4 h-4" />
            検索
          </button>
          <button
            onClick={() => setActiveTab('paste')}
            className={`flex-1 py-4 px-4 text-sm font-medium flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${activeTab === 'paste' ? 'bg-white text-indigo-600 border-t-2 border-t-indigo-600' : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <Clipboard className="w-4 h-4" />
            自由入力
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer ${dragActive
                  ? 'border-indigo-500 bg-indigo-50 scale-[1.02]'
                  : 'border-gray-300 hover:bg-gray-50'
                  }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-6 h-6" />
                </div>
                <h3 className="text-gray-900 font-medium mb-1">クリックまたはドラッグ＆ドロップでアップロード</h3>
                <p className="text-gray-500 text-sm mb-4">対応形式: 画像、動画、PDF、テキスト (md, json, csv)</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  multiple
                  accept="image/*,video/*,.pdf,.txt,.md,.json,.csv"
                  onChange={handleFileChange}
                />
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md shadow-sm transition-all"
                  >
                    ローカルファイルを選択
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); alert("本番環境ではGoogle Picker APIが開きます。"); }}
                    className="px-4 py-2 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm font-medium rounded-md shadow-sm flex items-center gap-2 transition-all"
                  >
                    <HardDrive className="w-4 h-4" />
                    Google ドライブ
                  </button>
                </div>
              </div>
            </div>
          )}

          {
            activeTab === 'url' && (
              <div className="space-y-6">
                {/* Target Product URL */}
                <div>
                  <label htmlFor="url-input" className="block text-sm font-medium text-gray-700 mb-1">
                    自社製品・サービスのLP URL
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="url-input"
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://example.com/product-lp"
                      className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      onKeyDown={(e) => e.key === 'Enter' && handleUrlAdd(false)}
                    />
                    <button
                      onClick={() => handleUrlAdd(false)}
                      disabled={!urlInput.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                      追加
                    </button>
                  </div>
                </div>

                {/* Competitor URL */}
                <div className="pt-4 border-t border-gray-100">
                  <label htmlFor="competitor-url-input" className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
                    <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs font-bold">競合</span>
                    競合他社のLP URL (比較分析用)
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="competitor-url-input"
                      type="url"
                      value={competitorUrlInput}
                      onChange={(e) => setCompetitorUrlInput(e.target.value)}
                      placeholder="https://competitor.com/similar-product"
                      className="flex-1 p-3 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 text-sm bg-red-50/30"
                      onKeyDown={(e) => e.key === 'Enter' && handleUrlAdd(true)}
                    />
                    <button
                      onClick={() => handleUrlAdd(true)}
                      disabled={!competitorUrlInput.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                      競合を追加
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    <Zap className="w-3 h-3 inline-block mr-1 text-amber-500" />
                    競合URLを追加すると、AIが自社製品との差別化ポイントを自動的に分析します。
                  </p>
                </div>
              </div>
            )
          }

          {
            activeTab === 'search' && (
              <div className="space-y-4">
                <div>
                  <label htmlFor="search-input" className="block text-sm font-medium text-gray-700 mb-1">
                    検索キーワード (市場調査・トレンド分析用)
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="search-input"
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="例: 30代 女性 美容液 悩み, 最新 マーケティング トレンド"
                      className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchAdd()}
                    />
                    <button
                      onClick={handleSearchAdd}
                      disabled={!searchInput.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Search className="w-4 h-4" />
                      検索追加
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    <Zap className="w-3 h-3 inline-block mr-1 text-amber-500" />
                    指定したキーワードでGoogle検索を行い、その結果を分析コンテキストに追加します。
                  </p>
                </div>
              </div>
            )
          }

          {
            activeTab === 'paste' && (
              <div className="space-y-4">
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="製品の説明、LPのコピー、メールの下書きなどをここに貼り付けてください..."
                  className="w-full h-48 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none text-sm"
                />
                <div className="flex justify-end">
                  <button
                    onClick={handlePasteAdd}
                    disabled={!pastedText.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-md text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-4 h-4" />
                    ナレッジベースに追加
                  </button>
                </div>
              </div>
            )
          }
        </div >
      </div >

      {/* File List */}
      {
        files.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              アップロード済み資料 ({files.length})
            </h3>
            <ul className="space-y-3">
              {files.map((file) => (
                <li key={file.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 group">
                  <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <div className={`p-2 rounded-md ${file.source === 'drive' ? 'bg-green-100 text-green-600' :
                      file.source === 'url' ? 'bg-purple-100 text-purple-600' :
                        'bg-blue-100 text-blue-600'
                      } flex items-center justify-center w-12 h-12 overflow-hidden`}>
                      {file.mimeType?.startsWith('image/') && (file.data || file.content.startsWith('data:')) ? (
                        <img
                          src={file.data ? `data:${file.mimeType};base64,${file.data}` : file.content}
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getFileIcon(file)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                        <select
                          value={file.assetType || 'analysis_material'}
                          onChange={(e) => onFileUpdated?.(file.id, { assetType: e.target.value as any })}
                          className="text-xs border-gray-300 rounded-md shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 py-0.5 pl-1 pr-6 bg-white"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="analysis_material">FV分析</option>
                          <option value="product_info">自社商品情報</option>
                          <option value="competitor_info">競合情報</option>
                          <option value="product">自社商品画像</option>
                          <option value="character">モデル画像</option>
                          <option value="other">その他</option>
                        </select>
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {file.size > 0 ? (file.size / 1024).toFixed(1) + ' KB' : 'リンク'} •
                        {file.source === 'paste' ? 'テキスト入力' :
                          file.content?.startsWith('SEARCH_QUERY:') ? '検索キーワード' :
                            file.content?.startsWith('COMPETITOR_URL:') ? '競合URL' :
                              file.source === 'url' ? 'URL参照' :
                                'ファイルアップロード'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onFileRemoved(file.id)}
                    className="text-gray-400 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-all"
                    aria-label="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="flex justify-end">
                <button
                  onClick={onAnalyze}
                  disabled={isAnalyzing || files.length === 0}
                  className="relative inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-lg shadow-indigo-200 disabled:opacity-60 disabled:shadow-none transition-all w-full sm:w-auto"
                >
                  {isAnalyzing ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      製品DNAを分析中...
                    </>
                  ) : (
                    <>
                      AIで製品プロファイルを生成
                      <Zap className="ml-2 w-4 h-4 fill-current text-yellow-300" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
};