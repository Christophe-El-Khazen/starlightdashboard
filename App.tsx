@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
@import "tailwindcss";

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;
  
  --color-brand-primary: #3B82F6;
  --color-brand-secondary: #A855F7;
  --color-brand-accent: #FACC15;
  --color-dark-bg: #020617;
  --color-sidebar-bg: #0F172A;
  --color-card-bg: #1E293B;
  --color-card-border: #334155;
  --color-muted-text: #94A3B8;
}

@layer base {
  body {
    @apply bg-dark-bg text-[#F1F5F9] antialiased font-sans;
    background-image: 
      radial-gradient(circle at 80% 20%, rgba(168, 85, 247, 0.15) 0%, transparent 40%),
      radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.15) 0%, transparent 40%),
      radial-gradient(circle at 50% 50%, rgba(250, 204, 21, 0.05) 0%, transparent 60%);
    background-attachment: fixed;
  }
}

@layer components {
  .card-neon {
    @apply bg-card-bg/80 backdrop-blur-md border border-card-border rounded-xl p-4 transition-all shadow-lg shadow-black/20;
  }
  
  .btn-neon {
    @apply bg-brand-primary text-white rounded-md px-3 py-2 text-xs font-bold hover:bg-brand-primary/90 active:scale-95 transition-all shadow-md shadow-brand-primary/20;
  }
  
  .btn-neon-ghost {
    @apply bg-transparent border border-[#475569] text-muted-text rounded-md px-3 py-2 text-xs font-semibold hover:bg-slate-800/50 hover:text-white transition-all;
  }

  .status-pill-neon {
    @apply px-2 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider;
  }
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 5px;
}
::-webkit-scrollbar-track {
  @apply bg-transparent;
}
::-webkit-scrollbar-thumb {
  @apply bg-[#2D3139] rounded-full;
}
::-webkit-scrollbar-thumb:hover {
  @apply bg-[#3F444E];
}
