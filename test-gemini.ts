import { GoogleGenAI } from '@google/genai'; import 'dotenv/config';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function testAudio() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'مرحباً، كيف حالك اليوم؟',
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Aoede',
            }
          }
        }
      }
    });

    console.log(parts);
    const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (audioPart) {
      console.log('Audio type:', audioPart.inlineData.mimeType);
      console.log('Audio data length:', audioPart.inlineData.data.length);
    } else {
      console.log('No audio part found');
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

async function testSearch() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'What is the latest news about OpenAI today?',
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0, responseMimeType: 'application/json',
      }
    });
    console.log('Search response:', response.text);
  } catch (err) {
    console.error('Error:', err);
  }
}

testAudio().then(() => testSearch());
