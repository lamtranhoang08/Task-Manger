// src/components/files/FileList.jsx (Fixed)
import React, { useState } from 'react';
import FileItem from './FileItem';
import FilePreviewModal from './FilePreviewModal';
import { FileText, FolderOpen } from 'lucide-react';

const FileList = ({ 
  files, 
  onFileDeleted, 
  onFileUpdated,
  onFileDownload,
  showPreview = true,
  showActions = true,
  groupByType = false 
}) => {
  const [previewFile, setPreviewFile] = useState(null);

  const groupedFiles = groupByType 
    ? files.reduce((groups, file) => {
        const type = file.file_type?.split('/')[0] || 'other';
        if (!groups[type]) groups[type] = [];
        groups[type].push(file);
        return groups;
      }, {})
    : { all: files };

  if (files.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FolderOpen className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        <p>No files yet</p>
        <p className="text-sm">Upload files to get started</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {Object.entries(groupedFiles).map(([type, typeFiles]) => (
          <div key={type}>
            {groupByType && (
              <h3 className="text-sm font-medium text-gray-700 mb-2 capitalize">
                {type} ({typeFiles.length})
              </h3>
            )}
            <div className="space-y-2">
              {typeFiles.map((file) => (
                <FileItem
                  key={file.id}
                  file={file}
                  onDelete={onFileDeleted}
                  onUpdate={onFileUpdated}
                  onDownload={onFileDownload}
                  onPreview={showPreview ? setPreviewFile : undefined}
                  showActions={showActions}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {showPreview && previewFile && (
        <FilePreviewModal
          file={previewFile}
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
          onDownload={onFileDownload}
        />
      )}
    </>
  );
};

export default FileList;