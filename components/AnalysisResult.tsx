import React, { useState, useEffect } from 'react';
import { ProductProfile } from '../types';
import { CheckCircle2, Target, Lightbulb, MessageSquare, ShieldCheck, Tag, PenLine, Save, X, Eye, TrendingUp, Layout, Palette, Type, MousePointer2, PieChart, Star, Gift, Users, Microscope } from 'lucide-react';

interface AnalysisResultProps {
  profile: ProductProfile;
  onSave: (updatedProfile: ProductProfile) => void;
}

export const AnalysisResult: React.FC<AnalysisResultProps> = ({ profile, onSave }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<ProductProfile>(profile);

  useEffect(() => {
    setEditedProfile(profile);
  }, [profile]);

  const handleSave = () => {
    onSave(editedProfile);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedProfile(profile);
    setIsEditing(false);
  };

  const handleChange = (field: keyof ProductProfile, value: any) => {
    setEditedProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleDeepChange = (parent: 'fvAnalysis' | 'productAnalysis', field: string, value: any) => {
    setEditedProfile(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent] as any,
        [field]: value
      }
    }));
  };

  const handleArrayChange = (parent: 'fvAnalysis' | 'productAnalysis', field: string, value: string) => {
    // Split by comma or newline for array fields
    const array = value.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
    handleDeepChange(parent, field, array);
  };

  if (isEditing) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-indigo-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
        <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
          <h2 className="text-white text-lg font-semibold flex items-center gap-2">
            <PenLine className="w-5 h-5" />
            分析結果の編集
          </h2>
          <div className="flex gap-2">
            <button onClick={handleCancel} className="px-3 py-1 bg-indigo-500 hover:bg-indigo-400 text-white text-sm rounded transition-colors flex items-center gap-1">
              <X className="w-4 h-4" /> キャンセル
            </button>
            <button onClick={handleSave} className="px-3 py-1 bg-white text-indigo-600 hover:bg-gray-100 text-sm font-bold rounded transition-colors flex items-center gap-1">
              <Save className="w-4 h-4" /> 保存して確定
            </button>
          </div>
        </div>

        <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto">
          {/* FV Analysis Editor */}
          {editedProfile.fvAnalysis && (
            <div className="space-y-4 border-b border-gray-200 pb-6">
              <h3 className="text-md font-bold text-gray-800 flex items-center gap-2 mb-4">
                <Eye className="w-5 h-5 text-purple-600" />
                FV分析 (視覚・デザイン)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">構成要素 (Element Breakdown)</label>
                  <textarea
                    value={editedProfile.fvAnalysis.elementBreakdown.join('\n')}
                    onChange={(e) => handleArrayChange('fvAnalysis', 'elementBreakdown', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-sm h-20"
                    placeholder="カンマまたは改行区切り"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">視線誘導 (Gaze Guidance)</label>
                  <input
                    type="text"
                    value={editedProfile.fvAnalysis.gazeGuidance}
                    onChange={(e) => handleDeepChange('fvAnalysis', 'gazeGuidance', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">専有面積 (Occupation Ratio)</label>
                  <input
                    type="text"
                    value={editedProfile.fvAnalysis.occupationRatio}
                    onChange={(e) => handleDeepChange('fvAnalysis', 'occupationRatio', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">トーン (Tone)</label>
                  <input
                    type="text"
                    value={editedProfile.fvAnalysis.tone}
                    onChange={(e) => handleDeepChange('fvAnalysis', 'tone', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">フォント (Font)</label>
                  <input
                    type="text"
                    value={editedProfile.fvAnalysis.fontAnalysis}
                    onChange={(e) => handleDeepChange('fvAnalysis', 'fontAnalysis', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">キラーフレーズ (Killer Phrases)</label>
                  <textarea
                    value={editedProfile.fvAnalysis.killerPhrases.join('\n')}
                    onChange={(e) => handleArrayChange('fvAnalysis', 'killerPhrases', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-sm h-16"
                    placeholder="カンマまたは改行区切り"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">カラー設計 (Color Design)</label>
                  <input
                    type="text"
                    value={editedProfile.fvAnalysis.colorDesign}
                    onChange={(e) => handleDeepChange('fvAnalysis', 'colorDesign', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div className="md:col-span-2 bg-purple-50 p-4 rounded border border-purple-100">
                  <label className="block text-xs font-bold text-purple-700 mb-1 flex items-center gap-1">
                    <Lightbulb className="w-3 h-3" />
                    自由考察 (Design Insight) - AIへの最重要指示
                  </label>
                  <textarea
                    value={editedProfile.fvAnalysis.designInsight || ''}
                    onChange={(e) => handleDeepChange('fvAnalysis', 'designInsight', e.target.value)}
                    className="w-full p-2 border border-purple-200 rounded text-sm h-24 focus:ring-purple-500"
                    placeholder="ここに書かれた内容は、他のすべての分析結果よりも優先されます。"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Product Analysis Editor */}
          {editedProfile.productAnalysis && (
            <div className="space-y-4">
              <h3 className="text-md font-bold text-gray-800 flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-green-600" />
                商品分析 (戦略・コピー)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">ターゲット像 (Persona)</label>
                  <textarea
                    value={editedProfile.productAnalysis.persona}
                    onChange={(e) => handleDeepChange('productAnalysis', 'persona', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-sm h-16"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">USP (独自の強み)</label>
                  <input
                    type="text"
                    value={editedProfile.productAnalysis.usp}
                    onChange={(e) => handleDeepChange('productAnalysis', 'usp', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">ベネフィット (Benefit)</label>
                  <input
                    type="text"
                    value={editedProfile.productAnalysis.benefit}
                    onChange={(e) => handleDeepChange('productAnalysis', 'benefit', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">エビデンス (Evidence)</label>
                  <textarea
                    value={editedProfile.productAnalysis.evidence.join('\n')}
                    onChange={(e) => handleArrayChange('productAnalysis', 'evidence', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-sm h-16"
                    placeholder="カンマまたは改行区切り"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">オファー (Offer)</label>
                  <input
                    type="text"
                    value={editedProfile.productAnalysis.offer}
                    onChange={(e) => handleDeepChange('productAnalysis', 'offer', e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div className="md:col-span-2 bg-green-50 p-4 rounded border border-green-100">
                  <label className="block text-xs font-bold text-green-700 mb-1 flex items-center gap-1">
                    <Lightbulb className="w-3 h-3" />
                    自由考察 (Strategic Insight) - AIへの最重要指示
                  </label>
                  <textarea
                    value={editedProfile.productAnalysis.strategicInsight || ''}
                    onChange={(e) => handleDeepChange('productAnalysis', 'strategicInsight', e.target.value)}
                    className="w-full p-2 border border-green-200 rounded text-sm h-24 focus:ring-green-500"
                    placeholder="ここに書かれた内容は、他のすべての分析結果よりも優先されます。"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-indigo-100 overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
        <h2 className="text-white text-lg font-semibold flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-indigo-200" />
          FV分析結果
        </h2>
        <div className="flex items-center gap-3">
          <span className="bg-indigo-500 text-white text-xs px-2 py-1 rounded border border-indigo-400">
            AI 生成済み
          </span>
          <button
            onClick={() => setIsEditing(true)}
            className="bg-white text-indigo-600 hover:bg-gray-100 px-3 py-1.5 rounded text-xs font-bold transition-colors flex items-center gap-1 shadow-sm"
          >
            <PenLine className="w-3 h-3" /> 修正・調整する
          </button>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* FV Analysis Section (Left Column) */}
        {profile.fvAnalysis && (
          <div className="bg-purple-50 rounded-xl p-6 border border-purple-100 h-full">
            <h3 className="text-purple-900 font-bold text-lg flex items-center gap-2 mb-6 border-b border-purple-200 pb-3">
              <Eye className="w-5 h-5" /> FV分析 (視覚・デザイン)
            </h3>
            <div className="space-y-6">
              <div>
                <span className="text-xs text-purple-600 font-bold uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <Layout className="w-3 h-3" /> 構成要素
                </span>
                <div className="flex flex-wrap gap-2">
                  {profile.fvAnalysis.elementBreakdown.map((item, i) => (
                    <span key={i} className="bg-white border border-purple-100 px-2 py-1 rounded text-xs text-purple-900 shadow-sm">{item}</span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-purple-600 font-bold uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <MousePointer2 className="w-3 h-3" /> 視線誘導
                  </span>
                  <p className="text-sm text-gray-800 font-medium bg-white/50 p-2 rounded">{profile.fvAnalysis.gazeGuidance}</p>
                </div>
                <div>
                  <span className="text-xs text-purple-600 font-bold uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <PieChart className="w-3 h-3" /> 専有面積
                  </span>
                  <p className="text-sm text-gray-800 font-medium bg-white/50 p-2 rounded">{profile.fvAnalysis.occupationRatio}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-purple-600 font-bold uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> トーン
                  </span>
                  <p className="text-sm text-gray-800 font-medium">{profile.fvAnalysis.tone}</p>
                </div>
                <div>
                  <span className="text-xs text-purple-600 font-bold uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <Type className="w-3 h-3" /> フォント
                  </span>
                  <p className="text-sm text-gray-800 font-medium">{profile.fvAnalysis.fontAnalysis}</p>
                </div>
              </div>

              <div>
                <span className="text-xs text-purple-600 font-bold uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <Star className="w-3 h-3" /> キラーフレーズ
                </span>
                <ul className="text-sm text-gray-700 list-disc list-inside bg-white p-3 rounded-lg border border-purple-100">
                  {profile.fvAnalysis.killerPhrases.map((phrase, i) => (
                    <li key={i}>{phrase}</li>
                  ))}
                </ul>
              </div>

              <div>
                <span className="text-xs text-purple-600 font-bold uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <Palette className="w-3 h-3" /> カラー設計
                </span>
                <p className="text-sm text-gray-800 bg-white p-2 rounded border border-purple-100">{profile.fvAnalysis.colorDesign}</p>
              </div>

              {profile.fvAnalysis.designInsight && (
                <div className="bg-white p-4 rounded-lg border-2 border-purple-200 shadow-sm mt-4">
                  <span className="text-xs text-purple-700 font-bold flex items-center gap-1 mb-2">
                    <Lightbulb className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    自由考察 (Design Insight)
                  </span>
                  <p className="text-sm text-gray-800 leading-relaxed font-medium">{profile.fvAnalysis.designInsight}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Product Analysis Section (Right Column) */}
        {profile.productAnalysis && (
          <div className="bg-green-50 rounded-xl p-6 border border-green-100 h-full">
            <h3 className="text-green-900 font-bold text-lg flex items-center gap-2 mb-6 border-b border-green-200 pb-3">
              <TrendingUp className="w-5 h-5" /> 商品分析 (戦略・コピー)
            </h3>
            <div className="space-y-6">
              <div>
                <span className="text-xs text-green-700 font-bold uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <Users className="w-3 h-3" /> ターゲット (Persona)
                </span>
                <p className="text-sm text-gray-800 bg-white p-3 rounded-lg border border-green-100 leading-relaxed">
                  {profile.productAnalysis.persona}
                </p>
              </div>

              <div>
                <span className="text-xs text-green-700 font-bold uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <Target className="w-3 h-3" /> USP (独自の強み)
                </span>
                <p className="text-sm text-gray-900 font-bold bg-white p-3 rounded-lg border border-green-100">
                  {profile.productAnalysis.usp}
                </p>
              </div>

              <div>
                <span className="text-xs text-green-700 font-bold uppercase tracking-wider block mb-1 flex items-center gap-1">
                  <Gift className="w-3 h-3" /> ベネフィット
                </span>
                <p className="text-sm text-gray-800 font-medium">
                  {profile.productAnalysis.benefit}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <span className="text-xs text-green-700 font-bold uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <Microscope className="w-3 h-3" /> エビデンス
                  </span>
                  <ul className="text-sm text-gray-700 list-disc list-inside bg-white p-3 rounded-lg border border-green-100">
                    {profile.productAnalysis.evidence.map((ev, i) => (
                      <li key={i}>{ev}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <span className="text-xs text-green-700 font-bold uppercase tracking-wider block mb-1 flex items-center gap-1">
                    <Tag className="w-3 h-3" /> オファー (条件)
                  </span>
                  <p className="text-lg text-red-600 font-bold bg-white p-3 rounded-lg border border-red-100 text-center">
                    {profile.productAnalysis.offer}
                  </p>
                </div>
              </div>

              {profile.productAnalysis.strategicInsight && (
                <div className="bg-white p-4 rounded-lg border-2 border-green-200 shadow-sm mt-4">
                  <span className="text-xs text-green-700 font-bold flex items-center gap-1 mb-2">
                    <Lightbulb className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    自由考察 (Strategic Insight)
                  </span>
                  <p className="text-sm text-gray-800 leading-relaxed font-medium">{profile.productAnalysis.strategicInsight}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Fallback */}
        {!profile.fvAnalysis && !profile.productAnalysis && (
          <div className="bg-red-50 text-red-600 p-4 rounded col-span-2 text-center">
            分析データが不完全です。再分析を実行してください。
          </div>
        )}
      </div>

      <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-500">
          この分析結果に基づいて、次のステップでFV案が生成されます。内容に違和感がある場合は「修正・調整する」ボタンから編集してください。
        </p>
      </div>
    </div>
  );
};