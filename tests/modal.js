import React, { useState, useRef, useEffect } from 'react';

export default function DraggableResizableModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 500, height: 400 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState('');
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });
  
  const modalRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
      
      if (isResizing) {
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        
        let newWidth = resizeStart.width;
        let newHeight = resizeStart.height;
        let newX = resizeStart.posX;
        let newY = resizeStart.posY;
        
        if (resizeDirection.includes('e')) {
          newWidth = Math.max(300, resizeStart.width + deltaX);
        }
        if (resizeDirection.includes('s')) {
          newHeight = Math.max(200, resizeStart.height + deltaY);
        }
        if (resizeDirection.includes('w')) {
          const potentialWidth = resizeStart.width - deltaX;
          if (potentialWidth >= 300) {
            newWidth = potentialWidth;
            newX = resizeStart.posX + deltaX;
          } else {
            newWidth = 300;
            newX = resizeStart.posX + (resizeStart.width - 300);
          }
        }
        if (resizeDirection.includes('n')) {
          const potentialHeight = resizeStart.height - deltaY;
          if (potentialHeight >= 200) {
            newHeight = potentialHeight;
            newY = resizeStart.posY + deltaY;
          } else {
            newHeight = 200;
            newY = resizeStart.posY + (resizeStart.height - 200);
          }
        }
        
        setSize({ width: newWidth, height: newHeight });
        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeDirection('');
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragOffset, resizeStart, position, resizeDirection]);

  const handleHeaderMouseDown = (e) => {
    if (e.target.closest('.close-btn')) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleResizeMouseDown = (e, direction) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height,
      posX: position.x,
      posY: position.y
    });
  };

  if (!isOpen) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-8">
        <button
          onClick={() => setIsOpen(true)}
          className="px-8 py-4 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition shadow-lg"
        >
          打开模态框
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-8">
      {/* 遮罩层 */}
      <div className="fixed inset-0 bg-black bg-opacity-30" style={{ zIndex: 40 }} />
      
      {/* 模态框 */}
      <div
        ref={modalRef}
        className="fixed bg-white rounded-lg shadow-2xl flex flex-col"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
          zIndex: 50,
          cursor: isDragging ? 'move' : 'default'
        }}
      >
        {/* 调整大小的手柄 */}
        <div
          className="absolute top-0 left-0 w-2 h-2 cursor-nw-resize"
          onMouseDown={(e) => handleResizeMouseDown(e, 'nw')}
          style={{ zIndex: 10 }}
        />
        <div
          className="absolute top-0 right-0 w-2 h-2 cursor-ne-resize"
          onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
          style={{ zIndex: 10 }}
        />
        <div
          className="absolute bottom-0 left-0 w-2 h-2 cursor-sw-resize"
          onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
          style={{ zIndex: 10 }}
        />
        <div
          className="absolute bottom-0 right-0 w-2 h-2 cursor-se-resize"
          onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
          style={{ zIndex: 10 }}
        />
        
        {/* 边缘调整手柄 */}
        <div
          className="absolute top-0 left-2 right-2 h-1 cursor-n-resize"
          onMouseDown={(e) => handleResizeMouseDown(e, 'n')}
        />
        <div
          className="absolute bottom-0 left-2 right-2 h-1 cursor-s-resize"
          onMouseDown={(e) => handleResizeMouseDown(e, 's')}
        />
        <div
          className="absolute left-0 top-2 bottom-2 w-1 cursor-w-resize"
          onMouseDown={(e) => handleResizeMouseDown(e, 'w')}
        />
        <div
          className="absolute right-0 top-2 bottom-2 w-1 cursor-e-resize"
          onMouseDown={(e) => handleResizeMouseDown(e, 'e')}
        />

        {/* 标题栏 */}
        <div
          className="px-6 py-4 border-b bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-lg cursor-move select-none"
          onMouseDown={handleHeaderMouseDown}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">可拖拽调整大小的模态框</h2>
            <button
              className="close-btn w-8 h-8 flex items-center justify-center rounded hover:bg-white hover:bg-opacity-20 transition"
              onClick={() => setIsOpen(false)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">✨ 功能说明</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 拖拽标题栏可以移动模态框位置</li>
                <li>• 拖拽边缘和四个角可以调整大小</li>
                <li>• 最小宽度 300px，最小高度 200px</li>
              </ul>
            </div>
            
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">当前状态</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-gray-600">位置 X</div>
                  <div className="font-mono font-semibold">{Math.round(position.x)}px</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-gray-600">位置 Y</div>
                  <div className="font-mono font-semibold">{Math.round(position.y)}px</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-gray-600">宽度</div>
                  <div className="font-mono font-semibold">{Math.round(size.width)}px</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-gray-600">高度</div>
                  <div className="font-mono font-semibold">{Math.round(size.height)}px</div>
                </div>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <p className="text-sm text-green-800">
                试试拖动这个模态框的标题栏，或者拖动边缘来改变大小！
              </p>
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 border-t bg-gray-50 rounded-b-lg flex justify-end gap-3">
          <button
            onClick={() => {
              setPosition({ x: 100, y: 100 });
              setSize({ width: 500, height: 400 });
            }}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition"
          >
            重置
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  );
}