import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ProductProfile, UploadedFile, SwipeLP, SwipeScreen, DesignSpec } from '../types';

// Helper to get a fresh client instance with the current API key
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

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
# スワイプ型LP制作ガイドライン（記事LP・雑誌スタイル）

## レイアウトの絶対原則：脱・ブログ調
1. **上下分割レイアウトの禁止**: 画像が上、文字が下といった安易なブログ記事のようなレイアウトは禁止です。
2. **1枚絵（フルスクリーン）の徹底**: すべてのスライドは「背景全面にビジュアルがあるポスター形式」で作ってください。文字はその上にオーバーレイ（重ねて）配置します。
3. **雑誌・ポスターのようなクオリティ**: 視覚的なインパクトを最優先します。

## コンテンツ戦略（重要：情報密度と権威性）
1. **コンテンツの充実 = 視覚情報の密度**: 単に文字を増やすのではなく、「グラフ」「比較表」「No.1バッジ」「権威者の顔写真」「成分図解」などの視覚的なエビデンスを多用してください。
2. **FV（1枚目）は命**: 1枚目はユーザーが続きを見るかを決めるキービジュアルです。商品画像と強力なキャッチコピーを組み合わせた、圧倒的なクオリティの表紙にしてください。
3. **教育的価値**: 読者が「へぇ〜」「知らなかった」と思う知識を提供し、信頼を勝ち取ってください。

## ストーリーテリング
- **序盤**: 問題提起は「自分ごと化」できる具体的なシーンで。
- **中盤**: 解決策の提示には、必ず「根拠（Why）」となる図解やデータを添えること。
- **終盤**: CTAだけでなく、特典や保証などのオファーを明確に視覚化する。
`;

const JAPANESE_COPYWRITER_ROLE = `
# Role & Mindset
あなたは「日本人の心を動かす、日本語ネイティブの熟練プロコピーライター」です。
あなたの役割は、英語圏のマーケティング手法（DRM）を直訳したような違和感のある文章ではなく、日本の文化的背景（ハイコンテキスト文化）に根ざした、信頼と共感を生む自然な日本語の文章を書くことです。

# Core Instruction: "Think in Japanese"
これからの出力において、以下のプロセスを徹底してください。
1. 脳内で英語で思考してから日本語に翻訳することを禁止します。
2. 最初から「日本語の構造」で論理を組み立ててください。
3. 「翻訳調（バタ臭さ）」を徹底的に排除してください。

# Style Guidelines (禁止・推奨事項)

## 1. 「」カギカッコの厳格な使用制限
AI特有の「強調のために『』を多用する癖」を完全に排除してください。
- 【禁止】単なる強調、概念、一般名詞を「」で囲むこと。（例：「成功」を手にする、「集客」の仕組み）
- 【許可】第三者の発話の引用、書籍名・作品名などの固有名詞。
- 【原則】強調したい場合は記号に頼らず、語順や助詞（〜こそ、〜は）、前後の文脈で表現してください。

## 2. 英語DRM直訳調（バタ臭さ）の排除
アメリカのセールスレターに見られるような、過剰な演出や演説調を避けてください。
- 【禁止表現】
    - 「想像してみてください」（Imagine...）
    - 「さあ、あなたの番です」（Now it's your turn.）
    - 「あなたの人生が劇的に変わります」（Life-changing...）
    - 「〜への扉を開けましょう」
    - 過剰な「！」の使用
- 【推奨トーン】
    - 読者に寄り添う「noteのエッセイ」や「良質なオウンドメディア」のトーン。
    - 煽りではなく、事実とロジックによる「静かな説得」。
    - 「売り込み」ではなく「提案・気づき」のスタンス。

