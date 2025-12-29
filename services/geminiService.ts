import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { Message } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

let chatSession: Chat | null = null;

// Initialize chat, optionally with history and specific system instruction
export const initializeChat = (historyMessages: Message[] = [], systemInstruction: string) => {
  // Convert our Message format to Gemini API history format
  // Note: We filter out error messages and valid parts
  const formattedHistory = historyMessages
    .filter(msg => !msg.isError)
    .map(msg => {
      const parts: any[] = [];
      
      if (msg.image) {
        // Extract base64 data and mime type
        // Data URI format: data:image/png;base64,.....
        const matches = msg.image.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
          parts.push({
            inlineData: {
              mimeType: matches[1],
              data: matches[2]
            }
          });
        }
      }
      
      if (msg.text) {
        parts.push({ text: msg.text });
      }

      return {
        role: msg.role,
        parts: parts
      };
    });

  chatSession = ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: systemInstruction,
      temperature: 0.9, // Slightly higher for more creativity in personas
      topK: 40,
    },
    history: formattedHistory
  });
};

export const sendMessageStream = async (text: string, image?: string, systemInstructionOverride?: string): Promise<AsyncIterable<GenerateContentResponse>> => {
  // If session doesn't exist or we strictly need to re-init (though usually handled by caller), init it.
  if (!chatSession && systemInstructionOverride) {
    initializeChat([], systemInstructionOverride);
  }
  
  try {
    if (!chatSession) throw new Error("Chat session not initialized");
    
    // Construct the message payload
    let messagePayload: any;

    if (image) {
      const matches = image.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        messagePayload = [
          {
            inlineData: {
              mimeType: matches[1],
              data: matches[2]
            }
          },
          { text: text }
        ];
      } else {
        messagePayload = text;
      }
    } else {
      messagePayload = text;
    }

    // Pass the payload to message parameter
    const result = await chatSession.sendMessageStream({ message: messagePayload });
    return result;
  } catch (error) {
    console.error("Error sending message to Gemini:", error);
    // If we have an override, try to re-init and retry? 
    // For simplicity, we just throw, and the UI handles the error state.
    throw error;
  }
};