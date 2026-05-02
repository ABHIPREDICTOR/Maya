import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2, Volume2, VolumeX, Keyboard, Send, Trash2, MessageSquare } from "lucide-react";
import { getMayaResponse, getMayaAudio, resetMayaSession } from "./services/geminiService";
import { processCommand } from "./services/commandService";
import { LiveSessionManager } from "./services/liveService";
import Avatar from "./components/Avatar";
import PermissionModal from "./components/PermissionModal";
import { playPCM } from "./utils/audioUtils";
import { motion, AnimatePresence } from "motion/react";

type AppState = "idle" | "listening" | "processing" | "speaking";

interface ChatMessage {
  id: string;
  sender: "user" | "maya";
  text: string;
}

export default function App() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [volume, setVolume] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("maya_chat_history");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    }
    return [];
  });
  const [isMuted, setIsMuted] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [showChat, setShowChat] = useState(false);

  const messagesRef = useRef(messages);
  const liveSessionRef = useRef<LiveSessionManager | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesRef.current = messages;
    localStorage.setItem("maya_chat_history", JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (liveSessionRef.current) {
      liveSessionRef.current.isMuted = isMuted;
    }
  }, [isMuted]);

  const handleTextCommand = useCallback(async (finalTranscript: string) => {
    if (!finalTranscript.trim()) {
      setAppState("idle");
      return;
    }

    setMessages((prev) => [...prev, { id: Date.now().toString(), sender: "user", text: finalTranscript }]);
    
    if (isSessionActive && liveSessionRef.current) {
      liveSessionRef.current.sendText(finalTranscript);
      return;
    }

    setAppState("processing");
    const commandResult = processCommand(finalTranscript);
    let responseText = "";

    if (commandResult.isBrowserAction) {
      responseText = commandResult.action;
      setMessages((prev) => [...prev, { id: Date.now().toString() + "-z", sender: "maya", text: responseText }]);
      
      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getMayaAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64, (vol) => setVolume(vol));
        }
      }
      setAppState("idle");
      setTimeout(() => {
        if (commandResult.url) {
          window.open(commandResult.url, "_blank");
        }
      }, 1500);
    } else {
      responseText = await getMayaResponse(finalTranscript, messagesRef.current);
      setMessages((prev) => [...prev, { id: Date.now().toString() + "-z", sender: "maya", text: responseText }]);
      
      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getMayaAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64, (vol) => setVolume(vol));
        }
      }
      setAppState("idle");
    }
  }, [isMuted, isSessionActive]);

  useEffect(() => {
    return () => {
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
      }
    };
  }, []);

  const toggleListening = async () => {
    if (isSessionActive) {
      setIsSessionActive(false);
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
      }
      setAppState("idle");
      resetMayaSession();
    } else {
      try {
        setIsSessionActive(true);
        resetMayaSession();
        
        const session = new LiveSessionManager();
        session.isMuted = isMuted;
        liveSessionRef.current = session;
        
        session.onStateChange = (state) => setAppState(state);
        session.onVolume = (vol) => setVolume(vol);
        session.onMessage = (sender, text) => {
          setMessages((prev) => [...prev, { id: Date.now().toString() + "-" + sender, sender, text }]);
        };
        session.onCommand = (url) => {
          setTimeout(() => window.open(url, "_blank"), 1000);
        };

        await session.start();
      } catch (e) {
        console.error("Failed to start session", e);
        setShowPermissionModal(true);
        setIsSessionActive(false);
        setAppState("idle");
      }
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    handleTextCommand(textInput);
    setTextInput("");
    setShowTextInput(false);
  };

  return (
    <div className="h-[100dvh] w-screen bg-[#050505] text-white flex flex-col items-center font-sans relative overflow-hidden transition-colors duration-1000">
      {/* Clock HUD */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center opacity-30 select-none pointer-events-none">
        <span className="text-[10px] tracking-[0.4em] font-bold uppercase mb-1">System Time</span>
        <span className="text-2xl font-mono tracking-tighter">
          {new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      </div>

      {showPermissionModal && <PermissionModal onClose={() => setShowPermissionModal(false)} />}

      {/* Atmospheric Background Layers */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <motion.div 
          animate={{
            scale: isSessionActive ? [1, 1.2, 1] : 1,
            opacity: isSessionActive ? [0.4, 0.6, 0.4] : 0.3,
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-violet-600/20 blur-[140px] rounded-full" 
        />
        <motion.div 
          animate={{
            scale: isSessionActive ? [1.2, 1, 1.2] : 1,
            opacity: isSessionActive ? [0.6, 0.4, 0.6] : 0.3,
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-pink-600/20 blur-[140px] rounded-full" 
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.05),transparent_70%)]" />
      </div>

      {/* Header */}
      <header className="absolute top-0 left-0 w-full flex justify-between items-center z-40 px-6 py-6 md:px-12">
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex items-center gap-4"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 via-pink-500 to-blue-500 p-[1px]">
            <div className="w-full h-full rounded-[11px] bg-black/40 backdrop-blur-xl flex items-center justify-center font-bold text-lg">
              M
            </div>
          </div>
          <div>
            <h1 className="text-xl font-serif font-semibold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60">MAYA</h1>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isSessionActive ? 'bg-green-500 animate-pulse' : 'bg-white/20'}`} />
              <span className="text-[10px] uppercase tracking-widest opacity-40 font-medium">{isSessionActive ? 'Active' : 'Offline'}</span>
            </div>
          </div>
        </motion.div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-2.5 rounded-xl transition-all border ${showChat ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10 opacity-70 hover:opacity-100'}`}
            title="Toggle Chat"
          >
            <MessageSquare size={20} />
          </button>
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 opacity-70 hover:opacity-100 transition-all"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <button
            onClick={() => {
              if (confirm("Are you sure you want to clear the chat history?")) {
                setMessages([]);
                resetMayaSession();
              }
            }}
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 opacity-70 hover:opacity-100 hover:text-red-400 transition-all"
            title="Clear History"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full flex flex-col md:flex-row items-center justify-center relative z-20 px-6 gap-8 overflow-hidden pt-20">
        
        {/* Avatar Section */}
        <div className="flex-1 flex flex-col items-center justify-center relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={appState}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="flex justify-center"
            >
              <Avatar volume={volume} isSpeaking={appState === "speaking"} appState={appState} />
            </motion.div>
          </AnimatePresence>
          
          <div className="mt-12 text-center h-8">
            <AnimatePresence>
              {appState === "listening" && (
                <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-violet-400/80 text-sm tracking-[0.2em] font-medium uppercase animate-pulse">
                  Listening to you...
                </motion.p>
              )}
              {appState === "processing" && (
                <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-pink-400/80 text-sm tracking-[0.2em] font-medium uppercase">
                  Thinking...
                </motion.p>
              )}
              {appState === "speaking" && (
                <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-blue-400/80 text-sm tracking-[0.2em] font-medium uppercase">
                  Maya is speaking
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Floating Chat Sidebar (Conditional) */}
        <AnimatePresence>
          {showChat && (
            <motion.div 
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              className="fixed right-0 top-0 h-full w-full md:w-96 bg-black/30 backdrop-blur-3xl border-l border-white/10 z-30 flex flex-col pt-24 pb-32"
            >
              <div className="px-6 mb-4 flex justify-between items-center">
                <h3 className="text-xs uppercase tracking-[0.3em] font-bold opacity-30 text-white">Conversation</h3>
                <span className="px-2 py-1 rounded bg-white/5 text-[10px] opacity-40 font-mono tracking-tighter">{messages.length} MSG</span>
              </div>
              <div className="flex-1 overflow-y-auto px-6 space-y-4 scrollbar-hide">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-20 text-center px-8">
                    <MessageSquare size={48} className="mb-4" />
                    <p className="text-sm italic">No messages yet. Start a session to talk to Maya.</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"}`}
                    >
                      <div className={`
                        max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed
                        ${msg.sender === "user" 
                          ? "bg-violet-900/20 border border-violet-500/20 text-violet-100 rounded-tr-none" 
                          : "bg-white/5 border border-white/10 text-white rounded-tl-none"}
                      `}>
                        {msg.text}
                      </div>
                      <span className="text-[10px] mt-1 opacity-20 uppercase tracking-widest">{msg.sender === "user" ? "You" : "Maya"}</span>
                    </motion.div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Controls Panel */}
      <footer className="w-full relative z-40 pb-10 flex flex-col items-center gap-6 px-6">
        <AnimatePresence>
          {showTextInput && (
            <motion.form 
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              onSubmit={handleTextSubmit}
              className="w-full max-w-lg relative"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-pink-500/10 to-blue-500/10 blur-xl rounded-full" />
              <div className="relative flex items-center gap-3 bg-white/5 border border-white/10 backdrop-blur-2xl rounded-2xl p-1.5 pl-5 h-14 ring-1 ring-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                <input 
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Send a message..."
                  className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/30 text-base font-light"
                  autoFocus
                />
                <button 
                  type="submit"
                  disabled={!textInput.trim()}
                  className="w-11 h-11 flex items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 text-white disabled:opacity-30 transition-all hover:scale-105 active:scale-95 shadow-lg"
                >
                  <Send size={18} />
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-6">
          <button
            onClick={() => setShowTextInput(!showTextInput)}
            className={`p-4 rounded-2xl transition-all border ${showTextInput ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10 opacity-70 hover:opacity-100'}`}
            title="Text Chat"
          >
            <Keyboard size={24} />
          </button>

          <button
            onClick={toggleListening}
            className={`
              relative w-20 h-20 flex items-center justify-center rounded-3xl transition-all duration-500 group
              ${isSessionActive 
                ? "bg-red-500 shadow-[0_0_40px_rgba(239,68,68,0.4)]" 
                : "bg-white/10 border border-white/20 hover:bg-white/20 hover:scale-105 shadow-[0_20px_40px_rgba(0,0,0,0.3)]"}
            `}
          >
            {isSessionActive && (
              <motion.div
                layoutId="mic-glow"
                animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-red-400 rounded-3xl blur-xl z-[-1]"
              />
            )}
            {isSessionActive ? <MicOff size={32} className="text-white" /> : <Mic size={32} className="text-white group-hover:scale-110 transition-transform" />}
          </button>

          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-4 rounded-2xl transition-all border md:hidden ${showChat ? 'bg-white/10 border-white/20' : 'bg-white/5 border-white/10 opacity-70'}`}
          >
            <MessageSquare size={24} />
          </button>
          
          {/* Status Indicators Container (Desktop only helper) */}
          <div className="hidden md:flex flex-col gap-1 ml-4 border-l border-white/10 pl-6 w-32">
            <span className="text-[10px] uppercase tracking-[0.2em] opacity-40 font-bold">Connection</span>
            <span className="text-[10px] font-mono text-green-400">STABLE 12ms</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