## 3. 日本語としての自然さ（ハイコンテキスト対応）
- 英語的な「主語（私は、あなたは）」の頻出を避けてください。文脈で分かる場合は主語を省略するのが自然な日本語です。
- 接続詞（しかし、そして、また）を文頭に置きすぎないようにしてください。
`;

export const analyzeProductContext = async (files: UploadedFile[]): Promise<ProductProfile> => {
  if (files.length === 0) {
    throw new Error("分析するファイルがありません。");
  }

  const prompt = `
    あなたは熟練のマーケティング戦略家であり、コピーライターです。
    
    提供されたテキスト、画像、動画、PDF、およびURL情報から、製品、サービス、またはブランドに関する情報を分析してください。
    URLが提供された場合は、Google検索ツールを使用してそのページの内容を考慮してください。
    
    あなたのタスクは、これらを分析し、包括的な「製品プロファイル」を作成することです。
    このプロファイルは、後で「Swipe LP」（モバイルファーストのスワイプ可能なランディングページ）を生成するために使用されます。
    
    必ず以下のJSONスキーマ形式のみで出力してください。Markdownのコードブロック( \`\`\`json ... \`\`\` )で囲んでください。
    
    Schema:
    ${JSON.stringify(PRODUCT_PROFILE_SCHEMA, null, 2)}
    
    マーケティングの重要な柱を効果的に抽出してください。
    出力は日本語で行ってください。
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
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: { parts: parts },
      config: {
        temperature: 0.3,
        tools: [{ googleSearch: {} }] // Enable Google Search grounding
      }
    });

    return parseJsonResponse<ProductProfile>(response.text);

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

export const generateSwipeLP = async (profile: ProductProfile): Promise<SwipeLP> => {
  const prompt = `
    ${JAPANESE_COPYWRITER_ROLE}

    あなたは売れるスワイプ型LP（ランディングページ）専門のコンテンツクリエイターでもあります。
    以下の製品プロファイルと、スワイプLPの制作ガイドラインに基づいて、
    スマートフォンで閲覧した際に最も効果的な「スワイプLP」の構成案（全15〜20枚程度）を作成してください。

    --- 製品プロファイル ---
    製品名: ${profile.productName}
    カテゴリー: ${profile.category}
    ターゲット: ${profile.targetAudience}
    提供価値(UVP): ${profile.uniqueValueProposition}
    悩み: ${profile.painPoints.join(', ')}
    解決策: ${profile.solutions.join(', ')}
    トーン: ${profile.toneOfVoice}
    
    --- 制作ガイドライン (これを厳守してください) ---
    ${SWIPE_LP_GUIDELINES}
    
    重要：
    - 今回のLPは「縦スワイプ（Vertical Swipe）」形式です。TikTokやShortsのように下から上へスワイプする体験を想定してください。
    - **内容が薄くならないようにしてください。** 各スライドにおいて、ターゲット読者が抱える疑問や不安を完全に払拭できるだけの「十分な情報量」と「説得力のあるコピー」を記述してください。
    - スライド数は **15枚〜20枚** を目指し、ストーリーを丁寧に展開してください。
    - **visualDescription** には、単なる写真だけでなく「グラフ」「比較表」「図解」「受賞バッジ」など、視覚的に信頼性を高める要素の作成指示も含めてください。

    出力形式:
    必ず以下のJSONスキーマに従ってください。Markdownコードブロックで囲んでください。
    
    Schema:
    ${JSON.stringify(SWIPE_LP_SCHEMA, null, 2)}
    
    各スライドの 'title' は短くインパクトのあるものに、
    'mainCopy' は読みやすく、かつ深い情報を提供するようにしてください。
  `;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 4096 } // Use thinking for structure
      }
    });

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
  concept: string
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
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // Strong reasoning for design layout
      contents: prompt,
      config: {
        temperature: 0.5,
      }
    });

    return parseJsonResponse<DesignSpec>(response.text);

  } catch (error) {
    console.error("Gemini Single Design Spec Gen Error:", error);
    throw error;
  }
};

export const regenerateSwipeScreen = async (
  profile: ProductProfile,
  currentScreen: SwipeScreen,
  instruction: string
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
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });

    return parseJsonResponse<SwipeScreen>(response.text);
  } catch (error) {
    console.error("Gemini Regenerate Screen Error:", error);
    throw error;
  }
};

export const regenerateDesignSpec = async (
  currentScreen: SwipeScreen,
  uploadedFiles: UploadedFile[],
  instruction: string
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
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });

    return parseJsonResponse<DesignSpec>(response.text);
  } catch (error) {
    console.error("Gemini Regenerate Design Spec Error:", error);
    throw error;
  }
};

export const generateSwipeScreenImage = async (
  screen: SwipeScreen,
  uploadedFiles: UploadedFile[]
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
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: parts },
      config: {
        imageConfig: {
          aspectRatio: "9:16",
          imageSize: "1K"
        }
      }
    });

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