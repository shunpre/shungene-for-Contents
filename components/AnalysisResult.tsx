import React from 'react';
import { ProductProfile } from '../types';
import { CheckCircle2, Target, Lightbulb, MessageSquare, ShieldCheck, Tag } from 'lucide-react';

interface AnalysisResultProps {
  profile: ProductProfile;
}

export const AnalysisResult: React.FC<AnalysisResultProps> = ({ profile }) => {
  return (
    <div className="bg-white rounded-xl shadow-lg border border-indigo-100 overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
        <h2 className="text-white text-lg font-semibold flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-200" />
          製品プロファイル
        </h2>
        <span className="bg-indigo-500 text-white text-xs px-2 py-1 rounded border border-indigo-400">
          AI 生成済み
        </span>
      </div>
      
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Basic Info */}
        <div className="space-y-6">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">製品名</label>
            <div className="text-2xl font-bold text-gray-900">{profile.productName}</div>
          </div>
          
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2 flex items-center gap-1">
              <Tag className="w-3 h-3" /> カテゴリー
            </label>
            <div className="inline-block bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-medium">
              {profile.category}
            </div>
          </div>

          <div>
             <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2 flex items-center gap-1">
              <Target className="w-3 h-3" /> ターゲット層
            </label>
            <p className="text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
              {profile.targetAudience}
            </p>
          </div>
        </div>

        {/* Right Column: Deep Dive */}
        <div className="space-y-6">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2 flex items-center gap-1">
              <Lightbulb className="w-3 h-3" /> 提供価値 (UVP)
            </label>
            <div className="bg-indigo-50 text-indigo-900 p-4 rounded-lg border border-indigo-100 font-medium italic">
              "{profile.uniqueValueProposition}"
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div>
                <label className="text-xs font-semibold text-red-500 uppercase tracking-wider block mb-2">顧客の悩み (Pain Points)</label>
                <ul className="space-y-2">
                  {profile.painPoints.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-red-400 mt-1">•</span>
                      {point}
                    </li>
                  ))}
                </ul>
             </div>
             <div>
                <label className="text-xs font-semibold text-green-600 uppercase tracking-wider block mb-2">解決策 (Solutions)</label>
                 <ul className="space-y-2">
                  {profile.solutions.map((point, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                      {point}
                    </li>
                  ))}
                </ul>
             </div>
          </div>
          
          <div>
             <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> トーン & マナー
            </label>
             <div className="flex flex-wrap gap-2">
              {profile.toneOfVoice.split(',').map((tone, i) => (
                 <span key={i} className="text-xs font-medium bg-white border border-gray-200 text-gray-600 px-2 py-1 rounded">
                   {tone.trim()}
                 </span>
              ))}
             </div>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between items-center">
        <p className="text-xs text-gray-500">
          このプロファイルは、次のステップでスワイプ可能なLPカードを生成するために使用されます。
        </p>
        <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
          手動で編集する &rarr;
        </button>
      </div>
    </div>
  );
};