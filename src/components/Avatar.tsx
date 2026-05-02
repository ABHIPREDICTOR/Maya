import React, { useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";

interface AvatarProps {
  volume: number;
  isSpeaking: boolean;
  appState: "idle" | "listening" | "processing" | "speaking";
}

export default function Avatar({ volume, isSpeaking, appState }: AvatarProps) {
  // Map volume to mouth opening - smoother interpolation
  const mouthScaleY = useMemo(() => {
    if (!isSpeaking) return 0.15;
    const boostedVolume = Math.pow(volume, 0.7);
    return 0.15 + boostedVolume * 2.0;
  }, [volume, isSpeaking]);

  // Map state to colors for that Lavender/Blue theme
  const glowPaths = useMemo(() => {
    switch (appState) {
      case "listening": return { glow: "rgba(167, 139, 250, 0.5)", border: "border-violet-500/40", ring: "rgba(167, 139, 250, 0.2)" };
      case "processing": return { glow: "rgba(244, 114, 182, 0.5)", border: "border-pink-500/40", ring: "rgba(244, 114, 182, 0.2)" };
      case "speaking": return { glow: "rgba(59, 130, 246, 0.5)", border: "border-blue-500/40", ring: "rgba(59, 130, 246, 0.2)" };
      default: return { glow: "rgba(139, 92, 246, 0.2)", border: "border-white/10", ring: "rgba(255, 255, 255, 0.05)" };
    }
  }, [appState]);

  return (
    <div className="relative w-80 h-80 flex items-center justify-center">
      {/* HUD Data Streams (Small code bits floating) */}
      <div className="absolute inset-0 pointer-events-none opacity-20 font-mono text-[8px] flex flex-col justify-between p-4 overflow-hidden select-none">
        <div className="flex justify-between">
          <span>{`> NEURAL_SYNC_ACTIVE`}</span>
          <span>{`LATENCY: 12ms`}</span>
        </div>
        <div className="flex justify-between items-end">
          <span>{`MODE: MULTI_LINGUAL_V4`}</span>
          <span>{`CREATOR: ABHISHEK`}</span>
        </div>
      </div>

      {/* Outer Holographic Rings */}
      <motion.div
        animate={{ 
          rotate: 360,
          scale: isSpeaking ? [1, 1.02, 1] : 1,
          borderColor: glowPaths.ring
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute w-full h-full border-[0.5px] border-dashed rounded-full"
      />
      
      <motion.div
        animate={{ rotate: -360 }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        className="absolute w-[85%] h-[85%] border border-white/5 rounded-full flex items-center justify-center"
      >
        <div className="absolute top-0 w-1 h-4 bg-violet-500/40 blur-[1px]" />
        <div className="absolute bottom-0 w-1 h-4 bg-blue-500/40 blur-[1px]" />
      </motion.div>

      {/* Main Face Capsule */}
      <motion.div
        animate={{
          boxShadow: `0 0 100px ${glowPaths.glow}`,
          scale: 1 + volume * 0.05,
        }}
        className={`relative z-10 w-56 h-56 rounded-[3rem] bg-black/60 backdrop-blur-3xl border ${glowPaths.border} flex flex-col items-center justify-center gap-10 overflow-hidden ring-1 ring-white/5`}
      >
        {/* Reflection Streak */}
        <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />

        {/* Aviator Goggles / Eyes Area */}
        <div className="flex gap-14 items-center justify-center relative">
          {/* Left Lens */}
          <div className="relative group">
            <motion.div
              animate={{
                height: appState === "listening" ? [4, 16, 4] : 4,
                width: appState === "listening" ? [32, 40, 32] : 32,
                opacity: appState === "idle" ? 0.3 : 1
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="bg-white rounded-full blur-[0.5px] shadow-[0_0_20px_rgba(167,139,250,0.8)]"
            />
            <motion.div 
              animate={{ opacity: appState === "speaking" ? [0.2, 0.5, 0.2] : 0 }}
              className="absolute -inset-4 bg-blue-400/20 blur-xl rounded-full"
            />
          </div>

          {/* Right Lens */}
          <div className="relative">
            <motion.div
              animate={{
                height: appState === "listening" ? [4, 16, 4] : 4,
                width: appState === "listening" ? [32, 40, 32] : 32,
                opacity: appState === "idle" ? 0.3 : 1
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="bg-white rounded-full blur-[0.5px] shadow-[0_0_20px_rgba(59,130,246,0.8)]"
            />
            <motion.div 
              animate={{ opacity: appState === "speaking" ? [0.2, 0.5, 0.2] : 0 }}
              className="absolute -inset-4 bg-violet-400/20 blur-xl rounded-full"
            />
          </div>
        </div>

        {/* Neural Mouth/Lips */}
        <div className="relative w-24 h-10 flex items-center justify-center">
          {/* Outer Mouth Glow */}
          <motion.div
            animate={{
              scale: isSpeaking ? [1, 1.1, 1] : 1,
              opacity: isSpeaking ? 0.6 : 0.2,
            }}
            transition={{ duration: 0.1 }}
            className="absolute inset-0 bg-violet-500/20 blur-xl rounded-full"
          />
          
          <motion.div
            animate={{
              scaleY: mouthScaleY,
              scaleX: 1 + volume * 0.4,
              backgroundColor: isSpeaking ? "#ffffff" : "#a78bfa",
            }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="w-full h-2 rounded-full shadow-[0_0_25px_rgba(167,139,250,0.6)]"
          />
        </div>
      </motion.div>

      {/* Floating HUD Particles */}
      {[...Array(4)].map((_, i) => (
        <motion.div
          key={i}
          animate={{
            y: [-20, 20, -20],
            opacity: [0.2, 0.5, 0.2],
            rotate: 360
          }}
          transition={{
            duration: 5 + i,
            repeat: Infinity,
            delay: i * 0.5
          }}
          className="absolute w-1 h-1 bg-white rounded-full blur-[1px]"
          style={{
            left: `${20 + i * 20}%`,
            top: `${10 + i * 25}%`
          }}
        />
      ))}
    </div>
  );
}
