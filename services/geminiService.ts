import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ProductProfile, UploadedFile, SwipeLP, SwipeScreen, DesignSpec } from '../types';

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
    toneOfVoice: { type: Type.STRING, description: "検出または提案されるトーン＆マナー（例：プロフェッショナル、親しみやすい、緊急性が高い）。" }
  },
  required: ["productName", "category", "targetAudience", "painPoints", "solutions", "uniqueValueProposition", "toneOfVoice"]
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
    designNote: { type: Type.STRING, description: "デザイン上の注意点（文字配置、色使いなど）。" }
  },
  required: ["order", "type", "title", "mainCopy", "visualDescription", "designNote"]
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

export const analyzeProductContext = async (files: UploadedFile[], apiKey: string): Promise<ProductProfile> => {
  if (files.length === 0) {
    throw new Error("分析するファイルがありません。");
  }

  const prompt = `
    あなたは熟練のマーケティング戦略家であり、コピーライターです。
    
    提供されたテキスト、画像、動画、PDF、およびURL情報から、製品、サービス、またはブランドに関する情報を分析してください。
    
    提供されたテキスト、画像、動画、PDF、およびURL情報から、製品、サービス、またはブランドに関する情報を分析してください。
    
    **分析のステップ:**
    1. **提供情報の分析**: まず、ユーザーから提供されたテキストやURL（文字列としての意味）を徹底的に読み解いてください。
    2. **Google検索による補完**: 次に、Google検索を使用して、競合他社、市場トレンド、ターゲット層の悩み（知恵袋など）をリサーチし、情報を補完してください。
    
    **重要: 情報が取得できない場合の対応**
    - URLが検索でヒットしない、またはアクセスできない場合でも、**絶対に「不明」「未設定」などの空欄で返さないでください。**
    - その場合は、URLの文字列や一般的な業界知識から推測し、**「もしこの製品が存在するとしたら、どのようなプロファイルが理想的か？」という観点で、架空の（しかし説得力のある）プロファイルを生成してください。**
    - ターゲット層や悩みは、そのカテゴリーにおける一般的なものを適用してください。
    
    あなたのタスクは、これらを分析し、**「まだ商品の必要性に気づいていない潜在層」** に響くような切り口を見つけることです。
    
    必ず以下のJSONスキーマ形式のみで出力してください。Markdownのコードブロック( \`\`\`json ... \`\`\` )で囲んでください。
    
    Schema:
    ${JSON.stringify(PRODUCT_PROFILE_SCHEMA, null, 2)}
    
    分析のポイント:
    - 機能そのものより、その機能がもたらす「感情的価値」や「生活の変化」に着目してください。
    - 潜在層が抱えているであろう「隠れた悩み」や「諦めていること」を言語化してください。
    - 出力は日本語で行ってください。
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
    const ai = getAI(apiKey);
    const response = await retryWithBackoff(() => ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts: parts },
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

    return parsed;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

export const generateSwipeLP = async (profile: ProductProfile, apiKey: string): Promise<SwipeLP> => {
  const prompt = `
    ${JAPANESE_COPYWRITER_ROLE}

    あなたは「潜在層の心を掴んで離さない」スワイプLPの構成作家です。
    以下の製品プロファイルと、ガイドラインに基づいて、
    **「つい最後まで見てしまう」** スワイプLPの構成案（全15〜20枚程度）を作成してください。

    --- 製品プロファイル ---
    製品名: ${profile.productName}
    カテゴリー: ${profile.category}
    ターゲット: ${profile.targetAudience}
    提供価値(UVP): ${profile.uniqueValueProposition}
    悩み: ${profile.painPoints.join(', ')}
    解決策: ${profile.solutions.join(', ')}
    トーン: ${profile.toneOfVoice}
    
    --- 制作ガイドライン (厳守) ---
    ${SWIPE_LP_GUIDELINES}
    
    重要指示：
    1.  **FVのインパクト**: 1枚目は商品紹介ではありません。「えっ？」と思わせる画像やコピーで惹きつけてください。
    2.  **インタラクティブ要素**: 序盤に必ず「チェックリスト」や「診断」のスライドを入れてください。
    3.  **ストーリー性**: 「悩み共感」→「原因の気づき」→「解決策の提示」→「商品の登場」という流れをスムーズに作ってください。いきなり商品を売り込まないでください。
    4.  **ビジュアル指示**: visualDescriptionには、単なる写真だけでなく、「図解」「比較グラフ」「チェックリストのデザイン」など、視覚的に分かりやすい要素を具体的に指示してください。

    出力形式:
    必ず以下のJSONスキーマに従ってください。Markdownコードブロックで囲んでください。
    
    Schema:
    ${JSON.stringify(SWIPE_LP_SCHEMA, null, 2)}
    
    各スライドの 'title' は短く（15文字以内推奨）、直感的に刺さるものにしてください。
    'mainCopy' は長文を避け、箇条書きや短いフレーズで構成してください。
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
    parsed.screens = parsed.screens.map((s, idx) => ({
      order: s.order || idx + 1,
      type: s.type || 'benefit',
      title: s.title || 'タイトル未設定',
      mainCopy: s.mainCopy || '本文が生成されませんでした。',
      visualDescription: s.visualDescription || '製品の魅力的な画像',
      designNote: s.designNote || ''
    }));

    return parsed;
  } catch (error) {
    console.error("Gemini Generator Error:", error);
    throw error;
  }
};

