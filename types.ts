import React from 'react';

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  image?: string; // Base64 data string
  isError?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  persona?: PersonaType; // Track which persona was active
}

export enum LoadingState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  STREAMING = 'STREAMING',
}

export interface QuickPrompt {
  id: string;
  label: string;
  prompt: string;
  icon: React.ReactNode;
}

export type PersonaType = 'GURU' | 'PEER';

export interface PersonaDefinition {
  id: PersonaType;
  name: string;
  subLabel: string;
  icon: React.ReactNode;
  color: string;
  intro: string;
}