import { GoogleGenAI } from '@google/genai';
import * as fs from 'fs';
import 'dotenv/config';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

function pcmToWav(pcmData: Uint8Array, sampleRate: number = 24000, numChannels: number = 1): Uint8Array {
  const byteRate = sampleRate * numChannels * 2;
  const blockAlign = numChannels * 2;
  const dataSize = pcmData.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const out = new Uint8Array(buffer);
  out.set(pcmData, 44);
  return out;
}

async function run() {
  console.log('Fetching TTS...');
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: 'Say exactly: Hello world, this is a test of the audio system.',
    config: {
      responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
    }
  });

  const parts = response.candidates?.[0]?.content?.parts || [];
  const audioPart = parts.find((p: any) => p.inlineData);
  
  if (audioPart && audioPart.inlineData?.data) {
    console.log('Audio part found!', JSON.stringify(parts, null, 2));
    const pcmBuffer = Buffer.from(audioPart.inlineData.data, 'base64');
    
    // Attempt Little Endian conversion
    const pcm16 = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.byteLength / 2);
    const leBuffer = new Uint8Array(pcm16.length * 2);
    const view = new DataView(leBuffer.buffer);
    for (let i = 0; i < pcm16.length; i++) {
      const val = pcmBuffer.readInt16LE(i * 2);
      view.setInt16(i * 2, val, true);
    }

    const wavBuffer = pcmToWav(leBuffer, 24000, 1);
    fs.writeFileSync('test_output.wav', wavBuffer);
    console.log('Wrote test_output.wav, size:', wavBuffer.length);
  } else {
    console.log('No audio part found. Full response:', JSON.stringify(response, null, 2));
  }
}

run().catch(console.error);
