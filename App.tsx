import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Sparkles, Trash2, Plus, X, 
  MessageSquare, Image as ImageIcon, PanelLeft, ChevronDown
} from 'lucide-react';
import { GenerateContentResponse } from "@google/genai";
import ChatMessage from './components/ChatMessage';
import { Message, LoadingState, ChatSession, PersonaType } from './types';
import { QUICK_PROMPTS, PERSONAS, GET_SYSTEM_INSTRUCTION } from './constants';
import { sendMessageStream, initializeChat } from './services/geminiService';

const App: React.FC = () => {
  // State
  // Default to GURU (Prem Guru)
  const [currentPersona, setCurrentPersona] = useState<PersonaType>('GURU');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  const [isPersonaMenuOpen, setIsPersonaMenuOpen] = useState(false);
  
  // Sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return false;
  });
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const personaMenuRef = useRef<HTMLDivElement>(null);

  // Close persona menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (personaMenuRef.current && !personaMenuRef.current.contains(event.target as Node)) {
        setIsPersonaMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Responsive sidebar handling
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        if (!isSidebarOpen) setIsSidebarOpen(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarOpen]);

  // Load sessions
  useEffect(() => {
    const savedSessions = localStorage.getItem('love_guru_sessions');
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          loadSession(parsed[0].id, parsed);
        } else {
          createNewSession('GURU');
        }
      } catch (e) {
        createNewSession('GURU');
      }
    } else {
      createNewSession('GURU');
    }
  }, []);

  // Save sessions
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('love_guru_sessions', JSON.stringify(sessions));
    }
  }, [sessions]);

  // Handle Persona Change logic - Re-initialize chat with new system instruction but SAME history
  useEffect(() => {
    if (messages.length > 0) {
        const instruction = GET_SYSTEM_INSTRUCTION(currentPersona);
        initializeChat(messages, instruction);
    }
  }, [currentPersona]);

  // Auto-scroll
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loadingState]);

  // Textarea auto-height
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // --- Session Management ---

  const createInitialMessage = (id: string, persona: PersonaType): Message => ({
    id: 'init-' + id,
    role: 'model',
    text: PERSONAS[persona].intro
  });

  const createNewSession = (persona: PersonaType = 'GURU') => {
    const newSessionId = Date.now().toString();
    const initialMessage = createInitialMessage(newSessionId, persona);

    const newSession: ChatSession = {
      id: newSessionId,
      title: 'নতুন ভক্ত',
      messages: [initialMessage],
      createdAt: Date.now(),
      persona: persona
    };

    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSessionId);
    setMessages([initialMessage]);
    setCurrentPersona(persona);
    initializeChat([initialMessage], GET_SYSTEM_INSTRUCTION(persona));
    
    // On mobile, close sidebar after creating new chat
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const loadSession = (sessionId: string, currentSessionsList = sessions) => {
    const session = currentSessionsList.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      setMessages(session.messages);
      
      // Handle legacy personas mapping
      let sessionPersona = (session.persona as string) || 'GURU';
      
      // Migration logic for old keys
      if (sessionPersona === 'BABA') sessionPersona = 'GURU';
      if (sessionPersona === 'MAULA') sessionPersona = 'PEER';
      
      // Safety check
      if (sessionPersona !== 'GURU' && sessionPersona !== 'PEER') {
        sessionPersona = 'GURU';
      }

      const validatedPersona = sessionPersona as PersonaType;
      setCurrentPersona(validatedPersona);
      initializeChat(session.messages, GET_SYSTEM_INSTRUCTION(validatedPersona));
      
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      }
    }
  };

  const deleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    
    if (window.confirm('এই চ্যাটটি ডিলিট করতে চান?')) {
      const remainingSessions = sessions.filter(s => s.id !== sessionId);
      
      if (remainingSessions.length === 0) {
        // Explicitly create a new session state without relying on 'prev' state
        // to avoid race conditions or appending to the list we just meant to empty.
        const newSessionId = Date.now().toString();
        const initialMessage = createInitialMessage(newSessionId, currentPersona);
        const newSession: ChatSession = {
            id: newSessionId,
            title: 'নতুন ভক্ত',
            messages: [initialMessage],
            createdAt: Date.now(),
            persona: currentPersona
        };
        
        setSessions([newSession]);
        setCurrentSessionId(newSessionId);
        setMessages([initialMessage]);
        initializeChat([initialMessage], GET_SYSTEM_INSTRUCTION(currentPersona));
      } else {
        setSessions(remainingSessions);
        if (currentSessionId === sessionId) {
          const nextSession = remainingSessions[0];
          loadSession(nextSession.id, remainingSessions);
        }
      }
    }
  };

  const updateCurrentSession = (updatedMessages: Message[]) => {
    if (!currentSessionId) return;

    setSessions(prev => prev.map(session => {
      if (session.id === currentSessionId) {
        let title = session.title;
        if (session.messages.length <= 1 && updatedMessages.length > 1) {
          const firstUserMsg = updatedMessages.find(m => m.role === 'user');
          if (firstUserMsg) {
            title = firstUserMsg.text.slice(0, 30) + (firstUserMsg.text.length > 30 ? '...' : '');
          }
        }
        return { ...session, messages: updatedMessages, title, persona: currentPersona };
      }
      return session;
    }));
  };

  // --- Image Handling ---

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert("File too large. Please select an image under 5MB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // --- Chat Logic ---

  const handleSendMessage = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if ((!textToSend.trim() && !selectedImage) || loadingState !== LoadingState.IDLE) return;

    const userMsgId = Date.now().toString();
    const newUserMsg: Message = { 
      id: userMsgId, 
      role: 'user', 
      text: textToSend.trim(),
      image: selectedImage || undefined
    };
    
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    updateCurrentSession(updatedMessages);
    
    setInput('');
    setSelectedImage(null);
    setLoadingState(LoadingState.LOADING);

    const botMsgId = (Date.now() + 1).toString();
    const botPlaceholder: Message = { id: botMsgId, role: 'model', text: '' };
    setMessages(prev => [...prev, botPlaceholder]);

    try {
      // Ensure chat is initialized with correct system instruction for current persona
      const instruction = GET_SYSTEM_INSTRUCTION(currentPersona);
      
      const stream = await sendMessageStream(newUserMsg.text, newUserMsg.image, instruction);
      setLoadingState(LoadingState.STREAMING);

      let fullText = '';
      
      for await (const chunk of stream) {
        const chunkText = (chunk as GenerateContentResponse).text;
        if (chunkText) {
          fullText += chunkText;
          setMessages(prev => {
            const newMsgs = prev.map(msg => 
              msg.id === botMsgId ? { ...msg, text: fullText } : msg
            );
            return newMsgs;
          });
        }
      }
      
      setMessages(finalMsgs => {
        updateCurrentSession(finalMsgs);
        return finalMsgs;
      });

    } catch (error) {
      console.error("Error in chat loop:", error);
      setMessages(prev => {
        const errMsgs = prev.map(msg => 
          msg.id === botMsgId ? { ...msg, text: "দুঃখিত, সংযোগ বিচ্ছিন্ন হয়েছে। আবার চেষ্টা করো।", isError: true } : msg
        );
        updateCurrentSession(errMsgs);
        return errMsgs;
      });
    } finally {
      setLoadingState(LoadingState.IDLE);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const activePersonaConfig = PERSONAS[currentPersona];

  return (
    <div className="flex h-screen bg-[#f3f4f6] overflow-hidden font-sans text-gray-900">
      
      {/* Mobile Overlay */}
      <div 
        className={`
          fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity duration-300 md:hidden
          ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={() => setIsSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside 
        className={`
          z-50 h-full bg-white border-r border-gray-100 flex flex-col flex-shrink-0
          transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)]
          fixed inset-y-0 left-0 md:relative md:inset-auto
          ${isSidebarOpen 
            ? 'translate-x-0 w-[280px] shadow-2xl md:shadow-none' 
            : '-translate-x-full w-[280px] md:w-0 md:translate-x-0 md:overflow-hidden'
          }
        `}
      >
        <div className="w-[280px] flex flex-col h-full bg-[#FAFAFA]">
          {/* Sidebar Header */}
          <div className="p-5 flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-gray-800 font-bold text-xl tracking-tight">
              <div className={`bg-gradient-to-tr ${activePersonaConfig.color} p-1.5 rounded-lg text-white shadow-lg`}>
                {activePersonaConfig.icon}
              </div>
              <span>লাভ গুরু AI</span>
            </div>
            <button 
              onClick={() => setIsSidebarOpen(false)} 
              className="md:hidden text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="px-4 pb-4">
            <button 
              onClick={() => createNewSession(currentPersona)}
              className="w-full group flex items-center justify-center gap-2.5 bg-white border border-gray-200 text-gray-700 py-3 px-4 rounded-xl font-medium shadow-sm hover:shadow-md hover:border-gray-300 hover:text-gray-900 transition-all active:scale-[0.98]"
            >
              <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />
              নতুন ভক্তের আগমন
            </button>
          </div>

          {/* Session List */}
          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1 scrollbar-thin scrollbar-thumb-gray-200">
            {sessions.length > 0 && (
              <h3 className="px-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 mt-2">অতীতের কথা</h3>
            )}
            
            {sessions.map(session => (
              <div 
                key={session.id}
                onClick={() => loadSession(session.id)}
                className={`
                  group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200
                  ${currentSessionId === session.id 
                    ? 'bg-white shadow-sm ring-1 ring-gray-200' 
                    : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                  }
                `}
              >
                <div className={`${currentSessionId === session.id ? 'text-gray-800' : 'text-gray-400'}`}>
                    {/* Handle potential legacy persona keys in rendering icon */}
                    {session.persona && PERSONAS[session.persona as PersonaType] 
                        ? PERSONAS[session.persona as PersonaType].icon 
                        : ((session.persona as any) === 'MAULA' ? PERSONAS['PEER'].icon : PERSONAS['GURU'].icon)
                    }
                </div>
                <div className="flex-1 min-w-0 pr-6">
                  <p className={`text-[14px] font-medium truncate ${currentSessionId === session.id ? 'text-gray-800' : ''}`}>{session.title}</p>
                </div>
                
                <button 
                  onClick={(e) => deleteSession(e, session.id)}
                  className={`
                    absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg z-10
                    text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all
                    ${currentSessionId === session.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}
                  `}
                  title="ডিলিট করুন"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative w-full bg-white transition-all duration-300">
        
        {/* Header */}
        <header className="absolute top-0 inset-x-0 z-30 h-16 flex items-center justify-between px-4 md:px-6 bg-white/80 backdrop-blur-md border-b border-gray-100/50">
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleSidebar}
              className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 rounded-lg transition-colors"
              title={isSidebarOpen ? "Close Sidebar" : "Open Sidebar"}
            >
              <PanelLeft size={20} />
            </button>
            
            {/* Persona Selector Dropdown */}
            <div className="relative" ref={personaMenuRef}>
              <button 
                onClick={() => setIsPersonaMenuOpen(!isPersonaMenuOpen)}
                className="flex items-center gap-2 p-1.5 pr-3 rounded-xl hover:bg-gray-100 transition-colors border border-transparent hover:border-gray-200"
              >
                 <div className={`p-1.5 rounded-lg bg-gradient-to-tr ${activePersonaConfig.color} text-white`}>
                    {activePersonaConfig.icon}
                 </div>
                 <div className="text-left hidden xs:block">
                     <p className="text-sm font-bold text-gray-800 leading-tight">{activePersonaConfig.name}</p>
                     <p className="text-[10px] text-gray-500 font-medium leading-tight">{activePersonaConfig.subLabel}</p>
                 </div>
                 <ChevronDown size={14} className="text-gray-400 ml-1" />
              </button>

              {isPersonaMenuOpen && (
                  <div className="absolute top-full left-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-gray-100 p-2 animate-in fade-in zoom-in-95 duration-200">
                      <p className="px-3 py-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Choose Guru Style</p>
                      {Object.values(PERSONAS).map((persona) => (
                          <button
                              key={persona.id}
                              onClick={() => {
                                  setCurrentPersona(persona.id);
                                  setIsPersonaMenuOpen(false);
                              }}
                              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                                  currentPersona === persona.id 
                                  ? 'bg-gray-50 ring-1 ring-gray-200' 
                                  : 'hover:bg-gray-50'
                              }`}
                          >
                              <div className={`p-2 rounded-lg bg-gradient-to-tr ${persona.color} text-white`}>
                                  {persona.icon}
                              </div>
                              <div>
                                  <p className="font-bold text-gray-800 text-sm">{persona.name}</p>
                                  <p className="text-xs text-gray-500">{persona.subLabel}</p>
                              </div>
                              {currentPersona === persona.id && (
                                  <div className="ml-auto w-2 h-2 rounded-full bg-green-500"></div>
                              )}
                          </button>
                      ))}
                  </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className={`hidden md:flex items-center gap-1.5 px-3 py-1 bg-gray-50 border border-gray-100 rounded-full text-xs font-bold text-gray-600`}>
              {activePersonaConfig.icon}
              <span>{activePersonaConfig.name} Mode Active</span>
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto pt-20 pb-4 px-4 md:px-0 scroll-smooth">
          <div className="max-w-3xl mx-auto min-h-full flex flex-col justify-end">
            
            {messages.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8 animate-in fade-in zoom-in duration-500">
                 <div className={`w-20 h-20 bg-gradient-to-br ${activePersonaConfig.color} rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-gray-200`}>
                    <div className="text-white transform scale-150">{activePersonaConfig.icon}</div>
                 </div>
                 <h2 className="text-2xl font-bold text-gray-800 mb-2">নমস্কার! আমি {activePersonaConfig.name}</h2>
                 <p className="text-gray-500 max-w-md">
                   {activePersonaConfig.intro}
                 </p>
               </div>
            ) : (
              <div className="flex flex-col pb-4 space-y-8 px-0 md:px-4">
                {messages.map(msg => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                
                {loadingState === LoadingState.LOADING && (
                  <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-white px-5 py-4 rounded-3xl rounded-bl-none shadow-sm border border-gray-100 flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} className="h-4" />
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <footer className="flex-none p-4 md:p-6 z-20 bg-gradient-to-t from-white via-white to-transparent">
          <div className="max-w-3xl mx-auto space-y-4">
            
            {messages.length <= 2 && (
              <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
                {QUICK_PROMPTS.map(qp => (
                  <button
                    key={qp.id}
                    onClick={() => handleSendMessage(qp.prompt)}
                    className={`flex-none flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 text-[13px] font-medium rounded-2xl border border-gray-200 hover:border-gray-300 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5`}
                  >
                    <span className="text-gray-500">{qp.icon}</span>
                    {qp.label}
                  </button>
                ))}
              </div>
            )}

            {/* Image Preview */}
            {selectedImage && (
              <div className="relative inline-flex animate-in fade-in slide-in-from-bottom-2">
                <div className="relative group">
                   <img src={selectedImage} alt="Preview" className="h-24 w-auto object-cover rounded-xl border-2 border-white shadow-lg ring-1 ring-gray-100" />
                   <button 
                    onClick={() => setSelectedImage(null)}
                    className="absolute -top-2 -right-2 bg-white text-gray-500 hover:text-red-500 rounded-full p-1.5 shadow-md border border-gray-100 hover:scale-110 transition-transform"
                   >
                    <X size={14} />
                   </button>
                </div>
              </div>
            )}

            {/* Input Bar */}
            <div className="relative flex items-end gap-2 bg-white p-2 rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100 focus-within:ring-2 focus-within:ring-gray-100 focus-within:border-gray-300 transition-all">
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-3.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors self-end mb-0.5"
                title="ছবি আপলোড করুন"
              >
                <ImageIcon size={22} strokeWidth={2} />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileSelect}
              />

              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={selectedImage ? "এই ছবি সম্পর্কে কি জানতে চান?" : `${activePersonaConfig.name}-কে মনের কথা খুলে বলো...`}
                className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[52px] py-3.5 px-2 text-gray-800 placeholder-gray-400 text-[15px] leading-relaxed"
                rows={1}
              />

              <button
                onClick={() => handleSendMessage()}
                disabled={(!input.trim() && !selectedImage) || loadingState !== LoadingState.IDLE}
                className={`
                  mb-1 p-3 rounded-full flex items-center justify-center transition-all duration-300
                  ${(!input.trim() && !selectedImage || loadingState !== LoadingState.IDLE)
                    ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                    : `bg-gradient-to-r ${activePersonaConfig.color} text-white shadow-lg hover:shadow-xl hover:scale-105 active:scale-95`
                  }
                `}
              >
                <Send size={20} className={loadingState !== LoadingState.IDLE ? 'opacity-0' : 'opacity-100'} strokeWidth={2.5} />
                {loadingState !== LoadingState.IDLE && (
                   <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-5 h-5 border-[2.5px] border-white/30 border-t-white rounded-full animate-spin"></div>
                   </div>
                )}
              </button>
            </div>
            
            <div className="text-center">
              <p className="text-[11px] text-gray-300">
                AI ভুল করতে পারে, দয়া করে সিরিয়াসলি নেবেন না।
              </p>
            </div>
          </div>
        </footer>

      </main>
    </div>
  );
};

export default App;