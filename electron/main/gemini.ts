import { GoogleGenAI } from '@google/genai'

function getApiKey(): string | null {
  return process.env.GEMINI_API_KEY || null
}

interface SongStoryResult {
  story: string
  meaning: string
  trivia: string
}



/**
 * Generate a Song Story with cultural/historical context in Egyptian Arabic using Search Grounding.
 */
export async function generateSongStory(
  title: string,
  artist: string
): Promise<SongStoryResult> {
  const fallback: SongStoryResult = {
    story: 'مفيش معلومات كافية عن الأغنية دي دلوقتي، بس إن شاء الله هنجيبلك التفاصيل قريب.',
    meaning: 'الأغنية دي ليها معاني كتير ممكن كل واحد يحس بيها بشكل مختلف.',
    trivia: 'كل أغنية وراها قصة.. وقصة الأغنية دي لسه بنبحث فيها.',
  }

  const apiKey = getApiKey()
  if (!apiKey) {
    console.error('[gemini] No API key for Song Story')
    return fallback
  }

  const ai = new GoogleGenAI({ apiKey })

  const systemPrompt = `Act as an expert music historian and persistent investigative researcher. Your goal is to reveal the *real* behind-the-scenes secrets of the given song. The output must be written entirely in an engaging, storytelling Egyptian Arabic dialect (Ammiya). 
Do not use any asterisks, bold marks, or special symbols in the text. 
CRITICAL RULES:
1. FOCUS ON FACTS: Use Google Search to find rare, controversial, or "behind-the-scenes" facts that are not widely known (e.g., hidden inspirations, secret studio conflicts). Do NOT provide common or surface-level knowledge. Do NOT write generic fluff.
2. BE CONCISE: Each section (story, meaning, trivia) MUST be exactly 1 to 2 short, punchy sentences.
Structure the response in JSON format with these keys: 'story' (the real backstory/drama), 'meaning' (the hidden message), and 'trivia' (a shocking/fun fact). Return ONLY the JSON object, no markdown code fences.`

  const userPrompt = `Song: "${title}" by ${artist}`

  try {
    console.log('[gemini] Fetching Song Story with Search Grounding...')
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.9,
        tools: [{ googleSearch: {} }], // Enable Google Search grounding
      }
    })

    const text = response.text
    if (!text) throw new Error('Empty response')

    // Clean any markdown fences that the model might add since we removed the strict mimeType
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
    const parsed = JSON.parse(cleaned)

    return {
      story: (parsed.story || fallback.story).replace(/[*_#`~]/g, ''),
      meaning: (parsed.meaning || fallback.meaning).replace(/[*_#`~]/g, ''),
      trivia: (parsed.trivia || fallback.trivia).replace(/[*_#`~]/g, ''),
    }
  } catch (err) {
    console.error('[gemini] Song story error:', err)
    return fallback
  }
}
