import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ProductProfile, UploadedFile, SwipeLP, SwipeScreen, DesignSpec, AppealAxis } from '../types';

const USE_MOCK_API = true; // Set to false to use real API

// Helper to get a fresh client instance with the current API key
const getAI = (apiKey: string) => new GoogleGenAI({ apiKey });

// Helper for delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper for retry with exponential backoff
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  retries: number = 3,
  initialDelay: number = 2000,
  factor: number = 2
): Promise<T> {
  let currentDelay = initialDelay;

  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      // Check for 429 (Resource Exhausted) or 503 (Service Unavailable)
      const isRateLimit = error.message?.includes('429') || error.status === 429 || error.message?.includes('quota');
      const isServerOverload = error.message?.includes('503') || error.status === 503;

      if ((isRateLimit || isServerOverload) && i < retries - 1) {
        console.warn(`API Rate Limit/Error hit. Retrying in ${currentDelay}ms... (Attempt ${i + 1}/${retries})`);
        await delay(currentDelay);
        currentDelay *= factor;
      } else {
        throw error;
      }
    }
  }
  throw new Error("Max retries exceeded");
}

const PRODUCT_PROFILE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    productName: { type: Type.STRING, description: "製品またはサービスの名称。" },
    category: { type: Type.STRING, description: "製品が属する業界やカテゴリー。" },
    targetAudience: { type: Type.STRING, description: "理想的な顧客像（ペルソナ）の説明。" },
    painPoints: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "ユーザーが抱えている主な悩みや課題のリスト。"
    },
    solutions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "製品がどのように課題を解決するか。"
    },
    uniqueValueProposition: { type: Type.STRING, description: "購入すべき最も説得力のある理由（UVP）。" },
    toneOfVoice: { type: Type.STRING, description: "検出または提案されるトーン＆マナー（例：プロフェッショナル、親しみやすい、緊急性が高い）。" },
    // Enhanced Marketing Fields
    price: { type: Type.STRING, description: "価格情報（通常価格、税込/税抜など）。不明な場合は空文字。" },
    discountOffer: { type: Type.STRING, description: "割引、特典、キャンペーン情報（例：初回50%OFF、送料無料）。不明な場合は空文字。" },
    authority: { type: Type.STRING, description: "権威性を示す要素（例：医師推奨、No.1獲得、受賞歴、メディア掲載）。不明な場合は空文字。" },
    scarcity: { type: Type.STRING, description: "限定性や緊急性（例：残りわずか、期間限定、先着順）。不明な場合は空文字。" },
    uniqueness: { type: Type.STRING, description: "他社にはない独自性（例：特許取得、世界初、独自成分）。不明な場合は空文字。" },
    trackRecord: { type: Type.STRING, description: "実績（例：累計販売数、満足度、リピート率）。不明な場合は空文字。" },
    winningAxes: {
      type: Type.ARRAY,
      description: "この商品の売れる「訴求軸（切り口）」を3つ提案してください。",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING, description: "訴求軸のタイトル（例：コスパ重視軸、権威性軸、限定性軸）" },
          reason: { type: Type.STRING, description: "なぜこの切り口が有効なのかの理由" },
          targetEmotion: { type: Type.STRING, description: "ターゲットのどのような感情を刺激するか" }
        },
        required: ["id", "title", "reason", "targetEmotion"]
      }
    }
  },
  required: ["productName", "category", "targetAudience", "painPoints", "solutions", "uniqueValueProposition", "toneOfVoice", "winningAxes"]
};

const SWIPE_SCREEN_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    order: { type: Type.INTEGER, description: "スライドの順序 (1から開始)" },
    type: {
      type: Type.STRING,
      enum: ['hook', 'problem', 'empathy', 'solution', 'benefit', 'proof', 'cta'],
      description: "スライドの役割タイプ"
    },
    title: { type: Type.STRING, description: "スライドのメイン見出し（キャッチコピー）。短くインパクト重視。" },
    mainCopy: { type: Type.STRING, description: "詳細を伝える本文コピー。十分な情報量と説得力が必要。" },
    visualDescription: { type: Type.STRING, description: "このスライドで使用すべき画像や動画の具体的な指示・プロンプト。グラフや図解の指示も含む。" },
    designNote: { type: Type.STRING, description: "デザイン上の注意点（文字配置、色使いなど）。" },
    visualStyle: {
      type: Type.STRING,
      enum: ['manga', 'standard'],
      description: "このスライドの表現スタイル。'manga'（4コマ漫画）か'standard'（通常LP）か。"
    },
    designSpec: {
      type: Type.OBJECT,
      description: "このスライドの具体的なデザイン指示書。visualStyleが'standard'の場合に必須。",
      properties: {
        layoutBlueprint: { type: Type.STRING, description: "9:16の縦長画面における具体的な要素配置（例：背景全面に画像、中央に白文字でキャッチコピー）。" },
        visualAssetInstruction: { type: Type.STRING, description: "アップロードされたファイル名を参照し、どの画像を使用するか、または新規撮影/生成の具体的な指示。" },
        typographyInstruction: { type: Type.STRING, description: "フォントの太さ、サイズ、色、強調箇所の指示。" },
        colorPalette: { type: Type.STRING, description: "使用するカラーコードや配色の詳細。" }
      },
      required: ["layoutBlueprint", "visualAssetInstruction", "typographyInstruction", "colorPalette"]
    },
    mangaScript: {
      type: Type.OBJECT,
      description: "このスライドのマンガシナリオ（4コマ構成）。visualStyleが'manga'の場合に必須。",
      properties: {
        panel1: {
          type: Type.OBJECT,
          properties: {
            panelNumber: { type: Type.INTEGER },
            situation: { type: Type.STRING, description: "1コマ目の状況・背景・行動の描写" },
            dialogue: { type: Type.STRING, description: "1コマ目のセリフ" },
            characterExpression: { type: Type.STRING, description: "1コマ目の表情" }
          },
          required: ["panelNumber", "situation", "dialogue"]
        },
        panel2: {
          type: Type.OBJECT,
          properties: {
            panelNumber: { type: Type.INTEGER },
            situation: { type: Type.STRING, description: "2コマ目の状況・背景・行動の描写" },
            dialogue: { type: Type.STRING, description: "2コマ目のセリフ" },
            characterExpression: { type: Type.STRING, description: "2コマ目の表情" }
          },
          required: ["panelNumber", "situation", "dialogue"]
        },
        panel3: {
          type: Type.OBJECT,
          properties: {
            panelNumber: { type: Type.INTEGER },
            situation: { type: Type.STRING, description: "3コマ目の状況・背景・行動の描写" },
            dialogue: { type: Type.STRING, description: "3コマ目のセリフ" },
            characterExpression: { type: Type.STRING, description: "3コマ目の表情" }
          },
          required: ["panelNumber", "situation", "dialogue"]
        },
        panel4: {
          type: Type.OBJECT,
          properties: {
            panelNumber: { type: Type.INTEGER },
            situation: { type: Type.STRING, description: "4コマ目の状況・背景・行動の描写" },
            dialogue: { type: Type.STRING, description: "4コマ目のセリフ" },
            characterExpression: { type: Type.STRING, description: "4コマ目の表情" }
          },
          required: ["panelNumber", "situation", "dialogue"]
        }
      },
      required: ["panel1", "panel2", "panel3", "panel4"]
    }
  },
  required: ["order", "type", "visualStyle"] // Removed title/mainCopy/visualDescription/designNote from required as they are optional in Manga Mode
};

const DESIGN_SPEC_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    layoutBlueprint: { type: Type.STRING, description: "9:16の縦長画面における具体的な要素配置（例：背景全面に画像、中央に白文字でキャッチコピー）。" },
    visualAssetInstruction: { type: Type.STRING, description: "アップロードされたファイル名を参照し、どの画像を使用するか、または新規撮影/生成の具体的な指示。" },
    typographyInstruction: { type: Type.STRING, description: "フォントの太さ、サイズ、色、強調箇所の指示。" },
    colorPalette: { type: Type.STRING, description: "使用するカラーコードや配色の詳細。" }
  },
  required: ["layoutBlueprint", "visualAssetInstruction", "typographyInstruction", "colorPalette"]
};

const SWIPE_LP_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    concept: { type: Type.STRING, description: "このLP構成の全体的なコンセプトや戦略の概要。" },
    mainCharacterDesign: { type: Type.STRING, description: "マンガモードの場合の主人公の外見設定（性別、年齢、髪型、服装など）。全ページで一貫性を保つために使用。" },
    screens: {
      type: Type.ARRAY,
      items: SWIPE_SCREEN_SCHEMA
    }
  },
  required: ["concept", "screens"]
};

const SWIPE_LP_GUIDELINES = `
# スワイプ型LP制作ガイドライン（潜在層向け・体験型ストーリー）

## コンセプト：脱・読み物、入・体験
ユーザーは「勉強」しに来たのではなく、「暇つぶし」で見ています。
「読ませる」のではなく、**「見せて、直感させて、感情を動かす」** ことを最優先してください。
文字だらけの「記事LP」は禁止です。

## 1. 構成の絶対ルール（潜在層の心を掴む）
1.  **FV（1枚目）は「商品」ではなく「衝撃」**:
    *   × 商品画像＋「新発売！」
    *   ○ **「えっ、私のこと？」と思わせる問いかけ**、または **「知らなかった！」という衝撃の事実**。
    *   ユーザーの指を止めさせることだけに集中してください。
2.  **「自分ごと化」ギミックの導入**:
    *   序盤（2〜4枚目）に必ず **「3秒診断」「チェックリスト」「YES/NOクイズ」** のいずれかを入れてください。
    *   ユーザーに参加させることで、他人事を自分事に変えます。
3.  **1スライド＝1メッセージ**:
    *   1枚のスライドで言いたいことは1つだけ。
    *   文字数は極限まで減らし、図解・イラスト・写真で語ってください。

## 2. デザイン・レイアウト指示
1.  **フルスクリーン・没入型**:
    *   スマホの画面全体を使ったポスターのようなレイアウト。
    *   「画像＋文字」のブログ調ではなく、**「画像の中に文字がある」** デザイン。
2.  **視覚的エビデンス**:
    *   「成分がすごい」と書くのではなく、**「成分が浸透している図」** を見せる。
    *   「人気です」と書くのではなく、**「No.1バッジ」** や **「愛用者の笑顔」** を見せる。

## 3. ストーリー展開（潜在層→顕在層へ）
*   **序盤（共感・問題提起）**: 「最近、こんなことない？」「実はそれ、〇〇が原因かも」
*   **中盤（教育・解決策）**: 「放置するとヤバい」「でも、こうすれば解決できる（図解）」
*   **終盤（商品登場・オファー）**: 「それを1本で叶えるのがこれ」「今なら〇〇」

## 4. 【重要】コピーライティングの厳格なルール（AI制御用）
1.  **文末の「。」（句点）は完全禁止**:
    *   改行時も文末も、「。」は一切不要です。
    *   × 「これは革命です。」
    *   ○ 「これは革命です」
2.  **改行時の「、」（読点）は禁止**:
    *   行の途中の「、」はOKですが、行末の「、」は削除してください。
    *   × 「しかし、\nそれは間違いです」
    *   ○ 「しかし\nそれは間違いです」
3.  **【】（隅付き括弧）の使用制限**:
    *   **ボタン内の文言**（例：【詳細を見る】）や、**ボタン周りのマイクロコピー**（例：【初回限定】）以外では使用禁止です。
    *   見出しや強調で【】を使わないでください。
`;

