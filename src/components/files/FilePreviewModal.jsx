// src/components/files/FilePreviewModal.jsx (Fixed)
import React, { useState, useEffect } from 'react';
import { X, Download, File, Image, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const FilePreviewModal = ({ file, isOpen, onClose, onDownload }) => {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && file) {
      loadPreview();
    } else {
      // Reset state when modal closes
      setPreviewUrl(null);
      setLoading(true);
      setError(null);
    }
  }, [isOpen, file]);

  const loadPreview = async () => {
    if (!file) return;
    
    setLoading(true);
    setError(null);

    try {
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('project-files')
        .getPublicUrl(file.file_path);

      // Verify the file exists by trying to download it
      const { error: downloadError } = await supabase.storage
        .from('project-files')
        .download(file.file_path);

      if (downloadError) throw downloadError;

      setPreviewUrl(publicUrl);
    } catch (err) {
      console.error('Preview error:', err);
      setError('Failed to load preview. The file may have been deleted.');
    } finally {
      setLoading(false);
    }
  };

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading preview...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-12">
          <div className="text-4xl mb-4">❌</div>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={loadPreview}
            className="text-blue-600 hover:text-blue-800 text-sm mt-2"
          >
            Try Again
          </button>
        </div>
      );
    }

    const isImage = file.file_type?.includes('image/');
    const isPDF = file.file_type?.includes('pdf');

    if (isImage && previewUrl) {
      return (
        <img
          src={previewUrl}
          alt={file.filename}
          className="max-w-full max-h-full object-contain"
          onError={() => setError('Failed to load image')}
        />
      );
    }

    if (isPDF && previewUrl) {
      return (
        <iframe
          src={previewUrl}
          className="w-full h-full border-0"
          title={file.filename}
          onError={() => setError('Failed to load PDF')}
        />
      );
    }

    return (
      <div className="text-center py-12">
        <File className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">Preview not available for this file type</p>
        <p className="text-sm text-gray-400 mt-1">Please download to view</p>
        <button
          onClick={() => onDownload?.(file)}
          className="text-blue-600 hover:text-blue-800 text-sm mt-2"
        >
          Download File
        </button>
      </div>
    );
  };

  if (!isOpen || !file) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold truncate flex-1 mr-4">
            {file.filename}
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onDownload?.(file)}
              className="p-2 text-gray-600 hover:text-gray-800"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-gray-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
          {renderPreview()}
        </div>

        {/* Footer */}
        <div className="p-4 border-t text-sm text-gray-600">
          <div className="flex justify-between items-center">
            <span>Uploaded on {new Date(file.created_at).toLocaleDateString()}</span>
            <span>{Math.round(file.file_size / 1024)} KB</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilePreviewModal;