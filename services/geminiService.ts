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
  const ai = getAI(apiKey);

  const prompt = `
    あなたは熟練のマーケティング戦略家であり、コピーライターです。
    提供されたテキスト、画像、動画、PDF、およびURL情報から、製品、サービス、またはブランドに関する情報を分析してください。
    
    **ターゲット層戦略:**
    あなたは現在、**${targetSegment === 'latent' ? '潜在層 / 準顕在層 (まだニーズに気づいていない顧客)' : '顕在層 (積極的に検索している顧客 / ブランド指名検索者)'}** をターゲットとしています。
    
    ${targetSegment === 'latent' ? `
    **潜在層向け戦略:**
    - 「教育」と「共感」に焦点を当てます。
    - ユーザーはまだこの製品の必要性を認識していません。
    - 深層にある「隠れた悩み」や「潜在的なニーズ」を特定します。
    - 「解決策」は、ユーザーにとっての「発見」として提示されるべきです。
    ` : `
    **顕在層向け戦略:**
    - 「差別化」、「比較」、および「即時的なメリット」に焦点を当てます。
    - ユーザーはすでに解決策や特定のブランドを探しています。
    - 競合他社と比較して「なぜこの製品なのか？」（USP）を明確にします。
    - 「解決策」は直接的で説得力があり、今すぐ購入する強力な理由を提供するものでなければなりません。
    `}

    **分析のステップ:**
    1. **提供情報の分析**: まず、ユーザーから提供されたテキストやURL（文字列としての意味）を徹底的に読み解いてください。
       - 特に**「商品分析資料」**として指定されたファイルがある場合は、その内容を最優先で分析の根拠としてください。
       - **「デザイン参考(トンマナ)」**として指定された画像がある場合は、その視覚的な雰囲気（色使い、フォントの印象、高級感/親しみやすさ等）を言語化し、「トーン & マナー」の分析に反映させてください。
    2. **Google検索による補完**: 次に、Google検索を使用して、競合他社、市場トレンド、ターゲット層の悩み（知恵袋など）をリサーチし、情報を補完してください。
    
    **重要: 情報が取得できない場合の対応**
    - URLが検索でヒットしない、またはアクセスできない場合でも、**絶対に「不明」「未設定」などの空欄で返さないでください。**
    - その場合は、URLの文字列や一般的な業界知識から推測し、**「もしこの製品が存在するとしたら、どのようなプロファイルが理想的か？」という観点で、架空の（しかし説得力のある）プロファイルを生成してください。**
    - ターゲット層や悩みは、そのカテゴリーにおける一般的なものを適用してください。
    - 架空のプロファイルを生成した場合は、summaryにその旨を記載してください。
    
    あなたのタスクは、これらを分析し、**「${targetSegment === 'latent' ? 'まだ商品の必要性に気づいていない潜在層' : '比較検討中の顕在層'}」** に響くような切り口を見つけることです。
    
    必ず以下のJSONスキーマ形式のみで出力してください。Markdownのコードブロック( \`\`\`json ... \`\`\` )で囲んでください。
    
    Schema:
    ${JSON.stringify(PRODUCT_PROFILE_SCHEMA, null, 2)}
    
    分析のポイント:
    - 機能そのものより、その機能がもたらす「感情的価値」や「生活の変化」に着目してください。
    - ${targetSegment === 'latent' ? '潜在層が抱えているであろう「隠れた悩み」や「諦めていること」を言語化してください。' : '競合との違いや、今すぐ選ぶべき理由を明確にしてください。'}
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
    const response = await retryWithBackoff(() => ai.models.generateContent({
      model: 'gemini-2.0-flash-exp', // Updated model
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
  isMangaMode: boolean = false
): Promise<SwipeLP> => {
  const prompt = `
    ${JAPANESE_COPYWRITER_ROLE}

    あなたは${isMangaMode ? '**「Webtoon（縦読みマンガ）の原作脚本家」**' : `**「${targetSegment === 'latent' ? '潜在層 (まだニーズに気づいていない)' : '顕在層 (比較検討中・指名検索)'}」**の心を掴んで離さないスワイプLPの構成作家`}です。
    以下の製品プロファイルと、ガイドラインに基づいて、
    ${isMangaMode ? '**「読者が主人公に感情移入してしまう」** マンガ風スワイプLPの構成案（全8〜20枚程度）' : '**「つい最後まで見てしまう」** スワイプLPの構成案（全8〜20枚程度で、最適な枚数）'}を作成してください。

    ${isMangaMode ? `
    **【重要】マンガモードの特別指示（ハイブリッド構成）:**
    - **構成**: 「マンガで教育」→「商品セールス」という流れを作ってください。
    - **前半（1〜3枚目）**: **「visualStyle: 'manga'」**を指定してください。読者の悩みや共感を呼ぶストーリーを「4コマ漫画」形式で描いてください。
    - **後半（4〜5枚目）**: **「visualStyle: 'standard'」**を指定してください。解決策としての「商品」を魅力的に見せる、通常のLPデザインに切り替えてください。
    - **mainCopy**: マンガ部分は「セリフ」、セールス部分は「キャッチコピー」にしてください。
    - **枚数**: 全4〜6枚程度で、マンガからセールスへ自然につなげてください。
    ` : `
    ${targetSegment === 'latent' ? `
    **【重要】潜在層向けのアプローチ:**
    - **「売り込み」は厳禁**です。まずは「共感」と「気づき」から入ってください。
    - 1枚目〜3枚目で「あ、これ私のことだ」と思わせる**自分事化**を徹底してください。
    - 商品の登場は中盤以降にしてください。まずは「なぜ今のままではダメなのか？」を伝えてください。
    ` : `
    **【重要】顕在層向けのアプローチ:**
    - **「結論（ベネフィット）」**から入ってください。
    - **1枚目に必ず「商品名」と「オファー（キャンペーンや特典）」を明記してください。**
    - 1枚目から「この商品が他とどう違うのか」を明確に示してください。
    - 比較、権威性、実績、オファーなど、**「今すぐ選ぶ理由」**を畳み掛けてください。
    `}
    `}

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
    1. **FVのインパクト**: 1枚目は勝負です。${targetSegment === 'latent' ? '「えっ？」と思わせる意外性や、深い共感' : '「これだ！」と思わせる圧倒的なベネフィット（商品名・オファー必須）'}で惹きつけてください。
    2. **インタラクティブ要素**: 序盤に必ず「チェックリスト」や「診断」のスライドを入れてください。
    3. **ストーリー性**: ${targetSegment === 'latent' ? '「悩み共感」→「原因の気づき」→「解決策の提示」→「商品の登場」' : '「結論」→「証拠」→「他社比較」→「オファー」'}という流れを意識してください。
    4. **ビジュアル指示**: visualDescriptionには、単なる写真だけでなく、「図解」「比較グラフ」「チェックリストのデザイン」など、視覚的に分かりやすい要素を具体的に指示してください。

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

  --- コンセプト-- -
    ${concept}

  --- 全体の流れ(Context)-- -
    ${contextScreens}

  --- 利用可能なアセット素材-- -
    ${fileList}
    ※ 画像や動画の素材がここにある場合、積極的にデザイン指示に組み込んでください（ファイル名を指定）。
    ※ 素材がない場合は、具体的な撮影指示や生成AIへのプロンプト指示を書いてください。