const JAPANESE_COPYWRITER_ROLE = `
# Role & Mindset
あなたは「日本人の感情を揺さぶる、凄腕のストーリーテラー兼コピーライター」です。
論理的な説明よりも、**「直感的な納得感」と「感情の動き」** を重視します。

# Core Instruction
1.  **「先生」にならない**: 上から目線の教育ではなく、**「友人」としての発見の共有**。
2.  **「感情」に訴える**: 機能（スペック）ではなく、それを使った時の**「高揚感」や「安心感」**を描写する。
3.  **短く、鋭く**: 長い文章は読まれません。**「見出し」と「ビジュアル」だけで伝わる**ようにする。

# 禁止事項
- 説教くさい長文
- 専門用語の羅列
- 英語直訳調の不自然な日本語（「想像してみてください」など）
- 抽象的な表現（「幸せ」「成功」など具体性のない言葉）
`;

type TargetSegment = 'latent' | 'manifest';
type AnalysisResponse = {
  profile: ProductProfile;
  summary: string;
  hypothetical?: boolean; // Added for the new prompt logic
};

export const analyzeProductContext = async (
  files: UploadedFile[],
  apiKey: string,
  targetSegment: TargetSegment = 'latent'
): Promise<AnalysisResponse> => {
  if (USE_MOCK_API) {
    console.log("Using Mock API for analyzeProductContext");
    await delay(1500); // Simulate network delay
    return {
      profile: {
        productName: "Mock Diet Supplement",
        category: "Health & Wellness",
        targetAudience: "30-50代の健康意識が高い女性",
        painPoints: ["最近痩せにくくなった", "運動する時間がない", "健康診断の結果が気になる"],
        solutions: ["代謝サポート成分配合", "1日1粒飲むだけ", "医師監修の安心設計"],
        uniqueValueProposition: "忙しいあなたでも続く、科学に基づいた代謝ケア",
        toneOfVoice: "親しみやすく、かつ専門的な信頼感",
        price: "初回980円",
        discountOffer: "定期コース初回80%OFF",
        authority: "累計販売100万袋突破",
        scarcity: "毎月先着500名様限定",
        uniqueness: "特許取得の独自酵素配合",
        trackRecord: "リピート率92%",
        winningAxes: [
          {
            id: 'axis_cost',
            title: "圧倒的コスパ軸",
            reason: "初回980円という低価格は、価格に敏感な層にとって最強のフックになるため。",
            targetEmotion: "お得感・試してみようという気軽さ"
          },
          {
            id: 'axis_easy',
            title: "タイパ・手軽さ軸",
            reason: "「1日1粒」という手軽さは、忙しい現代人の「面倒くさい」という心理的ハードルを下げるため。",
            targetEmotion: "楽に解決できるという安心感"
          },
          {
            id: 'axis_authority',
            title: "権威性・信頼軸",
            reason: "「医師監修」「No.1」などの実績は、失敗したくない保守的な層に刺さるため。",
            targetEmotion: "これなら間違いないという確信"
          }
        ]
      },
      summary: "モックデータによる分析結果です。",
      hypothetical: false
    };
  }

  const ai = getAI(apiKey);

  analysis_material: files.filter(f => f.assetType === 'analysis_material'),
    product_info: files.filter(f => f.assetType === 'product_info' || f.source === 'url' && (!f.assetType || f.assetType === 'product_info')),
      competitor_info: files.filter(f => f.assetType === 'competitor_info'),
        other: files.filter(f => f.assetType === 'other' || f.source === 'paste')
};

