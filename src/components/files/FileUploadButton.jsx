// client/src/components/files/FileUploadButton.jsx
import React, { useRef, useState } from 'react';
import { Upload, Cloud } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const FileUploadButton = ({
    projectId,
    taskId,
    onFileUploaded,
    onUploadError,
    multiple = false,
    accept = '*/*',
    className = ''
}) => {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const fileInputRef = useRef(null);

    // Add debugging to your FileUploadButton to see what's happening:
    const handleFileUpload = async (event) => {
        const files = Array.from(event.target.files || []);
        console.log('Files to upload:', files);

        if (!files.length) return;

        setUploading(true);
        setProgress(0);

        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError) throw userError;
            if (!user) throw new Error('Not authenticated');

            console.log('User:', user.id);

            const uploadedResults = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                console.log('Processing file:', file.name);

                const fileExt = file.name.split('.').pop();
                const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
                const filePath = `${projectId || 'global'}/${fileName}`;

                console.log('Uploading to path:', filePath);

                // Upload to storage
                const { error: uploadError } = await supabase.storage
                    .from('project-files')
                    .upload(filePath, file);

                if (uploadError) {
                    console.error('Storage upload error:', uploadError);
                    throw uploadError;
                }

                console.log('Storage upload successful');

                // Insert into database
                const { data: insertData, error: insertError } = await supabase
                    .from('project_attachments')
                    .insert([{
                        project_id: projectId,
                        task_id: taskId,
                        user_id: user.id,
                        filename: file.name,
                        file_path: filePath,
                        file_size: file.size,
                        file_type: file.type
                    }])
                    .select()
                    .single();

                if (insertError) {
                    console.error('Database insert error:', insertError);

                    // Rollback: delete from storage
                    const { error: removeError } = await supabase.storage
                        .from('project-files')
                        .remove([filePath]);

                    console.log('Rollback storage removal result:', removeError);
                    throw insertError;
                }

                console.log('Database insert successful:', insertData);
                uploadedResults.push(insertData);
            }

            console.log('All files processed successfully:', uploadedResults);
            uploadedResults.forEach(item => onFileUploaded?.(item));

        } catch (error) {
            console.error('Error uploading files:', error);
            onUploadError?.(error);
        } finally {
            setUploading(false);
            setProgress(0);
            if (event?.target) event.target.value = '';
        }
    };

    return (
        <div className={`inline-flex flex-col ${className}`}>
            <label className="flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer border border-blue-200">
                {uploading ? <Cloud className="w-4 h-4 animate-pulse" /> : <Upload className="w-4 h-4" />}
                <span className="text-sm font-medium">
                    {uploading ? 'Uploading...' : `Attach File${multiple ? 's' : ''}`}
                </span>
                <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    disabled={uploading}
                    multiple={multiple}
                    accept={accept}
                    className="hidden"
                />
            </label>

            {uploading && (
                <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
                    <div
                        className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
            )}
        </div>
    );
};

export default FileUploadButton;
