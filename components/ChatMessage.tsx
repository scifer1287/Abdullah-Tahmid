import React from 'react';
import { Message } from '../types';
import { Bot, User, Copy, Check, Sparkles } from 'lucide-react';
import { useState } from 'react';

interface ChatMessageProps {
  message: Message;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div 
      className={`
        flex w-full group animate-in fade-in slide-in-from-bottom-4 duration-500
        ${isUser ? 'justify-end' : 'justify-start'}
      `}
    >
      <div className={`flex max-w-[95%] md:max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'} items-end gap-3`}>
        
        {/* Avatar */}
        <div 
          className={`
            flex-shrink-0 w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center 
            ${isUser 
              ? 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md ring-2 ring-white' 
              : 'bg-gradient-to-br from-rose-500 to-pink-600 shadow-md ring-2 ring-white'
            } 
            shadow-sm self-end mb-1
          `}
        >
          {isUser ? <User size={18} className="text-white" /> : <Sparkles size={18} className="text-white" />}
        </div>

        {/* Bubble */}
        <div className="flex flex-col gap-1 min-w-0">
            {/* Name Label (Optional) */}
            {/* <span className={`text-[11px] text-gray-400 font-medium px-1 ${isUser ? 'text-right' : 'text-left'}`}>
                {isUser ? 'You' : 'Love Guru'}
            </span> */}
            
            <div 
              className={`
                relative px-5 py-3.5 text-[15px] leading-7 shadow-sm overflow-hidden
                ${isUser 
                  ? 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-[24px] rounded-br-none shadow-indigo-200' 
                  : 'bg-white text-gray-800 border border-gray-100 rounded-[24px] rounded-bl-none shadow-sm'
                }
              `}
            >
              {/* Image Content */}
              {message.image && (
                <div className="mb-4 rounded-xl overflow-hidden bg-black/5 -mx-1 -mt-1 border border-black/5">
                  <img 
                    src={message.image} 
                    alt="Uploaded content" 
                    className="w-full h-auto max-h-80 object-cover hover:scale-105 transition-transform duration-500"
                  />
                </div>
              )}

              {/* Text Content */}
              <div className={`whitespace-pre-wrap ${isUser ? 'font-medium text-indigo-50' : 'font-normal text-gray-700'}`}>
                {message.text}
              </div>

              {/* Action buttons for bot messages */}
              {!isUser && !message.isError && (
                <div className="mt-2 pt-2 border-t border-gray-100 flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-gray-400 hover:text-rose-600 transition-colors py-1"
                    title="Copy text"
                  >
                    {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    {copied ? 'কপি হয়েছে' : 'কপি করুন'}
                  </button>
                </div>
              )}
              
              {message.isError && (
                <div className="mt-3 text-xs text-red-600 font-semibold bg-red-50 p-2 rounded-lg border border-red-100 flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                    দুঃখিত, একটু সমস্যা হয়েছে। আবার চেষ্টা করুন।
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;