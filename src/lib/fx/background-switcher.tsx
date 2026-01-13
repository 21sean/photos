"use client";
import { useState, useEffect, useRef } from "react";
import WaveBackground from "./wave-background";
import ShaderBackground from "./shader-background";
import { isChrome } from "../browser-utils";

export type BackgroundType = "wave" | "shader" | "shader-cyan" | "shader-purple" | "shader-green";

interface BackgroundOption {
  id: BackgroundType;
  label: string;
  color?: string;
}

const backgroundOptions: BackgroundOption[] = [
  { id: "wave", label: "Wave" },
  { id: "shader-cyan", label: "Glow Cyan", color: "#07eae6" },
  { id: "shader-purple", label: "Glow Purple", color: "#471CE2" },
  { id: "shader-green", label: "Glow Green", color: "#00FF00" },
];

interface BackgroundSwitcherProps {
  defaultBackground?: BackgroundType;
  backdropBlurAmount?: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
}

function BackgroundSwitcher({
  defaultBackground = "wave",
  backdropBlurAmount = "sm",
}: BackgroundSwitcherProps): JSX.Element {
  const [currentBackground, setCurrentBackground] = useState<BackgroundType>(defaultBackground);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isChromeUser, setIsChromeUser] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Check for Chrome on mount
  useEffect(() => {
    setIsChromeUser(isChrome());
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleBackgroundChange = (bgType: BackgroundType) => {
    if (bgType === currentBackground) {
      setIsMenuOpen(false);
      return;
    }

    setTransitioning(true);
    
    // Short delay for fade out, then switch
    setTimeout(() => {
      setCurrentBackground(bgType);
      setIsMenuOpen(false);
      // Allow fade in to complete
      setTimeout(() => setTransitioning(false), 100);
    }, 300);
  };

  const getCurrentOption = () => backgroundOptions.find(opt => opt.id === currentBackground);

  const renderBackground = () => {
    const option = getCurrentOption();
    
    if (currentBackground === "wave") {
      return (
        <WaveBackground 
          backdropBlurAmount={backdropBlurAmount}
        />
      );
    }

    // All shader variants
    return (
      <ShaderBackground
        backdropBlurAmount={backdropBlurAmount}
        color={option?.color || "#07eae6"}
      />
    );
  };

  return (
    <>
      {/* Background with fade transition */}
      <div
        style={{
          opacity: transitioning ? 0 : 1,
          transition: 'opacity 0.3s ease-in-out',
        }}
      >
        {renderBackground()}
      </div>

      {/* Chrome-only popup menu */}
      {isChromeUser && (
        <div
          ref={menuRef}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-50"
        >
          {/* Toggle arrow button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className={`
              flex items-center justify-center
              w-6 h-12 
              bg-black/30 hover:bg-black/50
              backdrop-blur-sm
              rounded-l-lg
              transition-all duration-200
              border border-r-0 border-white/10
              ${isMenuOpen ? 'translate-x-0' : 'translate-x-0'}
            `}
            aria-label="Toggle background menu"
          >
            <svg
              className={`w-4 h-4 text-white/70 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          {/* Popup menu */}
          <div
            className={`
              absolute right-6 top-1/2 -translate-y-1/2
              bg-black/60 backdrop-blur-md
              rounded-lg
              border border-white/10
              overflow-hidden
              transition-all duration-200 ease-out
              ${isMenuOpen 
                ? 'opacity-100 translate-x-0 pointer-events-auto' 
                : 'opacity-0 translate-x-4 pointer-events-none'
              }
            `}
          >
            <div className="px-3 py-2 border-b border-white/10">
              <span className="text-xs text-white/50 uppercase tracking-wider">
                Background
              </span>
            </div>
            <div className="py-1">
              {backgroundOptions.map((option) => (
                <button
                  key={option.id}
                  onClick={() => handleBackgroundChange(option.id)}
                  className={`
                    w-full px-4 py-2 text-left text-sm
                    flex items-center gap-3
                    transition-colors duration-150
                    ${currentBackground === option.id 
                      ? 'bg-white/20 text-white' 
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                    }
                  `}
                >
                  {/* Color preview dot */}
                  <span
                    className="w-3 h-3 rounded-full border border-white/30"
                    style={{
                      background: option.color || 'linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)',
                    }}
                  />
                  <span className="whitespace-nowrap">{option.label}</span>
                  {currentBackground === option.id && (
                    <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default BackgroundSwitcher;