const prompt = `
    あなたは「売れるFV（ファーストビュー）」を科学するプロフェッショナルです。
    提供された資料から、以下の2つの観点で徹底的な分析を行ってください。

    **分析対象と優先順位:**
    1. **FV分析（デザイン・視覚）**: 主に\`analysis_material\`（参考画像）から分析します。
    2. **商品分析（コピー・戦略）**: 主に\`product_info\`（自社情報）、\`competitor_info\`（競合情報）から分析します。
    3. **【最重要】自由入力の尊重**: \`other\`（自由入力・検索メモ）に記載された指示や情報は、他の全情報よりも優先してください。

    ---
    
    **【1. FV分析】参考画像から「売れるデザインロジック」を解剖する**
    \`analysis_material\`として画像が提供されている場合、その画像が「なぜ優れているのか」を以下の項目で分析してください。
    
    *   **要素の分析**: メインコピー、権威性バッジ、No.1メダル、オファー、CTAボタンなど、構成要素の洗い出し。
    *   **視線誘導**: Z型、F型など、ユーザーの目をどう動かしているか。「キャッチ→権威性→CTA」の流れ。
    *   **専有面積**: 画像と文字のバランス。商品画像の大きさ対コピーの大きさ。
    *   **トーン**: 「煽り系」「誠実・信頼系」「雑誌風おしゃれ系」「親しみ系」など。
    *   **キラーフレーズ**: 「〇〇な方へ」「緊急」「ついに解禁」など、フックとなる定型句。
    *   **フォント**: ゴシック（力強さ）、明朝（高級感）、手書き（親近感）などの使い分け。
    *   **カラー**: メインカラー、アクセントカラー（CTAボタン）の意図。

    ---

    **【2. 商品分析】「誰に・何を・どう言うか」を定義する**
    \`product_info\`、\`competitor_info\`から、最も刺さる訴求ポイントを定義してください。
    
    *   **ターゲット像（ペルソナ）**: 具体的な悩みを持つ「たった一人の顧客」。
    *   **USP（独自の強み）**: 競合にはない、自社だけの「一点突破」ポイント。
    *   **ベネフィット**: 機能ではなく「変化」。これを使うとどうなるか。
    *   **エビデンス**: 創業年数、成分、満足度、販売数などの「証拠」。
    *   **オファー**: 初回価格、返金保証、特典など、背中を押す条件。

    ---

    **出力形式**
    以下のJSONスキーマに従って出力してください。
    
    Schema:
    \`\`\`json
    {
      "type": "object",
      "properties": {
        "productName": { "type": "string" },
        "category": { "type": "string" },
        "targetAudience": { "type": "string" },
        "uniqueValueProposition": { "type": "string" },
        "toneOfVoice": { "type": "string" },
        "painPoints": { "type": "array", "items": { "type": "string" } },
        "solutions": { "type": "array", "items": { "type": "string" } },
        "winningAxes": { 
          "type": "array", 
          "items": { 
            "type": "object",
            "properties": {
              "id": {"type": "string"},
              "title": {"type": "string"},
              "reason": {"type": "string"},
              "targetEmotion": {"type": "string"}
            }
          }
        },
        "fvAnalysis": {
          "type": "object",
          "properties": {
            "elementBreakdown": { "type": "array", "items": { "type": "string" }, "description": "構成要素のリスト" },
            "gazeGuidance": { "type": "string", "description": "視線誘導のロジック" },
            "occupationRatio": { "type": "string", "description": "専有面積・バランスの設計" },
            "tone": { "type": "string", "description": "デザインのトーン" },
            "killerPhrases": { "type": "array", "items": { "type": "string" }, "description": "使われているキラーフレーズ" },
            "fontAnalysis": { "type": "string", "description": "フォント設計" },
            "colorDesign": { "type": "string", "description": "カラー設計" }
          },
          "required": ["elementBreakdown", "tone", "colorDesign"]
        },
        "productAnalysis": {
          "type": "object",
          "properties": {
            "persona": { "type": "string" },
            "usp": { "type": "string" },
            "benefit": { "type": "string" },
            "evidence": { "type": "array", "items": { "type": "string" } },
            "offer": { "type": "string" }
          },
          "required": ["persona", "usp", "benefit", "offer"]
        }
      },
      "required": ["productName", "fvAnalysis", "productAnalysis", "winningAxes"]
    }
    \`\`\`
  `;

const parts: any[] = [{ text: prompt }];

// Iterate through files and add them as parts
for (const file of files) {
  if (file.source === 'url') {
    parts.push({
      text: `--- SOURCE URL: ${file.name} ---\nURL: ${file.content}\n(Please use the Google Search tool to analyze this URL content)`
    });
  } else if (file.data && file.mimeType) {
    parts.push({
      inlineData: {
        mimeType: file.mimeType,
        data: file.data
      }
    });
  } else {
    parts.push({
      text: `--- SOURCE FILE: ${file.name} ---\n${file.content}`
    });
  }
}

try {
  const response = await retryWithBackoff(() => ai.models.generateContent({
    model: 'gemini-3-pro-preview', // Updated model
    contents: { role: 'user', parts: parts } as any, // Cast to any to avoid type issues with parts structure
    config: {
      temperature: 0.3,
      tools: [{ googleSearch: {} }] // Enable Google Search grounding
    }
  }));

  console.log("Raw Gemini Response (Step 1):", response.text); // Debug logging

  const parsed = parseJsonResponse<ProductProfile>(response.text);

  // SANITIZATION: Ensure arrays and strings are present to prevent UI crashes
  if (!parsed.painPoints || !Array.isArray(parsed.painPoints)) {
    parsed.painPoints = [];
  }
  if (!parsed.solutions || !Array.isArray(parsed.solutions)) {
    parsed.solutions = [];
  }
  if (!parsed.toneOfVoice || typeof parsed.toneOfVoice !== 'string') {
    parsed.toneOfVoice = "信頼感, プロフェッショナル";
  }
  if (!parsed.productName) parsed.productName = "名称未設定";
  if (!parsed.category) parsed.category = "未分類";
  if (!parsed.targetAudience) parsed.targetAudience = "ターゲット層が特定できませんでした";
  if (!parsed.uniqueValueProposition) parsed.uniqueValueProposition = "UVPが生成されませんでした";

  return {
    profile: parsed,
    summary: "分析が完了しました。",
    hypothetical: false // Default to false, logic for true is complex to detect reliably without explicit flag in JSON
  };

} catch (error) {
  console.error("Gemini Analysis Error:", error);
  throw error;
}
};

export const generateSwipeLP = async (
  profile: ProductProfile,
  apiKey: string,
  targetSegment: TargetSegment = 'latent',
  isMangaMode: boolean = false,
  selectedAxis?: AppealAxis // NEW: Optional axis selection
): Promise<SwipeLP> => {
  if (USE_MOCK_API) {
    console.log("Using Mock API for generateSwipeLP", selectedAxis);
    await delay(2000);
    // ... existing mock logic with light customization based on axis ...
    let axisTheme = "Standard";
    if (selectedAxis) axisTheme = selectedAxis.title;

    return {
      concept: `FV Concept: ${axisTheme} Approach`,
      mainCharacterDesign: "日本人女性",
      screens: [
        {
          order: 1,
          type: 'cta',
          title: selectedAxis ? `【${selectedAxis.title}】衝撃の事実` : "【50%OFF】代謝ケア革命",
          mainCopy: selectedAxis ? `${selectedAxis.reason}\n${selectedAxis.targetEmotion}をお届けします。` : "1日1粒で、理想のカラダへ。\n今だけ初回980円。",
          visualStyle: 'standard',
          designSpec: {
            layoutBlueprint: "Impactful Poster Style",
            visualAssetInstruction: "High quality hero shot",
            typographyInstruction: "Bold",
            colorPalette: "#Gold"
          }
        }
      ]
    };
  }

  // 3. FIRST VIEW ONLY PROMPT (Dedicated Mode)
  const PROMPT_FIRST_VIEW_ONLY = `
    **ROLE: World-Class Advertising Creative Director & Copywriter**
    
    **GOAL**: Create ONE single, high-impact "First View" (FV) slide for a mobile landing page.
    
    **CRITICAL RULE: ONE SLIDE ONLY**
    - usage: You MUST generate exactly **1 screen** in the \`screens\` array.
    - \`visualStyle\`: 'standard'
    
    **FV CONCEPT: The 3-Second Rule**
    - You have 3 seconds to grab the user's attention.
    - The slide must serve as a "Digital Poster" that instantly conveys:
      1. **WHO** is this for? (Target Match)
      2. **WHAT** is the benefit? (Catch Copy)
      3. **WHY** now? (Offer / Authority)
    
    ${selectedAxis ? `
    **KEY DIRECTIVE: APPEAL AXIS STRATEGY**
    You MUST focus strictly on the following "Appeal Axis" (Selling Angle):
    - **Axis Title**: ${selectedAxis.title}
    - **Reasoning**: ${selectedAxis.reason}
    - **Target Emotion**: ${selectedAxis.targetEmotion}
    
    **Tone & Copy Instruction**:
    - Ignore generic benefits. **Sharpen the edge** based on the above axis.
    - If "Cost", focus on price/value comparison.
    - If "Authority", focus on trust/awards.
    - If "Result/Speed", focus on immediate changes.
    ` : ''}
    
    **ELEMENTS TO INCLUDE (All in this ONE slide)**:
    - **Visual**: A high-quality product hero shot or a target persona experiencing the benefit.
    - **Catch Copy**: Short, punchy, benefit-driven. (Maximum 15 chars recommended).
    - **Sub Copy**: Supporting context or authority (e.g., "No.1 Ranked", "Doctor Recommended").
    - **CTA / Offer**: "50% OFF", "Limited Time", "Check Diagnosis".
    
    **OUTPUT SCHEMA**:
    - \`screens\`: Array containing EXACTLY 1 item.
    - \`concept\`: Brief description of this FV's angle.
    - **ALWAYS generate \`designSpec\`**.
  `;

  // FORCE FV MODE PROMPT
  const selectedPrompt = PROMPT_FIRST_VIEW_ONLY;

  const prompt = `
    ${selectedPrompt}

    --- 製品プロファイル ---
    製品名: ${profile.productName}
    カテゴリー: ${profile.category}
    ターゲット: ${profile.targetAudience}
    提供価値(UVP): ${profile.uniqueValueProposition}
    悩み: ${profile.painPoints.join(', ')}
    解決策: ${profile.solutions.join(', ')}
    トーン: ${profile.toneOfVoice}
    価格: ${profile.price || ''}
    オファー: ${profile.discountOffer || ''}
    権威性: ${profile.authority || ''}
    限定性: ${profile.scarcity || ''}
    独自性: ${profile.uniqueness || ''}
    実績: ${profile.trackRecord || ''}

    --- 制作ガイドライン(厳守) ---
    1. **枚数制限**: **必ず「1枚」だけ** 生成してください。スワイプ形式ではありません。
    2. **インパクト重視**: この1枚でクリックさせるための「最強の1枚」を作ってください。
    3. **visualStyle**: 必ず 'standard' にしてください。

    出力形式:
    必ず以下のJSONスキーマに従ってください。Markdownコードブロックで囲んでください。

    Schema:
    ${JSON.stringify(SWIPE_LP_SCHEMA, null, 2)}
  `;

  try {
    const ai = getAI(apiKey);
    const response = await retryWithBackoff(() => ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
        // thinkingConfig: { thinkingBudget: 4096 } // Removed thinking for flash model compatibility or speed
      }
    }));

    const parsed = parseJsonResponse<SwipeLP>(response.text);

    // SANITIZATION: Ensure screens is an array and fields are present
    if (!parsed.screens || !Array.isArray(parsed.screens)) {
      if ((parsed as any).slides && Array.isArray((parsed as any).slides)) {
        parsed.screens = (parsed as any).slides; // Handle common hallucination
      } else {
        parsed.screens = [];
        console.error("Gemini returned invalid structure: 'screens' array is missing.", parsed);
      }
    }

    // Default values for screen fields to prevent crashes
    parsed.screens = parsed.screens.map((s, idx) => {
      // Backfill mainCopy from mangaScript if it's a manga slide
      let finalMainCopy = s.mainCopy;
      if (s.visualStyle === 'manga' && s.mangaScript) {
        // Create a summary script from the panels
        const scriptSummary = [
          `1: ${s.mangaScript.panel1.situation}「${s.mangaScript.panel1.dialogue}」`,
          `2: ${s.mangaScript.panel2.situation}「${s.mangaScript.panel2.dialogue}」`,
          `3: ${s.mangaScript.panel3.situation}「${s.mangaScript.panel3.dialogue}」`,
          `4: ${s.mangaScript.panel4.situation}「${s.mangaScript.panel4.dialogue}」`
        ].join('\n');

        // If mainCopy is empty or default, use the script summary
        if (!s.mainCopy || s.mainCopy === '本文が生成されませんでした。') {
          finalMainCopy = scriptSummary;
        }
      }

      return {
        order: s.order || idx + 1,
        type: s.type || 'benefit',
        title: s.title || 'タイトル未設定',
        mainCopy: finalMainCopy || '本文が生成されませんでした。',
        designNote: s.designNote || '',
        visualStyle: s.visualStyle || (isMangaMode ? 'manga' : 'standard'),
        designSpec: s.designSpec || {
          layoutBlueprint: isMangaMode ? '1列4行の縦積み（4コマ漫画）' : 'フルスクリーン・オーバーレイ',
          visualAssetInstruction: 'AI生成',
          typographyInstruction: '標準',
          colorPalette: '#FFFFFF'
        },
        mangaScript: s.mangaScript // Ensure mangaScript is passed through
      };
    });

    return parsed;
  } catch (error) {
    console.error("Gemini Generator Error:", error);
    throw error;
  }
};



export const regenerateSwipeScreen = async (
  profile: ProductProfile,
  currentScreen: SwipeScreen,
  instruction: string,
  apiKey: string
): Promise<SwipeScreen> => {
  if (USE_MOCK_API) {
    console.log("Using Mock API for regenerateSwipeScreen");
    await delay(1000);
    return {
      ...currentScreen,
      mainCopy: currentScreen.mainCopy + " (修正済み)",
      title: currentScreen.title + " (修正)"
    };
  }

  const prompt = `
    ${JAPANESE_COPYWRITER_ROLE}

あなたはスワイプ型LPの専門エディターです。
特定のスライドに対して、ユーザーから修正指示がありました。

--- 製品情報-- -
  製品名: ${profile.productName}
UVP: ${profile.uniqueValueProposition}

--- 現在のスライド内容-- -
  タイトル: ${currentScreen.title}
本文: ${currentScreen.mainCopy}
役割: ${currentScreen.type}

--- ユーザーからの修正指示-- -
  "${instruction}"

--- ガイドライン-- -
  - ユーザーの指示に従って、コピーや内容を修正してください。
- 内容が薄くならないように、説得力を持たせてください。
- スライドの役割（${currentScreen.type}）や順序（${currentScreen.order}）は変更しないでください。
    - ** デザイン指示書(designSpec)は変更せず、そのまま保持するか、コピーの変更に合わせて微調整してください。**
  - 出力は必ず以下のJSONスキーマに従ってください。

Schema:
    ${JSON.stringify(SWIPE_SCREEN_SCHEMA, null, 2)}
`;

  try {
    const ai = getAI(apiKey);
    const response = await retryWithBackoff(() => ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    }));

    const parsed = parseJsonResponse<SwipeScreen>(response.text);

    // Apply strict copy sanitization
    return {
      ...parsed,
      title: sanitizeCopy(parsed.title),
      mainCopy: sanitizeCopy(parsed.mainCopy)
    };
  } catch (error) {
    console.error("Gemini Regenerate Screen Error:", error);
    throw error;
  }
};