--- ターゲットスライド情報-- -
  順序: ${targetScreen.order}
役割: ${targetScreen.type}
タイトル: ${targetScreen.title}
本文: ${targetScreen.mainCopy}
画像イメージ: ${targetScreen.visualDescription}

--- デザイン要件(厳守)-- -
  1. ** アスペクト比 9: 16（縦長全画面）**。
2. ** フルスクリーン・オーバーレイレイアウト **:
- 「画像が上、文字が下」のブログ調レイアウトは ** 禁止 ** です。
- 背景全面に高品質な画像を使用し、その上にテキストを配置してください。
3. ** 可読性の確保 **:
- 背景画像の上に文字を乗せるため、ドロップシャドウ、文字の袋文字、半透明の座布団（テキストボックス）などの処理を具体的に指示してください。
4. ** 視覚情報の密度 **:
- 可能な限り、図解、矢印、グラフ、No.1バッジ、権威性の証明（メダル等）をビジュアルに組み込んでください。
5. ** FV（Scene 1）**:
- 1枚目はポスターの表紙です。最も力強いキービジュアルとタイトルロゴの配置を指示してください。

--- 出力-- -
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

--- 製品情報-- -
  製品名: ${profile.productName}
UVP: ${profile.uniqueValueProposition}

--- 現在のスライド内容-- -
  タイトル: ${currentScreen.title}
本文: ${currentScreen.mainCopy}
画像の指示: ${currentScreen.visualDescription}
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
  isMangaMode: boolean = false
): Promise<string> => {
  const ai = getAI(apiKey);

  // Construct prompt based on design spec
  const spec = screen.designSpec;
  if (!spec) throw new Error("Design Spec is missing");

  // Filter for image files to use as reference/composition
  const imageFiles = files.filter(f => f.mimeType?.startsWith('image/'));

  // Categorize images
  const productImages = imageFiles.filter(f => f.assetType === 'product');
  const characterImages = imageFiles.filter(f => f.assetType === 'character');
  const voiceImages = imageFiles.filter(f => f.assetType === 'voice');
  const designRefImages = imageFiles.filter(f => f.assetType === 'design_reference');
  const otherImages = imageFiles.filter(f => !f.assetType || f.assetType === 'other');

  const isMangaStyle = screen.visualStyle === 'manga' || (!screen.visualStyle && isMangaMode);

  const prompt = `
    Create a high-quality vertical image (9:16 aspect ratio) for a mobile landing page.
    
    ${isMangaStyle ? `
    **STYLE: 4-PANEL VERTICAL MANGA (Webtoon Style)**
    - **LAYOUT**: The image MUST be divided into **4 VERTICAL PANELS STACKED (1 Column, 4 Rows)**.
    - **ORDER**: Panel 1 (Top) -> Panel 2 -> Panel 3 -> Panel 4 (Bottom).
    - **READING DIRECTION**: Top to Bottom (Standard Webtoon format).
    - **CONTENT**: Create a sequence of 4 scenes as described in the Visual Description.
    - **STYLE**: High-quality anime/manga art style.
    - **NO TEXT**: Do not include speech bubbles or text inside the panels.
    - **BORDERS**: Clear horizontal borders between panels.
    ` : `
    **STYLE: Professional Mobile App / Landing Page Design**
    - Modern, clean, and high-impact visual.
    - If the description asks for a photo, make it realistic and high-resolution.
    - If the description asks for an illustration, make it flat, modern, and corporate-friendly.
    `}

    **Visual Description:**
    ${screen.visualDescription}

    **Design Layout:**
    ${spec.layoutBlueprint}

    **Color Palette:**
    ${spec.colorPalette}

    **Important:**
    - Aspect Ratio: 9:16 (Vertical)
    - **NO TEXT**: Do not render any text inside the image. The text will be overlaid by code.
    - High quality, sharp details.

    **ASSET COMPOSITION INSTRUCTIONS:**

    ${productImages.length > 0 ? `
    [PRODUCT IMAGES PROVIDED]
    - Use the provided product image(s) as the HERO element.
    - Composite naturally: Model holding it, placed on a table, or floating in a stylized background.
    - Ensure the product label/logo is visible if possible.
    ` : ''
    }

    ${characterImages.length > 0 ? `
    [CHARACTER/MODEL IMAGES PROVIDED]
    - Use the provided character/model image(s) as the main subject.
    - Maintain their facial features and style.
    - If a product image is ALSO provided, show this character holding/using the product.
    ` : ''
    }

    ${designRefImages.length > 0 ? `
    [DESIGN REFERENCE IMAGES PROVIDED]
    - **STYLE REFERENCE ONLY:** Use these images ONLY for visual style (color palette, lighting, mood, font vibe).
    - **DO NOT COPY THE CONTENT:** Do not reproduce the specific objects, people, or layout of the reference exactly.
    - **ADAPT TO PRODUCT:** Apply this style to the USER'S PRODUCT and content defined above.
    ` : ''
    }

    ${voiceImages.length > 0 && screen.type === 'proof' ? `
    [USER VOICE IMAGES PROVIDED]
    - This is a "User Voice" / Testimonial screen.
    - Use the provided user image as a profile icon or standing figure next to their testimonial.
    ` : ''
    }

    **CRITICAL NEGATIVE PROMPT / CONSTRAINTS:**
    - **Do NOT render a smartphone bezel, frame, device mockup, or hand holding a phone.**
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
}