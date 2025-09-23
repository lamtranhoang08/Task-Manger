import React from 'react';
import { History, Download, User, Calendar } from 'lucide-react';

const FileVersionHistory = ({ fileId, versions }) => {
  return (
    <div className="border rounded-lg p-4">
      <h4 className="font-medium text-gray-900 mb-3 flex items-center space-x-2">
        <History className="w-4 h-4" />
        <span>Version History</span>
      </h4>
      
      <div className="space-y-2">
        {versions?.map((version) => (
          <div key={version.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
            <div className="flex items-center space-x-3">
              <div className="text-sm">
                <p className="font-medium">v{version.version}</p>
                <p className="text-xs text-gray-500 flex items-center space-x-1">
                  <User className="w-3 h-3" />
                  <span>{version.uploaded_by}</span>
                </p>
              </div>
            </div>
            
            <div className="text-right text-xs text-gray-500">
              <p className="flex items-center space-x-1">
                <Calendar className="w-3 h-3" />
                <span>{new Date(version.created_at).toLocaleDateString()}</span>
              </p>
              <button className="text-blue-600 hover:text-blue-800 text-xs">
                <Download className="w-3 h-3 inline mr-1" />
                Download
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileVersionHistory;