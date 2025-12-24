import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Sparkles, Trash2, Heart, Plus, Menu, X, 
  MessageSquare, Image as ImageIcon, PanelLeft, MoreVertical
} from 'lucide-react';
import { GenerateContentResponse } from "@google/genai";
import ChatMessage from './components/ChatMessage';
import { Message, LoadingState, ChatSession } from './types';
import { QUICK_PROMPTS } from './constants';
import { sendMessageStream, initializeChat } from './services/geminiService';

const App: React.FC = () => {
  // State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loadingState, setLoadingState] = useState<LoadingState>(LoadingState.IDLE);
  
  // Sidebar state: Initialize based on screen width
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024; // Default open on large screens
    }
    return false;
  });
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Responsive sidebar handling
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      } else {
        setIsSidebarOpen(true);
      }
    };
    
    // Only set listener, don't auto-reset on every resize to avoid annoyance
    // window.addEventListener('resize', handleResize);
    // return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load sessions from local storage on mount
  useEffect(() => {
    const savedSessions = localStorage.getItem('love_guru_sessions');
    if (savedSessions) {
      try {
        const parsed = JSON.parse(savedSessions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          loadSession(parsed[0].id, parsed);
        } else {
          createNewSession();
        }
      } catch (e) {
        createNewSession();
      }
    } else {
      createNewSession();
    }
  }, []);

  // Save sessions to local storage whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('love_guru_sessions', JSON.stringify(sessions));
    }
  }, [sessions]);

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

  const createInitialMessage = (id: string): Message => ({
    id: 'init-' + id,
    role: 'model',
    text: 'জয় বাবা ভোলানাথ! আমি প্রেম বাবা। বলো বৎস, কোন মায়ার জালে আটকে পড়েছ? প্রেমের সমস্যা, নাকি কপালে শনি? 🧘‍♂️'
  });

  const createNewSession = () => {
    const newSessionId = Date.now().toString();
    const initialMessage = createInitialMessage(newSessionId);

    const newSession: ChatSession = {
      id: newSessionId,
      title: 'নতুন ভক্ত',
      messages: [initialMessage],
      createdAt: Date.now()
    };

    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSessionId);
    setMessages([initialMessage]);
    initializeChat([initialMessage]);
    
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
      initializeChat(session.messages);
      
      // On mobile, close sidebar after selecting
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      }
    }
  };

  const deleteSession = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation(); // Stop click from triggering loadSession on the parent div
    
    if (window.confirm('এই চ্যাটটি ডিলিট করতে চান?')) {
      const remainingSessions = sessions.filter(s => s.id !== sessionId);
      
      if (remainingSessions.length === 0) {
        // If we deleted the last session, immediately create a new one manually
        const newId = Date.now().toString();
        const initialMessage = createInitialMessage(newId);
        const newSession: ChatSession = {
          id: newId,
          title: 'নতুন ভক্ত',
          messages: [initialMessage],
          createdAt: Date.now()
        };
        
        setSessions([newSession]);
        setCurrentSessionId(newId);
        setMessages([initialMessage]);
        initializeChat([initialMessage]);
      } else {
        // If there are sessions left
        setSessions(remainingSessions);
        
        // If we deleted the currently active session, switch to the first available one
        if (currentSessionId === sessionId) {
          const nextSession = remainingSessions[0];
          setCurrentSessionId(nextSession.id);
          setMessages(nextSession.messages);
          initializeChat(nextSession.messages);
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
        return { ...session, messages: updatedMessages, title };
      }
      return session;
    }));
  };

  // --- Image Handling ---

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
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
    
    // Optimistic Update
    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    updateCurrentSession(updatedMessages);
    
    setInput('');
    setSelectedImage(null);
    setLoadingState(LoadingState.LOADING);

    // Bot Placeholder
    const botMsgId = (Date.now() + 1).toString();
    const botPlaceholder: Message = { id: botMsgId, role: 'model', text: '' };
    setMessages(prev => [...prev, botPlaceholder]);

    try {
      const stream = await sendMessageStream(newUserMsg.text, newUserMsg.image);
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
          msg.id === botMsgId ? { ...msg, text: "বৎস, ইন্টারনেটের মায়ার কারণে সংযোগ বিচ্ছিন্ন হয়েছে। আবার চেষ্টা করো।", isError: true } : msg
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

      {/* Sidebar - Desktop: Relative/Width transition | Mobile: Fixed/Translate transition */}
      <aside 
        className={`
          z-50 h-full bg-white border-r border-gray-100 flex flex-col flex-shrink-0
          transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)]
          ${/* Mobile specific styles */ ''}
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
            <div className="flex items-center gap-2.5 text-orange-600 font-bold text-xl tracking-tight">
              <div className="bg-gradient-to-tr from-orange-500 to-amber-500 p-1.5 rounded-lg text-white shadow-lg shadow-orange-500/30">
                <Sparkles size={20} fill="currentColor" />
              </div>
              <span>প্রেম বাবা</span>
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
              onClick={createNewSession}
              className="w-full group flex items-center justify-center gap-2.5 bg-white border border-gray-200 text-gray-700 py-3 px-4 rounded-xl font-medium shadow-sm hover:shadow-md hover:border-orange-200 hover:text-orange-600 transition-all active:scale-[0.98]"
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
                    ? 'bg-orange-50 text-orange-900 shadow-sm ring-1 ring-orange-100' 
                    : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                  }
                `}
              >
                <MessageSquare 
                  size={18} 
                  className={`flex-shrink-0 ${currentSessionId === session.id ? 'text-orange-500' : 'text-gray-400 group-hover:text-gray-500'}`} 
                />
                <div className="flex-1 min-w-0 pr-6">
                  <p className="text-[14px] font-medium truncate">{session.title}</p>
                </div>
                
                {/* Delete button appears on hover - fixed z-index and click handling */}
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

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-gray-200/60 bg-white/50 text-center">
            <p className="text-xs text-gray-400">Blessings for You 🙏</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full relative w-full bg-white">
        
        {/* Header (Glass) */}
        <header className="absolute top-0 inset-x-0 z-30 h-16 flex items-center justify-between px-4 md:px-6 bg-white/80 backdrop-blur-md border-b border-gray-100/50">
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleSidebar}
              className="p-2 -ml-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800 rounded-lg transition-colors"
              title={isSidebarOpen ? "সাইডবার বন্ধ করুন" : "সাইডবার খুলুন"}
            >
              <PanelLeft size={20} />
            </button>
            <h1 className="font-semibold text-gray-800 text-lg truncate max-w-[200px] md:max-w-md">
              {sessions.find(s => s.id === currentSessionId)?.title || 'প্রেম বাবা AI'}
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-xs font-bold">
              <Sparkles size={12} />
              <span>Baba Mode Active</span>
            </div>
          </div>
        </header>

        {/* Chat Area (Scrollable) */}
        <div className="flex-1 overflow-y-auto pt-20 pb-4 px-4 md:px-0 scroll-smooth">
          <div className="max-w-3xl mx-auto min-h-full flex flex-col justify-end">
            
            {messages.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-[60vh] text-center p-8 animate-in fade-in zoom-in duration-500">
                 <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-amber-100 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-orange-100">
                    <Sparkles size={40} className="text-orange-500" />
                 </div>
                 <h2 className="text-2xl font-bold text-gray-800 mb-2">নমস্কার! আমি প্রেম বাবা</h2>
                 <p className="text-gray-500 max-w-md">
                   বলো বৎস, কোন মায়ার জালে আটকে পড়েছ? প্রেমের সমস্যা, নাকি কপালে শনি?
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
                      <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce"></span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} className="h-4" />
              </div>
            )}
          </div>
        </div>

        {/* Input Area (Floating) */}
        <footer className="flex-none p-4 md:p-6 z-20 bg-gradient-to-t from-white via-white to-transparent">
          <div className="max-w-3xl mx-auto space-y-4">
            
            {/* Quick Prompts - Only show on empty chat or very short chat */}
            {messages.length <= 2 && (
              <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
                {QUICK_PROMPTS.map(qp => (
                  <button
                    key={qp.id}
                    onClick={() => handleSendMessage(qp.prompt)}
                    className="flex-none flex items-center gap-2 px-4 py-2 bg-white hover:bg-orange-50 text-gray-600 hover:text-orange-600 text-[13px] font-medium rounded-2xl border border-gray-200 hover:border-orange-200 transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                  >
                    <span className="text-orange-500">{qp.icon}</span>
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
            <div className="relative flex items-end gap-2 bg-white p-2 rounded-[28px] shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-gray-100 focus-within:ring-2 focus-within:ring-orange-500/10 focus-within:border-orange-200 transition-all">
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-3.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-full transition-colors self-end mb-0.5"
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
                placeholder={selectedImage ? "এই ছবি সম্পর্কে কি জানতে চান?" : "বাবাকে মনের কথা খুলে বলো..."}
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
                    : 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/30 hover:shadow-xl hover:scale-105 active:scale-95'
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
                বাবার কথা সবসময় সিরিয়াসলি নিও না বৎস। সব মায়া।
              </p>
            </div>
          </div>
        </footer>

      </main>
    </div>
  );
};

export default App;