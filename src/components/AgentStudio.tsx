import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  Send,
  Upload,
  Copy,
  Check,
  Download,
  Code2,
  Eye,
  FileCode,
  Loader2,
  Sparkles,
  Trash2,
  StopCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
  streamAgentCode,
  detectLanguage,
  suggestFileName,
  type AgentFile,
} from "../services/agentService";

interface AgentStudioProps {
  onClose: () => void;
  initialInstruction?: string;
}

type ViewMode = "code" | "preview";
type AgentStatus = "idle" | "working";

interface LogEntry {
  id: string;
  type: "user" | "agent" | "system";
  text: string;
}

const STORAGE_KEY = "maya_agent_files";

export default function AgentStudio({ onClose, initialInstruction }: AgentStudioProps) {
  const [files, setFiles] = useState<AgentFile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [activeFileIdx, setActiveFileIdx] = useState<number>(0);
  const [instruction, setInstruction] = useState("");
  const [status, setStatus] = useState<AgentStatus>("idle");
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [copied, setCopied] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLPreElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<{ cancelled: boolean }>({ cancelled: false });

  const activeFile = files[activeFileIdx] || null;
  const displayContent =
    streamingContent !== null ? streamingContent : activeFile?.content || "";

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  }, [files]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // Auto-scroll code view while streaming
  useEffect(() => {
    if (streamingContent !== null && codeRef.current) {
      codeRef.current.scrollTop = codeRef.current.scrollHeight;
    }
  }, [streamingContent]);

  const addLog = (type: LogEntry["type"], text: string) => {
    setLogs((prev) => [
      ...prev,
      { id: Date.now().toString() + Math.random(), type, text },
    ]);
  };

  const isPreviewable = (file: AgentFile | null) =>
    !file || file.language === "html";

  const runAgent = useCallback(
    async (userInstruction: string) => {
      if (!userInstruction.trim() || status === "working") return;

      addLog("user", userInstruction);
      setStatus("working");
      cancelRef.current = { cancelled: false };

      const isUpdate = files.length > 0 && activeFile;
      addLog(
        "system",
        isUpdate
          ? `Updating ${activeFile!.name} live...`
          : "Building new app live..."
      );
      setViewMode("code");
      setStreamingContent("");

      try {
        const finalCode = await streamAgentCode(
          userInstruction,
          isUpdate ? activeFile : null,
          (partial) => setStreamingContent(partial),
          cancelRef.current
        );

        if (cancelRef.current.cancelled) {
          addLog("system", "Stopped by you.");
          setStreamingContent(null);
          setStatus("idle");
          return;
        }

        if (isUpdate) {
          setFiles((prev) =>
            prev.map((f, i) =>
              i === activeFileIdx ? { ...f, content: finalCode } : f
            )
          );
          addLog("agent", `Done! ${activeFile!.name} fully updated. Preview dekh lo!`);
        } else {
          const name = suggestFileName(userInstruction);
          const newFile: AgentFile = {
            name,
            content: finalCode,
            language: detectLanguage(name),
          };
          setFiles((prev) => [...prev, newFile]);
          setActiveFileIdx(files.length);
          addLog("agent", `Done! ${name} ready hai. Live preview on!`);
        }

        setStreamingContent(null);
        setViewMode("preview");
      } catch (err) {
        console.error("[v0] Agent error:", err);
        addLog("system", "Error aa gaya. Ek baar phir try karo.");
        setStreamingContent(null);
      }

      setStatus("idle");
    },
    [files, activeFile, activeFileIdx, status]
  );

  // Auto-run when opened via a voice/text build command
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (initialInstruction && !autoRanRef.current) {
      autoRanRef.current = true;
      runAgent(initialInstruction);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialInstruction]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = instruction;
    setInstruction("");
    runAgent(text);
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadList = e.target.files;
    if (!uploadList) return;

    Array.prototype.slice.call(uploadList).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = () => {
        const content = String(reader.result || "");
        const newFile: AgentFile = {
          name: file.name,
          content,
          language: detectLanguage(file.name),
        };
        setFiles((prev) => {
          const idx = prev.findIndex((f) => f.name === file.name);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = newFile;
            setActiveFileIdx(idx);
            return next;
          }
          setActiveFileIdx(prev.length);
          return [...prev, newFile];
        });
        addLog("system", `Uploaded ${file.name} — ab bolo kya update karna hai.`);
      };
      reader.readAsText(file);
    });
    e.target.value = "";
  };

  const handleCopy = async () => {
    if (!displayContent) return;
    await navigator.clipboard.writeText(displayContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!activeFile) return;
    const blob = new Blob([activeFile.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = activeFile.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    if (activeFileIdx >= idx && activeFileIdx > 0) {
      setActiveFileIdx(activeFileIdx - 1);
    }
  };

  const handleStop = () => {
    cancelRef.current.cancelled = true;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#050505] flex flex-col"
    >
      {/* Top Bar */}
      <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-white/10 bg-black/40 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-widest text-white uppercase">
              Maya Agent Studio
            </h2>
            <div className="flex items-center gap-1.5">
              <div
                className={`w-1.5 h-1.5 rounded-full ${
                  status === "working"
                    ? "bg-amber-400 animate-pulse"
                    : "bg-green-500"
                }`}
              />
              <span className="text-[10px] uppercase tracking-widest text-white/40">
                {status === "working" ? "Building Live..." : "Ready"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="hidden sm:flex rounded-lg border border-white/10 overflow-hidden">
            <button
              onClick={() => setViewMode("code")}
              className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors ${
                viewMode === "code"
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              <Code2 size={14} /> Code
            </button>
            <button
              onClick={() => setViewMode("preview")}
              disabled={!isPreviewable(activeFile)}
              className={`px-3 py-1.5 text-xs flex items-center gap-1.5 transition-colors disabled:opacity-30 ${
                viewMode === "preview"
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              <Eye size={14} /> Preview
            </button>
          </div>

          <button
            onClick={handleCopy}
            disabled={!displayContent}
            className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-30"
            title="Copy full code"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy Code"}
          </button>
          <button
            onClick={handleDownload}
            disabled={!activeFile}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-white transition-colors disabled:opacity-30"
            title="Download file"
          >
            <Download size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/70 hover:text-red-400 transition-colors"
            title="Close studio"
          >
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left: Agent chat + files */}
        <aside className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-white/10 flex flex-col bg-black/20 shrink-0 h-56 md:h-auto">
          {/* File tabs */}
          <div className="px-3 py-2 border-b border-white/10 flex items-center gap-2 overflow-x-auto scrollbar-hide shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".html,.htm,.css,.js,.jsx,.ts,.tsx,.json,.py,.md,.txt"
              onChange={handleUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-dashed border-white/20 text-white/60 hover:text-white text-xs shrink-0 transition-colors"
            >
              <Upload size={13} /> Upload
            </button>
            {files.map((f, i) => (
              <div
                key={f.name}
                className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs shrink-0 cursor-pointer transition-colors border ${
                  i === activeFileIdx
                    ? "bg-violet-600/20 border-violet-500/40 text-violet-200"
                    : "bg-white/5 border-white/10 text-white/50 hover:text-white"
                }`}
                onClick={() => {
                  setActiveFileIdx(i);
                  setStreamingContent(null);
                }}
              >
                <FileCode size={13} />
                <span className="max-w-[110px] truncate">{f.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFile(i);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"
                  aria-label={`Delete ${f.name}`}
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>

          {/* Agent log */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-hide">
            {logs.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-white/25 px-4 gap-3">
                <Sparkles size={32} />
                <p className="text-xs leading-relaxed">
                  Bolo kya banana hai — &quot;make a portfolio website&quot; — ya
                  file upload karke bolo kya update karna hai. Sab kuch live
                  hoga!
                </p>
              </div>
            ) : (
              logs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`text-xs leading-relaxed px-3 py-2 rounded-xl max-w-[95%] ${
                    log.type === "user"
                      ? "bg-violet-900/25 border border-violet-500/20 text-violet-100 ml-auto"
                      : log.type === "agent"
                      ? "bg-white/5 border border-white/10 text-white"
                      : "text-white/35 italic px-1 py-0"
                  }`}
                >
                  {log.text}
                </motion.div>
              ))
            )}
            {status === "working" && (
              <div className="flex items-center gap-2 text-amber-300/80 text-xs px-1">
                <Loader2 size={13} className="animate-spin" />
                Maya is coding live...
                <button
                  onClick={handleStop}
                  className="ml-auto flex items-center gap-1 text-red-400/80 hover:text-red-400"
                >
                  <StopCircle size={13} /> Stop
                </button>
              </div>
            )}
            <div ref={logsEndRef} />
          </div>

          {/* Prompt input */}
          <form
            onSubmit={handleSubmit}
            className="p-3 border-t border-white/10 shrink-0"
          >
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-1 pl-3">
              <input
                type="text"
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder={
                  activeFile
                    ? `Update ${activeFile.name}...`
                    : "Kya banana hai? Bolo..."
                }
                disabled={status === "working"}
                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/25 text-sm py-2 disabled:opacity-40"
              />
              <button
                type="submit"
                disabled={!instruction.trim() || status === "working"}
                className="w-9 h-9 flex items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 text-white disabled:opacity-30 transition-transform hover:scale-105 active:scale-95"
                aria-label="Send instruction"
              >
                <Send size={15} />
              </button>
            </div>
          </form>
        </aside>

        {/* Right: Code / Preview */}
        <section className="flex-1 flex flex-col overflow-hidden relative">
          {/* Mobile view toggle */}
          <div className="sm:hidden flex border-b border-white/10 shrink-0">
            <button
              onClick={() => setViewMode("code")}
              className={`flex-1 py-2 text-xs flex items-center justify-center gap-1.5 ${
                viewMode === "code" ? "bg-white/10 text-white" : "text-white/40"
              }`}
            >
              <Code2 size={14} /> Code
            </button>
            <button
              onClick={() => setViewMode("preview")}
              disabled={!isPreviewable(activeFile)}
              className={`flex-1 py-2 text-xs flex items-center justify-center gap-1.5 disabled:opacity-30 ${
                viewMode === "preview"
                  ? "bg-white/10 text-white"
                  : "text-white/40"
              }`}
            >
              <Eye size={14} /> Preview
            </button>
          </div>

          {displayContent === "" && streamingContent === null ? (
            <div className="flex-1 flex flex-col items-center justify-center text-white/20 gap-4">
              <Code2 size={56} />
              <p className="text-sm">No code yet — Maya ko bolo kuch banane ko!</p>
            </div>
          ) : viewMode === "code" || !isPreviewable(activeFile) ? (
            <pre
              ref={codeRef}
              className="flex-1 overflow-auto p-5 text-[13px] leading-relaxed font-mono text-emerald-200/90 whitespace-pre-wrap break-words"
            >
              {displayContent}
              {streamingContent !== null && (
                <span className="inline-block w-2 h-4 bg-emerald-300 animate-pulse ml-0.5 align-middle" />
              )}
            </pre>
          ) : (
            <iframe
              title="Live Preview"
              srcDoc={displayContent}
              sandbox="allow-scripts allow-modals allow-forms allow-popups"
              className="flex-1 w-full bg-white border-0"
            />
          )}

          {/* Streaming badge */}
          <AnimatePresence>
            {streamingContent !== null && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-4 right-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-black/70 backdrop-blur-xl border border-amber-500/30 text-amber-300 text-xs font-medium"
              >
                <Loader2 size={13} className="animate-spin" />
                Live coding... {displayContent.length.toLocaleString()} chars
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </motion.div>
  );
}
