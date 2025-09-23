// src/components/files/FileDropzone.jsx
import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, File, X, Cloud } from 'lucide-react';

const FileDropzone = ({ onFilesAccepted, maxSize = 10485760, accept }) => {
  const [isDragging, setIsDragging] = useState(false);

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    setIsDragging(false);
    if (rejectedFiles.length > 0) {
      console.warn('Rejected files:', rejectedFiles);
    }
    onFilesAccepted(acceptedFiles);
  }, [onFilesAccepted]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize,
    accept,
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
  });

  return (
    <div
      {...getRootProps()}
      className={`p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all duration-200 ${
        isDragActive 
          ? 'border-blue-400 bg-blue-50' 
          : 'border-gray-300 hover:border-gray-400'
      } ${isDragging ? 'scale-105' : ''}`}
    >
      <input {...getInputProps()} />
      
      <div className="flex flex-col items-center space-y-3">
        <Cloud className="w-12 h-12 text-gray-400" />
        
        <div className="text-center">
          <p className="font-medium text-gray-700">
            {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            or click to browse your files
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Max file size: {maxSize / 1024 / 1024}MB
          </p>
        </div>
      </div>
    </div>
  );
};

export default FileDropzone;