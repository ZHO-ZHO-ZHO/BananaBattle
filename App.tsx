import React, { useState, useCallback, useRef } from 'react';
import { ArchigramPanel } from './components/ArchigramPanel';
import { ImageDisplay } from './components/ImageDisplay';
import { generateImage } from './services/genai';
import { ImageResult, ModelType } from './types';
import { Zap, Box, ArrowRight, Upload, X, Layers, FileText } from 'lucide-react';

// --- Canvas Helpers ---

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    const width = ctx.measureText(currentLine + " " + word).width;
    if (width < maxWidth) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  lines.push(currentLine);
  return lines;
};

const App: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const initialResultState = (modelName: string): ImageResult => ({
    imageUrl: null,
    loading: false,
    error: null,
    latency: 0,
    modelName
  });

  const [resultA, setResultA] = useState<ImageResult>(initialResultState(ModelType.FLASH_IMAGE));
  const [resultB, setResultB] = useState<ImageResult>(initialResultState(ModelType.PRO_IMAGE));

  const processFiles = (files: FileList | File[]) => {
    if (!files) return;

    const remainingSlots = 5 - uploadedImages.length;
    
    if (remainingSlots <= 0) {
      alert("MAXIMUM CAPACITY REACHED (5 MODULES)");
      return;
    }

    // Convert FileList to Array if needed
    const fileArray = files instanceof FileList ? Array.from(files) : files;
    const filesToProcess = fileArray.slice(0, remainingSlots);

    filesToProcess.forEach(file => {
      if (!file.type.startsWith('image/')) return;

      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setUploadedImages(prev => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      processFiles(event.target.files);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Ensure we don't mistakenly toggle off when dragging over children
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim() && uploadedImages.length === 0) return;

    setIsGenerating(true);

    // Reset states
    setResultA(prev => ({ ...prev, loading: true, error: null }));
    setResultB(prev => ({ ...prev, loading: true, error: null }));

    const runGeneration = async (
      modelLabel: string, 
      setResult: React.Dispatch<React.SetStateAction<ImageResult>>
    ) => {
      const startTime = Date.now();
      try {
        const imageUrl = await generateImage(modelLabel, prompt, uploadedImages);
        const latency = Date.now() - startTime;
        setResult(prev => ({
          ...prev,
          loading: false,
          imageUrl,
          latency
        }));
      } catch (err: any) {
        setResult(prev => ({
          ...prev,
          loading: false,
          error: err.message || 'Unknown error'
        }));
      }
    };

    await Promise.all([
      runGeneration(ModelType.FLASH_IMAGE, setResultA),
      runGeneration(ModelType.PRO_IMAGE, setResultB)
    ]);

    setIsGenerating(false);
  }, [prompt, uploadedImages]);

  const handleDownloadReport = async () => {
    if (!resultA.imageUrl || !resultB.imageUrl) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 1600;
    const padding = 60;
    const headerHeight = 140;
    const gap = 40;
    
    // Calculate Layout
    const halfWidth = (width - (padding * 2) - gap) / 2;
    // Use a fixed square box for images in the report
    const imageHeight = halfWidth; 
    
    // Measure Prompt Text
    ctx.font = '24px "Space Mono", monospace';
    const promptText = prompt || "(NO TEXT PROMPT)";
    const promptLines = wrapText(ctx, promptText, width - (padding * 2));
    const promptBlockHeight = (promptLines.length * 36) + 60; // line height + padding

    const totalHeight = headerHeight + promptBlockHeight + imageHeight + 140; // + stats/labels/footer

    canvas.width = width;
    canvas.height = totalHeight;

    // --- DRAWING ---

    // Background
    ctx.fillStyle = '#F2F0E4';
    ctx.fillRect(0, 0, width, totalHeight);

    // Background Dot Pattern
    ctx.fillStyle = '#111111';
    for(let i = 0; i < width; i+=20) {
      for(let j = 0; j < totalHeight; j+=20) {
        if (i % 40 === 0 && j % 40 === 0) {
           ctx.globalAlpha = 0.1;
           ctx.fillRect(i, j, 2, 2);
           ctx.globalAlpha = 1.0;
        }
      }
    }

    // Header Bar
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, width, 20);

    // Title
    ctx.font = '900 60px "Archivo Black", sans-serif';
    ctx.fillStyle = '#111111';
    ctx.fillText("BANANA BATTLE REPORT", padding, 100);

    // Date
    ctx.font = 'bold 20px "Space Mono", monospace';
    ctx.fillText(new Date().toLocaleString().toUpperCase(), width - padding - 320, 95);

    // Prompt Section
    const promptY = headerHeight;
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 4;
    ctx.strokeRect(padding, promptY, width - padding * 2, promptBlockHeight);
    
    ctx.fillStyle = '#111111';
    ctx.fillRect(padding, promptY, 160, 30);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px "Space Mono", monospace';
    ctx.fillText("INPUT_PROMPT:", padding + 10, promptY + 20);

    ctx.fillStyle = '#111111';
    ctx.font = '24px "Space Mono", monospace';
    promptLines.forEach((line, idx) => {
      ctx.fillText(line, padding + 20, promptY + 60 + (idx * 36));
    });

    // Image Section
    const imagesY = headerHeight + promptBlockHeight + 40;

    const drawResultBox = async (
      imgUrl: string, 
      x: number, 
      y: number, 
      w: number, 
      h: number, 
      title: string, 
      latency: number, 
      color: string
    ) => {
      // Frame
      ctx.strokeStyle = '#111111';
      ctx.lineWidth = 6;
      ctx.strokeRect(x, y, w, h);
      
      // Background Grid inside frame
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      ctx.clip();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x, y, w, h);
      // Radial grid
      ctx.fillStyle = '#EEEEEE';
      ctx.beginPath();
      ctx.arc(x + w/2, y + h/2, w/3, 0, 2 * Math.PI);
      ctx.fill();
      ctx.restore();

      // Image (Contain)
      try {
        const img = await loadImage(imgUrl);
        const scale = Math.min(w / img.width, h / img.height);
        const iw = img.width * scale;
        const ih = img.height * scale;
        const ix = x + (w - iw) / 2;
        const iy = y + (h - ih) / 2;
        ctx.drawImage(img, ix, iy, iw, ih);
      } catch (e) {
        console.error("Failed to load image for report", e);
      }

      // Badge
      const badgeH = 50;
      const badgeY = y - 25;
      ctx.fillStyle = color; // archi-red or blue
      ctx.fillRect(x + 20, badgeY, 280, badgeH);
      ctx.strokeRect(x + 20, badgeY, 280, badgeH); // Border
      
      // Shadow for badge
      ctx.fillStyle = '#111111';
      ctx.fillRect(x + 30 + 280, badgeY + 10, 0, 0); // Dummy

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 20px "Archivo Black", sans-serif';
      ctx.fillText(title.toUpperCase(), x + 40, badgeY + 32);

      // Latency Stats
      ctx.fillStyle = '#111111';
      ctx.font = 'bold 16px "Space Mono", monospace';
      ctx.fillText(`LATENCY: ${latency}ms`, x, y + h + 30);
    };

    await drawResultBox(
      resultA.imageUrl, 
      padding, 
      imagesY, 
      halfWidth, 
      imageHeight, 
      "NANO BANANA", 
      resultA.latency, 
      '#FF2A2A'
    );

    await drawResultBox(
      resultB.imageUrl, 
      padding + halfWidth + gap, 
      imagesY, 
      halfWidth, 
      imageHeight, 
      "NANO BANANA PRO", 
      resultB.latency, 
      '#0055FF'
    );

    // Footer decoration
    ctx.beginPath();
    ctx.moveTo(width/2, totalHeight - 20);
    ctx.lineTo(width/2, totalHeight);
    ctx.strokeStyle = '#111111';
    ctx.stroke();

    // Trigger Download
    const link = document.createElement('a');
    link.download = `BananaBattle_Report_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto pb-20">
      {/* Header Section */}
      <header className="mb-8 relative">
        <div className="flex flex-col md:flex-row justify-between items-end border-b-8 border-black pb-4">
          <div>
            <h1 className="text-5xl md:text-7xl font-sans font-black tracking-tighter text-archi-black leading-none uppercase">
              BANANA <span className="text-archi-red">BATTLE</span>
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="bg-archi-blue text-white font-mono px-2 py-0.5 text-sm transform -rotate-3 shadow-archi-sm">
                VER. 2.5 vs 3.0
              </span>
              <span className="font-mono font-bold text-sm tracking-widest uppercase text-black">
                // Contrast Test Unit
              </span>
            </div>
          </div>
          
          <div className="hidden md:block text-right font-mono text-xs leading-tight text-black font-bold">
            <p>DESIGNED BY: ZHO</p>
            <p>X: ZHO_ZHO_ZHO</p>
            <p>GITHUB: ZHO-ZHO-ZHO</p>
          </div>
        </div>
      </header>

      {/* Controls Section */}
      <section className="mb-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Visual Input Module (Upload) - Left */}
        <div className="lg:col-span-4 flex flex-col">
          <ArchigramPanel title="VISUAL_INPUT_MOD" color="yellow" className="h-full flex flex-col relative">
            <div 
              className="flex-grow flex flex-col h-full"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {isDragging && (
                <div className="absolute inset-0 z-50 bg-archi-yellow/90 backdrop-blur-sm border-4 border-dashed border-black flex items-center justify-center">
                  <div className="bg-black text-white px-4 py-2 font-bold font-mono text-xl transform -rotate-2 shadow-archi">
                    DROP TO UPLOAD
                  </div>
                </div>
              )}

              <input 
                type="file" 
                multiple 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              
              {uploadedImages.length === 0 ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-grow flex flex-col items-center justify-center border-2 border-dashed border-black min-h-[120px] cursor-pointer hover:bg-white transition-colors group"
                >
                  <Upload className="mb-2 group-hover:scale-110 transition-transform" />
                  <span className="font-mono text-xs font-bold text-archi-black">LOAD ASSETS</span>
                  <span className="font-mono text-[10px] opacity-60 text-archi-black">MAX 5 FILES</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                  {uploadedImages.map((img, idx) => (
                    <div key={idx} className="relative group aspect-square border-2 border-black bg-white">
                        <img src={img} alt={`Upload ${idx}`} className="w-full h-full object-cover transition-all" />
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            removeImage(idx);
                          }}
                          className="absolute -top-1 -right-1 bg-archi-red text-white p-0.5 border border-black hover:scale-110"
                        >
                          <X size={12} />
                        </button>
                    </div>
                  ))}
                  {uploadedImages.length < 5 && (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square border-2 border-dashed border-black flex items-center justify-center cursor-pointer hover:bg-white"
                    >
                      <span className="text-2xl font-sans text-archi-black">+</span>
                    </div>
                  )}
                </div>
              )}
              
              <div className="mt-3 pt-3 border-t-2 border-black flex justify-between items-center text-archi-black">
                <span className="font-mono text-[10px] font-bold">BUFFER: {uploadedImages.length * 20}%</span>
                <Layers size={14} />
              </div>
            </div>
          </ArchigramPanel>
        </div>

        {/* Input Terminal - Right */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <ArchigramPanel title="DATA_ENTRY_TERMINAL" color="white" className="relative z-10 flex-grow">
            <div className="relative w-full h-full min-h-[160px]">
              {/* Grid Background for Input */}
              <div className="absolute inset-0 pointer-events-none opacity-10 bg-[size:20px_20px] bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)]"></div>
              
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="ENTER ARCHITECTURAL PARAMETERS OR EDIT INSTRUCTIONS..."
                className="w-full h-full p-4 bg-transparent border-none font-mono text-lg text-archi-black focus:outline-none resize-none placeholder:text-gray-400 leading-relaxed z-10 relative"
              />
              
              <div className="absolute bottom-0 right-0 bg-black text-white text-xs font-mono px-2 py-1">
                TXT_LEN: {prompt.length}
              </div>
            </div>
          </ArchigramPanel>
        </div>
        
        {/* Generate Button */}
        <div className="lg:col-span-12">
          <button
            onClick={handleGenerate}
            disabled={isGenerating || (!prompt.trim() && uploadedImages.length === 0)}
            className={`
              w-full h-16 relative overflow-hidden group
              bg-archi-black text-white font-sans font-black text-2xl tracking-[0.2em]
              border-4 border-transparent hover:border-archi-red hover:text-archi-red
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              shadow-[8px_8px_0px_0px_#FF2A2A] hover:shadow-[4px_4px_0px_0px_#FF2A2A] hover:translate-x-1 hover:translate-y-1
            `}
          >
            <div className="flex items-center justify-center gap-4 relative z-10">
              {isGenerating ? (
                <span className="animate-pulse">PROCESSING...</span>
              ) : (
                <>
                  <span>GO</span>
                  <ArrowRight className="group-hover:translate-x-4 transition-transform duration-300" />
                </>
              )}
            </div>
            
            {/* Striped animation background */}
            <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#222_10px,#222_20px)] opacity-0 group-hover:opacity-20 transition-opacity"></div>
          </button>
        </div>

      </section>

      {/* Results Grid */}
      <main className="grid md:grid-cols-2 gap-8 md:gap-12">
        {/* Model A Column */}
        <div className="relative">
          <div className="flex items-center justify-between mb-4 px-2">
             <div className="bg-white border-2 border-black px-4 py-1 rounded-full flex items-center gap-2 shadow-[4px_4px_0px_0px_#FF2A2A]">
                <Zap size={16} className="text-archi-red" />
                <span className="font-mono font-bold text-xs md:text-sm text-black">Nano Banana</span>
             </div>
             {uploadedImages.length > 0 && (
               <div className="font-mono text-[10px] font-bold bg-archi-yellow border border-black px-2 py-0.5 text-black">
                 IMG_INPUT: ON
               </div>
             )}
          </div>
          
          <ArchigramPanel color="white" dashed className="aspect-square min-h-[500px]">
            <ImageDisplay 
              result={resultA} 
              label="NANO" 
              color="red" 
            />
          </ArchigramPanel>

          <div className="mt-4 font-mono text-[10px] font-bold text-archi-black leading-tight border-l-2 border-black pl-2">
            <p>CAPABILITY: TEXT + IMAGE INPUT</p>
            <p>FUNCTION: EDITING / GENERATION</p>
          </div>
        </div>

        {/* Model B Column */}
        <div className="relative">
          <div className="flex items-center justify-between mb-4 px-2">
             <div className="bg-white border-2 border-black px-4 py-1 rounded-full flex items-center gap-2 shadow-[4px_4px_0px_0px_#0055FF]">
                <Box size={16} className="text-archi-blue" />
                <span className="font-mono font-bold text-xs md:text-sm text-black">Nano Banana Pro</span>
             </div>
             {uploadedImages.length > 0 && (
               <div className="font-mono text-[10px] font-bold bg-gray-100 text-archi-black border border-black px-2 py-0.5 line-through decoration-archi-red opacity-70">
                 IMG_INPUT: OFF
               </div>
             )}
          </div>

          <ArchigramPanel color="white" dashed className="aspect-square min-h-[500px]">
            <ImageDisplay 
              result={resultB} 
              label="PRO" 
              color="blue" 
            />
          </ArchigramPanel>
          
           <div className="mt-4 font-mono text-[10px] font-bold text-archi-black leading-tight border-l-2 border-black pl-2">
            <p>CAPABILITY: HIGH FIDELITY GEN</p>
            <p>NOTE: REF_IMAGES IGNORED (TEXT ONLY)</p>
          </div>
        </div>
      </main>

      {/* Report Generation Button */}
      {resultA.imageUrl && resultB.imageUrl && (
        <div className="mt-12 flex justify-center border-t-4 border-black pt-8 border-dashed">
          <button 
            onClick={handleDownloadReport}
            className="
              relative bg-white text-archi-black border-4 border-black px-8 py-4 
              shadow-[8px_8px_0px_0px_#111] hover:shadow-[4px_4px_0px_0px_#111] 
              hover:translate-x-1 hover:translate-y-1 hover:bg-archi-cream
              transition-all flex items-center gap-3 
              font-sans font-black text-xl uppercase tracking-widest group
            "
          >
            <FileText className="group-hover:scale-110 transition-transform" />
            Generate Battle Report
          </button>
        </div>
      )}
    </div>
  );
};

export default App;