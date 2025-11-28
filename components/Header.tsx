import React from 'react';
import { Zap, Key } from 'lucide-react';

interface HeaderProps {
  onApiKeyClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onApiKeyClick }) => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img 
            src="https://shungene.lm-c.jp/favicon.png" 
            alt="瞬ジェネ Logo" 
            className="w-10 h-10 object-contain rounded-lg"
          />
          <div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight">瞬ジェネforコンテンツ</h1>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-1 text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
            <Zap className="w-4 h-4 text-purple-500 fill-current" />
            <span>Gemini 3 & Nano Banana Pro</span>
          </div>
          
          <button 
            onClick={onApiKeyClick}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
            title="APIキー設定"
          >
            <Key className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};