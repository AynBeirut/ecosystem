import React from 'react';
import type { EditorSelectableId } from '@/lib/editorPreviewBridge';

type EditorRegionShellProps = {
  id: EditorSelectableId;
  editorPreview: boolean;
  highlightedId: EditorSelectableId | null;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

/** Clickable + highlight wrapper for theme-editor preview regions. */
const EditorRegionShell: React.FC<EditorRegionShellProps> = ({
  id,
  editorPreview,
  highlightedId,
  className = '',
  style,
  children,
}) => {
  const isHighlighted = editorPreview && highlightedId === id;

  return (
    <div
      data-section-id={id}
      onClick={
        editorPreview
          ? (e) => {
              e.stopPropagation();
              window.parent.postMessage({ type: 'grabio:section-select', sectionId: id }, '*');
            }
          : undefined
      }
      className={`${className} ${
        editorPreview
          ? `relative cursor-pointer transition-shadow ${
              isHighlighted
                ? 'ring-2 ring-[#005bd3] ring-offset-2 z-10'
                : 'hover:ring-2 hover:ring-[#005bd3]/50'
            }`
          : ''
      }`}
      style={style}
    >
      {isHighlighted && (
        <div className="absolute top-0 left-0 z-20 bg-[#005bd3] text-white text-[11px] font-medium px-2 py-0.5 rounded-br pointer-events-none">
          {id.replace(/_/g, ' ')}
        </div>
      )}
      {children}
    </div>
  );
};

export default EditorRegionShell;