export const generateSingleDesignSpec = async (
  targetScreen: SwipeScreen,
  allScreens: SwipeScreen[],
  uploadedFiles: UploadedFile[],
  concept: string,
  apiKey: string
): Promise<DesignSpec> => {

  const fileList = uploadedFiles.map(f => `- ${f.name} (${f.mimeType || 'unknown'})`).join('\n');
  // Provide context about previous screens to ensure consistency, but focus on the target screen
  const contextScreens = allScreens.map(s => `Scene ${s.order}: ${s.title} (${s.type})`).join('\n');

  const prompt = `
    あなたはモバイルLP専門のトップアートディレクターです。
    現在、以下のコピー構成案（SwipeLP）のうち、「Scene ${targetScreen.order}」の「デザイン指示書」を作成してください。

    --- コンセプト ---
    ${concept}

    --- 全体の流れ (Context) ---
    ${contextScreens}

    --- 利用可能なアセット素材 ---
    ${fileList}
    ※ 画像や動画の素材がここにある場合、積極的にデザイン指示に組み込んでください（ファイル名を指定）。
    ※ 素材がない場合は、具体的な撮影指示や生成AIへのプロンプト指示を書いてください。

    --- ターゲットスライド情報 ---
    順序: ${targetScreen.order}
    役割: ${targetScreen.type}
    タイトル: ${targetScreen.title}
    本文: ${targetScreen.mainCopy}
    画像イメージ: ${targetScreen.visualDescription}

    --- デザイン要件 (厳守) ---
    1. **アスペクト比 9:16（縦長全画面）**。
    2. **フルスクリーン・オーバーレイレイアウト**: 
       - 「画像が上、文字が下」のブログ調レイアウトは**禁止**です。
       - 背景全面に高品質な画像を使用し、その上にテキストを配置してください。
    3. **可読性の確保**:
       - 背景画像の上に文字を乗せるため、ドロップシャドウ、文字の袋文字、半透明の座布団（テキストボックス）などの処理を具体的に指示してください。
    4. **視覚情報の密度**:
       - 可能な限り、図解、矢印、グラフ、No.1バッジ、権威性の証明（メダル等）をビジュアルに組み込んでください。
    5. **FV（Scene 1）**:
       - 1枚目はポスターの表紙です。最も力強いキービジュアルとタイトルロゴの配置を指示してください。

    --- 出力 ---
    必ず以下のJSONスキーマに従ってください。
    
    Schema:
    ${JSON.stringify(DESIGN_SPEC_SCHEMA, null, 2)}
  `;

  try {
    const ai = getAI(apiKey);
    const response = await retryWithBackoff(() => ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Strong reasoning for design layout
      contents: prompt,
      config: {
        temperature: 0.5,
      }
    }));

    return parseJsonResponse<DesignSpec>(response.text);

  } catch (error) {
    console.error("Gemini Single Design Spec Gen Error:", error);
    throw error;
  }
};

export const regenerateSwipeScreen = async (
  profile: ProductProfile,
  currentScreen: SwipeScreen,
  instruction: string,
  apiKey: string
): Promise<SwipeScreen> => {
  const prompt = `
    ${JAPANESE_COPYWRITER_ROLE}
    
    あなたはスワイプ型LPの専門エディターです。
    特定のスライドに対して、ユーザーから修正指示がありました。
    
    --- 製品情報 ---
    製品名: ${profile.productName}
    UVP: ${profile.uniqueValueProposition}
    
    --- 現在のスライド内容 ---
    タイトル: ${currentScreen.title}
    本文: ${currentScreen.mainCopy}
    画像の指示: ${currentScreen.visualDescription}
    役割: ${currentScreen.type}
    
    --- ユーザーからの修正指示 ---
    "${instruction}"
    
    --- ガイドライン ---
    - ユーザーの指示に従って、コピーや内容を修正してください。
    - 内容が薄くならないように、説得力を持たせてください。
    - スライドの役割（${currentScreen.type}）や順序（${currentScreen.order}）は変更しないでください。
    - **デザイン指示書(designSpec)は変更せず、そのまま保持するか、コピーの変更に合わせて微調整してください。**
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

    return parseJsonResponse<SwipeScreen>(response.text);
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
  const fileList = uploadedFiles.map(f => `- ${f.name}`).join('\n');

  const prompt = `
    あなたはモバイルLP専門のアートディレクターです。
    特定のスライドの「デザイン指示書」に対して、ユーザーから修正指示がありました。
    コピーの内容は変更せず、デザインの指定のみを修正してください。

    --- 現在のコピー情報 ---
    タイトル: ${currentScreen.title}
    本文: ${currentScreen.mainCopy}

    --- 現在のデザイン指示 ---
    ${JSON.stringify(currentScreen.designSpec || {}, null, 2)}

    --- 利用可能なアセット ---
    ${fileList}

    --- ユーザーからの修正指示 ---
    "${instruction}"

    --- ガイドライン ---
    - アスペクト比9:16、縦スワイプLPであることを忘れないでください。
    - **上下分割レイアウトは禁止です。必ずフルスクリーン画像＋テキストオーバーレイにしてください。**
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
  uploadedFiles: UploadedFile[],
  apiKey: string
): Promise<string> => {
  if (!screen.designSpec) throw new Error("デザイン指示書がありません。");

  // Create prompt based on design spec and copy
  const prompt = `
    Create a high-quality vertical image (Aspect Ratio 9:16) for a mobile landing page (Magazine/Poster style).
    
    Headline Text to Render (Big, Impactful): "${screen.title}"
    Body Text to Render (Readable): "${screen.mainCopy}"
    
    Visual Style:
    ${screen.designSpec.visualAssetInstruction}
    ${screen.designSpec.colorPalette}
    
    Layout Instructions (MUST FOLLOW):
    ${screen.designSpec.layoutBlueprint}
    - The design MUST be FULL SCREEN (wallpaper style).
    - Text must be overlayed on the background image.
    - DO NOT create a split screen (top image / bottom text).
    
    **CRITICAL NEGATIVE PROMPT / CONSTRAINTS:**
    - **Do NOT render a smartphone bezel, frame, device mockup, or hand holding a phone.**
    - The image IS the screen content itself. It should be full-bleed.
    - Do not produce low-density "blog" graphics. Make it look like a high-end magazine ad or infographic.
  `;

  const parts: any[] = [{ text: prompt }];

  try {
    const ai = getAI(apiKey);
    const response = await retryWithBackoff(() => ai.models.generateContent({
      model: 'nano-banana-pro-preview',
      contents: { parts: parts },
      config: {
        // imageConfig: {
        //   aspectRatio: "9:16",
        //   imageSize: "1K"
        // }
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
  const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/```([\s\S]*?)```/) || [null, text];
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