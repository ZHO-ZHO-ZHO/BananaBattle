import React from 'react';

interface ArchigramPanelProps {
  children: React.ReactNode;
  title?: string;
  color?: 'red' | 'blue' | 'yellow' | 'white';
  className?: string;
  dashed?: boolean;
}

export const ArchigramPanel: React.FC<ArchigramPanelProps> = ({ 
  children, 
  title, 
  color = 'white', 
  className = '',
  dashed = false
}) => {
  const bgColors = {
    red: 'bg-archi-red',
    blue: 'bg-archi-blue',
    yellow: 'bg-archi-yellow',
    white: 'bg-white',
  };

  const borderStyle = dashed ? 'border-dashed' : 'border-solid';

  return (
    <div className={`relative border-4 border-archi-black ${borderStyle} rounded-xl shadow-archi p-6 ${bgColors[color]} ${className}`}>
      {title && (
        <div className="absolute -top-5 left-4 bg-archi-black text-white px-3 py-1 font-sans text-sm uppercase tracking-widest transform -rotate-2">
          {title}
        </div>
      )}
      {children}
      
      {/* Decorative corner screws */}
      <div className="absolute top-2 right-2 w-3 h-3 border-2 border-black rounded-full flex items-center justify-center">
        <div className="w-full h-[1px] bg-black transform rotate-45"></div>
      </div>
      <div className="absolute bottom-2 left-2 w-3 h-3 border-2 border-black rounded-full flex items-center justify-center">
        <div className="w-full h-[1px] bg-black transform rotate-45"></div>
      </div>
    </div>
  );
};