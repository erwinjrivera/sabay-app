import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronRight } from 'lucide-react';

export default function SwipeButton({ text, onSwipe, color = '#00b0f0', isCompleted = false, customBorderRadius = '8px' }) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);
  const handleRef = useRef(null);

  // Reset offset when text changes (e.g. going from "Arrive" to "Complete")
  useEffect(() => {
    setDragOffset(0);
  }, [text]);

  const handleDragStart = (e) => {
    if (isCompleted) return;
    setIsDragging(true);
  };

  const handleDragMove = useCallback((e) => {
    if (!isDragging || !containerRef.current || !handleRef.current) return;
    
    let clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const handleWidth = handleRef.current.offsetWidth;
    
    let newOffset = clientX - containerRect.left - (handleWidth / 2);
    
    if (newOffset < 0) newOffset = 0;
    const maxOffset = containerRect.width - handleWidth - 6; // 3px padding on right
    if (newOffset > maxOffset) newOffset = maxOffset;
    
    setDragOffset(newOffset);
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    
    if (!containerRef.current || !handleRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const handleWidth = handleRef.current.offsetWidth;
    const maxOffset = containerRect.width - handleWidth - 6;
    
    if (dragOffset > maxOffset * 0.8) {
      setDragOffset(maxOffset);
      if (onSwipe) onSwipe();
    } else {
      setDragOffset(0);
    }
  }, [isDragging, dragOffset, onSwipe]);

  useEffect(() => {
    const handleGlobalTouchMove = (e) => {
      if (isDragging) {
        // e.preventDefault(); // Unsafe globally without { passive: false }, rely on touch-action
        handleDragMove(e);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
      window.addEventListener('touchend', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
        window.removeEventListener('touchmove', handleGlobalTouchMove);
        window.removeEventListener('touchend', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  if (isCompleted) {
    return (
      <div style={{ width: '100%', padding: '16px', background: color, borderRadius: customBorderRadius, color: '#fff', fontWeight: 700, fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
        {text}
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      style={{ 
        position: 'relative', 
        width: '100%', 
        height: '56px', 
        background: '#e0e0e0', 
        borderRadius: customBorderRadius, 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
        touchAction: 'none',
        boxSizing: 'border-box'
      }}
    >
      <div 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          height: '100%', 
          width: `${Math.max(56, dragOffset + 50)}px`, 
          background: color, 
          opacity: 0.15,
          borderRadius: customBorderRadius,
          transition: isDragging ? 'none' : 'width 0.3s'
        }} 
      />

      <span style={{ position: 'relative', zIndex: 1, color: '#555', fontWeight: 700, fontSize: '1rem', opacity: dragOffset > 0 ? 0.3 : 1, transition: 'opacity 0.2s', paddingLeft: '50px' }}>
        {text}
      </span>
      
      <div 
        ref={handleRef}
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        style={{ 
          position: 'absolute', 
          top: '4px', 
          left: '4px', 
          width: '48px', 
          height: '48px', 
          background: color, 
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'grab',
          transform: `translateX(${dragOffset}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }}
      >
        <ChevronRight size={24} color="#fff" />
        <ChevronRight size={24} color="#fff" style={{ marginLeft: '-16px' }} />
      </div>
    </div>
  );
}
