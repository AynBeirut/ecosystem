
import { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from "@/hooks/use-toast";

interface SignatureCanvasProps {
  onChange: (dataURL: string) => void;
  initialImage?: string;
  width?: number;
  height?: number;
}

const SignatureCanvas: React.FC<SignatureCanvasProps> = ({
  onChange,
  initialImage,
  width = 400,
  height = 200
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!initialImage);
  const { toast } = useToast();
  
  // Initialize canvas on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;
    
    // Set canvas styles
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    
    // Clear canvas
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Load initial image if provided
    if (initialImage) {
      console.log("Loading initial signature image");
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        setHasSignature(true);
        console.log("Initial signature loaded successfully");
      };
      img.onerror = (err) => {
        console.error("Error loading initial signature:", err);
      };
      img.src = initialImage;
    }
  }, [width, height, initialImage]);
  
  // Drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setIsDrawing(true);
    setHasSignature(true);
    
    // Get starting position
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      // Touch event
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      // Mouse event
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    ctx.beginPath();
    ctx.moveTo(
      clientX - rect.left,
      clientY - rect.top
    );
    
    // Prevent scrolling when drawing on canvas with touch
    if ('touches' in e) {
      e.preventDefault();
    }
  };
  
  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Get current position
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    if ('touches' in e) {
      // Touch event
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      // Mouse event
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    ctx.lineTo(
      clientX - rect.left,
      clientY - rect.top
    );
    ctx.stroke();
    
    // Prevent scrolling when drawing on canvas with touch
    if ('touches' in e) {
      e.preventDefault();
    }
  };
  
  const endDrawing = () => {
    if (!isDrawing) return;
    
    setIsDrawing(false);
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Get the signature as data URL and send it to parent component
    const dataURL = canvas.toDataURL('image/png');
    console.log("Signature captured, sending to parent");
    onChange(dataURL);
    
    // Show feedback to user
    toast({
      title: "Signature Captured",
      description: "Your signature has been saved",
    });
  };
  
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    setHasSignature(false);
    onChange('');
    console.log("Signature cleared");
  };
  
  return (
    <div className="space-y-3">
      <div className="border rounded-lg overflow-hidden bg-white">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="touch-none"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={endDrawing}
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clearCanvas}
          disabled={!hasSignature}
        >
          Clear
        </Button>
        <p className="text-xs text-gray-500 flex items-center">
          Draw your signature above using your mouse or finger
        </p>
      </div>
    </div>
  );
};

export default SignatureCanvas;
