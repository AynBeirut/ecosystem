
import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface FileUploadProps {
  onFileUpload: (dataUrl: string) => void;
  accept?: string;
  maxSize?: number; // in MB
  label?: string;
  icon?: React.ReactNode;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileUpload,
  accept = "image/*",
  maxSize = 5, // Default 5MB
  label = "Upload File",
  icon,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    const file = e.target.files[0];
    const fileSizeMB = file.size / (1024 * 1024);
    
    if (fileSizeMB > maxSize) {
      toast({
        title: "File too large",
        description: `File size should be less than ${maxSize}MB`,
        variant: "destructive",
      });
      return;
    }
    
    setIsUploading(true);
    console.log("Reading file:", file.name, "size:", fileSizeMB.toFixed(2) + "MB");
    
    const reader = new FileReader();
    
    reader.onload = (event) => {
      if (event.target && typeof event.target.result === "string") {
        console.log("File read successfully, passing data to parent");
        onFileUpload(event.target.result);
      }
      setIsUploading(false);
    };
    
    reader.onerror = () => {
      console.error("Error reading file:", file.name);
      toast({
        title: "Error",
        description: "Failed to read file",
        variant: "destructive",
      });
      setIsUploading(false);
    };
    
    reader.readAsDataURL(file);
    
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
        disabled={isUploading}
      />
      <Button
        type="button"
        variant="secondary"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
      >
        {isUploading ? (
          <div className="flex items-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Uploading...
          </div>
        ) : (
          <>
            {icon} {label}
          </>
        )}
      </Button>
    </>
  );
};
