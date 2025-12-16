import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ProductProfile, UploadedFile, SwipeLP, SwipeScreen, DesignSpec } from '../types';

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
    trackRecord: { type: Type.STRING, description: "実績（例：累計販売数、満足度、リピート率）。不明な場合は空文字。" }
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
        trackRecord: "リピート率92%"
      },
      summary: "モックデータによる分析結果です。",
      hypothetical: false
    };
  }

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
       - **【重要】マーケティング要素の抽出**: 以下の要素があれば必ず抽出してください。なければ空欄で構いません。
         - **価格**: 通常価格、セット価格など。
         - **オファー**: 割引率、特典、キャンペーン、保証（返金保証など）。
         - **権威性**: 受賞歴、No.1実績、専門家の推薦、メディア掲載。
         - **限定性**: 期間、個数、先着順などの制限。
         - **独自性**: 特許、独自成分、世界初などの差別化要素。
         - **実績**: 販売数、満足度、リピート率、導入社数。

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
  isMangaMode: boolean = false
): Promise<SwipeLP> => {
  if (USE_MOCK_API) {
    console.log("Using Mock API for generateSwipeLP");
    await delay(2000);
    return {
      concept: "Mock Concept: Easy Diet",
      mainCharacterDesign: "30代女性、オフィスカジュアル、少し疲れた表情から笑顔へ",
      screens: [
        {
          order: 1,
          type: 'hook',
          title: "まだ無理なダイエットしてる？",
          mainCopy: "辛い食事制限も、激しい運動も、もう必要ありません。",
          visualStyle: isMangaMode ? 'manga' : 'standard',
          designSpec: {
            layoutBlueprint: "インパクトのある問いかけ",
            visualAssetInstruction: "驚いた表情の女性",
            typographyInstruction: "太字で強調",
            colorPalette: "#FF0000"
          },
          mangaScript: isMangaMode ? {
            panel1: { panelNumber: 1, situation: "体重計に乗る", dialogue: "えっ…また増えてる？" },
            panel2: { panelNumber: 2, situation: "鏡を見る", dialogue: "服がきつい…" },
            panel3: { panelNumber: 3, situation: "ため息", dialogue: "もう何やってもダメなのかな" },
            panel4: { panelNumber: 4, situation: "謎の光", dialogue: "諦めるのはまだ早い！" }
          } : undefined
        },
        {
          order: 2,
          type: 'problem',
          title: "その原因は「代謝」かも",
          mainCopy: "年齢とともに下がる代謝。努力だけではどうにもなりません。",
          visualStyle: isMangaMode ? 'manga' : 'standard',
          designSpec: {
            layoutBlueprint: "グラフで説明",
            visualAssetInstruction: "代謝低下のグラフ",
            typographyInstruction: "冷静なトーン",
            colorPalette: "#0000FF"
          },
          mangaScript: isMangaMode ? {
            panel1: { panelNumber: 1, situation: "解説キャラ登場", dialogue: "それは代謝のせいかも！" },
            panel2: { panelNumber: 2, situation: "グラフを見せる", dialogue: "30代から急激に落ちるのよ" },
            panel3: { panelNumber: 3, situation: "驚く主人公", dialogue: "知らなかった…" },
            panel4: { panelNumber: 4, situation: "解決策の提示", dialogue: "だからこれを補うの" }
          } : undefined
        },
        {
          order: 3,
          type: 'solution',
          title: "そこで「Mock Supplement」",
          mainCopy: "1日1粒で、あなたの「燃える力」をサポートします。",
          visualStyle: 'standard', // Force standard for product
          designSpec: {
            layoutBlueprint: "商品パッケージ中心",
            visualAssetInstruction: "商品画像",
            typographyInstruction: "高級感",
            colorPalette: "#Gold"
          }
        }
      ]
    };
  }

  // 1. MANGA MODE PROMPT (Story & Marketing Hybrid)
  const PROMPT_MANGA_MODE = `
    **ROLE: Professional Japanese Webtoon (Vertical Scroll Manga) Scriptwriter & Marketer**
    
    **GOAL**: Create a highly engaging, story-driven "Manga LP" (8-20 slides) that seamlessly sells the product using the **PASTOR Formula**.
    
    **CRITICAL INSTRUCTION: UNIFIED BLUEPRINT GENERATION**
    - **MANGA PART (Slides 1-[Mid])**:
      - \`visualStyle\`: 'manga'
      - **OUTPUT**: 
        - Generate \`mangaScript\` (Panel 1-4 details).
        - Generate \`designSpec\` (Describe the 4-panel layout and character style).
      - **DO NOT** generate \`title\` or \`mainCopy\`. Leave them empty or null.
      - **CONTENT & TONE**: 
        - **Natural Japanese Dialogue**: Use casual, conversational Japanese (e.g., "〜だよね", "〜かも？", "マジで？"). Avoid stiff textbook Japanese.
        - **Story Flow**: Intro (Sympathy) -> Twist (Crisis) -> Discovery (Solution).
        - **Character Dynamics**: Create a relatable protagonist with distinct emotional reactions.
    
    - **SALES PART (Slides [Mid]-[End])**:
      - \`visualStyle\`: 'standard' (Hybrid)
      - **OUTPUT**: 
        - Generate \`designSpec\` (Detailed layout, visuals, typography).
        - Generate \`mainCopy\` (Standard Marketing Copy).
      - **DO NOT** generate \`mangaScript\`.
      - **CONTENT**: Offer, Authority, Scarcity, Call to Action.
      - **TONE**: Use standard, persuasive marketing copy (NOT dialogue). Clear, professional, and benefit-driven.
    
    **PASTOR FORMULA**:
      1. **P (Problem)**: Protagonist's daily life & struggle. (SHOW, DON'T TELL)
      2. **A (Agitation)**: The problem gets worse (Crisis).
      3. **S (Solution)**: Discovery of the product.
      4. **T (Transformation)**: Life after using the product (Happy Ending).
      5. **O (Offer)**: Product details, price, authority, scarcity.
      6. **R (Response)**: Call to Action.
    
    **OUTPUT SCHEMA**:
    - Use the provided JSON schema.
    - **ALWAYS generate \`designSpec\` for ALL slides (including Manga).**
    - For 'manga' slides, populate \`mangaScript\`.
    - For 'standard' slides, populate \`mainCopy\`.
  `;

  // 2. STANDARD MODE PROMPT (Strictly Copy & Marketing)
  const PROMPT_STANDARD_MODE = `
    **ROLE: Top-tier Landing Page Copywriter & Art Director**
    
    **GOAL**: Create a high-converting Swipe LP (8-20 slides) based on the product profile.
    
    **CRITICAL INSTRUCTION: UNIFIED BLUEPRINT GENERATION**
    - **ALL SLIDES**:
      - \`visualStyle\`: 'standard'
      - **OUTPUT**: 
        - Generate \`mainCopy\` (Short, punchy copy).
        - Generate detailed \`designSpec\` (Layout, Visuals, Typography, Color).
      - **DO NOT** generate \`mangaScript\`.
      
    **DEFAULT MODEL RULE**: 
    - Unless explicitly instructed otherwise, **ALWAYS describe the model/persona as 'Japanese'** (Japanese woman/man).
    
    **STRUCTURE (PAS/AIDA)**:
      1. **Problem**: "Are you struggling with...?"
      2. **Agitation**: "If left alone, it becomes..."
      3. **Solution**: "Here is the Product!"
      4. **Benefit/Proof**: "Why it works."
      5. **Offer**: "Buy now."
    
    **OUTPUT SCHEMA**:
    - **ALWAYS generate \`designSpec\` for ALL slides.**
    - \`mainCopy\`: Short, punchy copy.
  `;

  // 3. MANIFEST MODE PROMPT (Poster-like, Product-First)
  const PROMPT_MANIFEST_MODE = `
    **ROLE: Luxury Advertising Creative Director & Direct Response Copywriter**
    
    **GOAL**: Create a high-impact, "Poster-Style" Swipe LP (8-15 slides) targeting "Manifest" (High Intent) users.
    
    **KEY STRATEGY**: 
    - **NO FLUFF / NO STORIES**: Users already know what they want. Show them the PRODUCT and the OFFER immediately.
    - **POSTER VISUALS**: Every slide should look like a standalone high-end advertisement poster. High information density but clean layout.
    
    **DEFAULT MODEL RULE**: 
    - Unless explicitly instructed otherwise, **ALWAYS describe the model/persona as 'Japanese'** (Japanese woman/man).

    **CRITICAL INSTRUCTION: FV (FIRST VIEW - Slide 1) RULE**:
    - **Slide 1 MUST be a "Perfect Commercial Poster" containing ALL 4 elements**:
      1. **PRODUCT IMAGE** (Hero shot)
      2. **CATCH COPY** (Benefit-driven)
      3. **HARD OFFER** (Price/Discount/Campaign - e.g. "50% OFF Now")
      4. **MODEL/PERSONA** (Target user using/holding the product - **MUST BE JAPANESE**)
    - **Design Spec for Slide 1**: "Magazine Cover-like layout. Full-screen model/background with product overlay. Big bold typography for Offer."
    
    **STRUCTURE (Direct Response)**:
      1. **FV (Impact)**: Product + Offer + Catch + Model (ALL IN ONE).
      2. **Benefit 1**: The #1 reason to buy.
      3. **Benefit 2**: The #2 reason to buy.
      4. **Proof/Authority**: No.1 Badge, Doctor recommendation, or Testimonial.
      5. **Comparison/USP**: Why this product > Others.
      6. **Offer (Detail)**: "Campaign ends soon".
      7. **CTA**: "Buy Now".

    **OUTPUT SCHEMA**:
    - \`visualStyle\`: 'standard' (for all)
    - **ALWAYS generate \`designSpec\`**.
    - \`designSpec.layoutBlueprint\`: STRICTLY "Poster Style" instructions.
  `;

  let selectedPrompt = PROMPT_STANDARD_MODE;
  if (targetSegment === 'manifest') {
    selectedPrompt = PROMPT_MANIFEST_MODE;
  } else if (isMangaMode) {
    selectedPrompt = PROMPT_MANGA_MODE;
  }

  const prompt = `
    ${selectedPrompt}

    --- 製品プロファイル ---
    製品名: ${profile.productName}
    カテゴリー: ${profile.category}
    ターゲット: ${profile.targetAudience}
    提供価値(UVP): ${profile.uniqueValueProposition}
    悩み: ${profile.painPoints.join(', ')}
    解決策: ${profile.solutions.join(', ')}
    トーン: ${isMangaMode ? '親しみやすい、感情豊かなキャラクター口調（タメ口や自然な会話）' : profile.toneOfVoice}
    価格: ${profile.price || ''}
    オファー: ${profile.discountOffer || ''}
    権威性: ${profile.authority || ''}
    限定性: ${profile.scarcity || ''}
    独自性: ${profile.uniqueness || ''}
    実績: ${profile.trackRecord || ''}

    --- 制作ガイドライン(厳守) ---
    ${SWIPE_LP_GUIDELINES}

    重要指示：
    1. **FVのインパクト**: 1枚目は勝負です。${targetSegment === 'latent' ? '「えっ？」と思わせる意外性や、深い共感' : '「これだ！」と思わせる圧倒的なベネフィット（商品名・オファー必須）'} で惹きつけてください。
    2. **インタラクティブ要素**: 序盤に必ず「チェックリスト」や「診断」のスライドを入れてください。
    3. **枚数**: **全8〜20枚**の範囲で、最適な枚数にしてください（6枚で終わらせないこと）。
    4. **visualStyle**: ${isMangaMode ? "基本は 'manga' ですが、商品スペックやオファーの強調が必要なスライドのみ 'standard' に切り替えても構いません。" : "全て 'standard' にしてください。"}

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