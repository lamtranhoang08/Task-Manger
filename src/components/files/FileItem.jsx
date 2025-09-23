// src/components/files/FileItem.jsx (Fixed)
import React from 'react';
import { Download, File, Image, FileText, FileCode, Video, Music, Eye } from 'lucide-react';
import FileActionsMenu from './FileActionsMenu';
import { supabase } from '../../lib/supabase';

const FileItem = ({ 
  file, 
  onDelete, 
  onUpdate, 
  onDownload, 
  onPreview,
  showActions = true 
}) => {
  const getFileIcon = () => {
    if (file.file_type?.includes('image/')) return <Image className="w-4 h-4" />;
    if (file.file_type?.includes('pdf')) return <FileText className="w-4 h-4" />;
    if (file.file_type?.includes('text/') || file.file_type?.includes('code/')) return <FileCode className="w-4 h-4" />;
    if (file.file_type?.includes('video/')) return <Video className="w-4 h-4" />;
    if (file.file_type?.includes('audio/')) return <Music className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDefaultDownload = async () => {
    try {
      const { data, error } = await supabase.storage
        .from('project-files')
        .download(file.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download file: ' + error.message);
    }
  };

  const handleDownload = () => {
    onDownload?.(file) || handleDefaultDownload();
  };

  const handlePreview = () => {
    onPreview?.(file);
  };

  const handleDelete = () => {
    onDelete?.(file.id);
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group">
      <div className="flex items-center space-x-3 min-w-0 flex-1">
        <div className="text-gray-500 flex-shrink-0">
          {getFileIcon()}
        </div>
        
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">
            {file.filename}
          </p>
          <p className="text-xs text-gray-500">
            {formatFileSize(file.file_size)} • {new Date(file.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      {showActions && (
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onPreview && (
            <button
              onClick={handlePreview}
              className="p-1 text-gray-500 hover:text-blue-600"
              title="Preview"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
          
          <button
            onClick={handleDownload}
            className="p-1 text-gray-500 hover:text-green-600"
            title="Download"
          >
            <Download className="w-4 h-4" />
          </button>

          <FileActionsMenu
            file={file}
            onDelete={handleDelete}
            onUpdate={onUpdate}
            onDownload={handleDownload}
            onPreview={onPreview ? handlePreview : undefined}
          />
        </div>
      )}
    </div>
  );
};

export default FileItem;