export const regenerateDesignSpec = async (
  currentScreen: SwipeScreen,
  uploadedFiles: UploadedFile[],
  instruction: string,
  apiKey: string
): Promise<DesignSpec> => {
  if (USE_MOCK_API) {
    console.log("Using Mock API for regenerateDesignSpec");
    await delay(1000);
    return {
      ...currentScreen.designSpec!,
      layoutBlueprint: currentScreen.designSpec?.layoutBlueprint + " (デザイン修正済み)"
    };
  }

  const fileList = uploadedFiles.map(f => `- ${f.name} `).join('\n');

  const prompt = `
あなたはモバイルLP専門のアートディレクターです。
特定のスライドの「デザイン指示書」に対して、ユーザーから修正指示がありました。
コピーの内容は変更せず、デザインの指定のみを修正してください。

--- 現在のコピー情報-- -
  タイトル: ${currentScreen.title}
本文: ${currentScreen.mainCopy}

--- 現在のデザイン指示-- -
  ${JSON.stringify(currentScreen.designSpec || {}, null, 2)}

--- 利用可能なアセット-- -
  ${fileList}

--- ユーザーからの修正指示-- -
  "${instruction}"

--- ガイドライン-- -
  - アスペクト比9: 16、縦スワイプLPであることを忘れないでください。
    - ** 上下分割レイアウトは禁止です。必ずフルスクリーン画像＋テキストオーバーレイにしてください。**
  - 静止画デザインとして出力してください。
- 出力は必ず以下のJSONスキーマに従ってください。

Schema:
    ${JSON.stringify(DESIGN_SPEC_SCHEMA, null, 2)}
`;

  try {
    const ai = getAI(apiKey);
    const response = await retryWithBackoff(() => ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    }));

    return parseJsonResponse<DesignSpec>(response.text);
  } catch (error) {
    console.error("Gemini Regenerate Design Spec Error:", error);
    throw error;
  }
};

export const generateSwipeScreenImage = async (
  screen: SwipeScreen,
  files: UploadedFile[],
  apiKey: string,
  isMangaMode: boolean = false,
  mainCharacterDesign?: string
): Promise<string> => {
  if (USE_MOCK_API) {
    console.log("Using Mock API for generateSwipeScreenImage");
    await delay(1500);
    // Return a simple gray placeholder image base64
    return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
  }

  const ai = getAI(apiKey);

  // Determine the effective style
  const isMangaStyle = screen.visualStyle === 'manga';
  const isHybridStyle = isMangaMode && screen.visualStyle === 'standard';

  let prompt = "";

  if (isMangaStyle && screen.mangaScript) {
    // --- MANGA STYLE GENERATION (Using Manga Script) ---
    prompt = `
      **ROLE: Professional Manga Artist / Illustrator**
      **GOAL**: Create a HIGH-QUALITY, 9:16 Vertical Color Manga Page (4 panels).

      **CHARACTER CONSISTENCY IS ABSOLUTE PRIORITY**:
      - **Character Design**: ${mainCharacterDesign ? mainCharacterDesign : "A relatable young Japanese woman, brown hair, casual office wear."}
      - **IMPORTANT**: The character MUST look exactly the same in all 4 panels. Same hair, same face, same clothes.
      - **Style**: Modern Japanese Webtoon style. Crisp lines, soft coloring, expressive anime-style faces.
      
      **PANEL STRUCTURE (Vertical Strip 9:16)**:
      - The image MUST be vertically divided into 4 distinct panels.
      
      **SCRIPT & SCENES**:
      - Panel 1: ${screen.mangaScript.panel1.situation} (Action/Emotion)
      - Panel 2: ${screen.mangaScript.panel2.situation} (Action/Emotion)
      - Panel 3: ${screen.mangaScript.panel3.situation} (Action/Emotion)
      - Panel 4: ${screen.mangaScript.panel4.situation} (Action/Emotion)

      **TEXT / SPEECH BUBBLES**:
      - **MUST INCLUDE JAPANESE SPEECH BUBBLES**.
      - Panel 1 Text: "${screen.mangaScript.panel1.dialogue}"
      - Panel 2 Text: "${screen.mangaScript.panel2.dialogue}"
      - Panel 3 Text: "${screen.mangaScript.panel3.dialogue}"
      - Panel 4 Text: "${screen.mangaScript.panel4.dialogue}"
      - Ensure text is legible.
      
      **NEGATIVE PROMPT**:
      - Do not change character hair color or style between panels.
      - Do not merge panels.
      - Do not use English text in bubbles.
      - Do not produce low quality, sketchy, or unfinished art.
    `;
  } else {
    // --- STANDARD / HYBRID STYLE GENERATION (Using Design Spec) ---
    const designSpec = screen.designSpec || {
      layoutBlueprint: 'Full screen overlay',
      visualAssetInstruction: 'High quality photo',
      typographyInstruction: 'Standard',
      colorPalette: 'Brand colors'
    };

    prompt = `
      **ROLE: Professional Graphic Designer & Photographer**
      **GOAL**: Create a high-converting Landing Page slide (9:16 Vertical).
      
      **DEFAULT MODEL RULE**:
      - **ALL HUMAN MODELS MUST BE JAPANESE** unless strictly specified otherwise by the user.
      - If the prompt describes a person, assume "Japanese".
      
      **DESIGN SPECIFICATION**:
      - **Layout**: ${designSpec.layoutBlueprint}
      - **Visuals**: ${designSpec.visualAssetInstruction}
      - **Typography**: ${designSpec.typographyInstruction}
      - **Colors**: ${designSpec.colorPalette}
      
      **CONTENT**:
      - **Main Copy**: "${screen.mainCopy}" (Ensure text is legible)
      
      ${isHybridStyle ? `
      **HYBRID STYLE INSTRUCTION (CRITICAL)**:
      - **Style**: 80% Realism (Product/Background) + 20% Anime (Character Overlay).
      - **Composition**: Show the REAL product or realistic result background. Overlay the Anime Character (from Manga part) as a "Navigator" or "Reactor" in the corner or side.
      - **Character**: ${mainCharacterDesign || "Consistent with manga part"}.
      - **Goal**: Bridge the gap between the manga story and the real product offer.
      ` : `
      **STYLE**:
      - High-end commercial photography or premium 3D graphics.
      - "Instagrammable" and trustworthy.
      `}
    `;
  }

  // Filter for image files to use as reference/composition
  const imageFiles = files.filter(f => f.mimeType?.startsWith('image/'));

  // Categorize images
  const productImages = imageFiles.filter(f => f.assetType === 'product');
  const characterImages = imageFiles.filter(f => f.assetType === 'character');
  const voiceImages = imageFiles.filter(f => f.assetType === 'voice');
  const designRefImages = imageFiles.filter(f => f.assetType === 'design_reference');
  const otherImages = imageFiles.filter(f => !f.assetType || f.assetType === 'other');

  // Append Asset Composition Instructions
  prompt += `
    ** ASSET COMPOSITION INSTRUCTIONS:**

    ${productImages.length > 0 ? `
    [PRODUCT IMAGES PROVIDED]
    - Use the provided product image(s) as the HERO element.
    - Composite naturally: Model holding it, placed on a table, or floating in a stylized background.
    - Ensure the product label/logo is visible if possible.
    ` : ''}

    ${characterImages.length > 0 ? `
    [CHARACTER/MODEL IMAGES PROVIDED]
    - Use the provided character/model image(s) as the main subject.
    - Maintain their facial features and style.
    - If a product image is ALSO provided, show this character holding/using the product.
    ` : ''}

    ${designRefImages.length > 0 ? `
    [DESIGN REFERENCE IMAGES PROVIDED]
    - **STYLE REFERENCE ONLY:** Use these images ONLY for visual style (color palette, lighting, mood, font vibe).
    - **DO NOT COPY THE CONTENT:** Do not reproduce the specific objects, people, or layout of the reference exactly.
    - **ADAPT TO PRODUCT:** Apply this style to the USER'S PRODUCT and content defined above.
    ` : ''}

    ${voiceImages.length > 0 && screen.type === 'proof' ? `
    [USER VOICE IMAGES PROVIDED]
    - This is a "User Voice" / Testimonial screen.
    - Use the provided user image as a profile icon or standing figure next to their testimonial.
    ` : ''}

    ** CRITICAL NEGATIVE PROMPT / CONSTRAINTS:**
    - ** Do NOT render a smartphone bezel, frame, device mockup, or hand holding a phone.**
    - The image IS the screen content itself. It should be full-bleed.
    - Do not produce low-density "blog" graphics. Make it look like a high-end magazine ad or infographic.
  `;

  const parts: any[] = [{ text: prompt }];

  // Add image parts if available
  if (imageFiles.length > 0) {
    for (const file of imageFiles) {
      // Use file.data (raw base64) if available (from fileHelper), otherwise try to parse from content (data URL)
      let base64Data = '';
      if (file.data) {
        base64Data = file.data;
      } else {
        base64Data = file.content.split(',')[1] || file.content;
      }

      parts.push({
        inlineData: {
          mimeType: file.mimeType || 'image/jpeg',
          data: base64Data
        }
      });
    }
  }

  try {
    const ai = getAI(apiKey);
    const response = await retryWithBackoff(() => ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: parts },
      config: {
        imageConfig: {
          aspectRatio: "9:16",
          imageSize: "1K"
        }
      }
    }));

    // Extract image data
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.data) {
        return part.inlineData.data;
      }
    }

    throw new Error("画像データが生成されませんでした。");

  } catch (error) {
    console.error("Gemini Image Generation Error:", error);
    throw error;
  }
};


function parseJsonResponse<T>(text: string | undefined): T {
  if (!text) throw new Error("AIからの応答が空でした。");

  // Extract JSON from markdown code block
  const jsonMatch = text.match(/```json\n([\s\S] *?) \n```/) || text.match(/```([\s\S] *?)```/) || [null, text];
  const jsonStr = jsonMatch[1] ? jsonMatch[1].trim() : text.trim();

  // Find boundaries
  const startIndex = jsonStr.indexOf('{');
  const endIndex = jsonStr.lastIndexOf('}');

  if (startIndex === -1 || endIndex === -1) {
    throw new Error("有効なJSONが見つかりませんでした。");
  }

  const cleanJson = jsonStr.substring(startIndex, endIndex + 1);
  const parsed = JSON.parse(cleanJson);

  // Basic validation: must be an object and not null
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error("AIが有効なJSONオブジェクトを返しませんでした。");
  }

  return parsed as T;
}

/**
 * Enforce strict copy rules:
 * 1. Remove trailing periods (。) at end of string or line.
 * 2. Remove trailing commas (、) at end of string or line.
 */
function sanitizeCopy(text: string): string {
  if (!text) return text;

  // Remove 。 at end of lines or string
  let sanitized = text.replace(/。(?=$|\n)/g, '');

  // Remove 、 at end of lines or string
  sanitized = sanitized.replace(/、(?=$|\n)/g, '');

  return sanitized;
}