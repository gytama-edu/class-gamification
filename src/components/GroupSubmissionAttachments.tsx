import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui';
import { Upload, X, File, FileText, Image as ImageIcon, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import { getRepository } from '../lib/data/repository';
import { GroupSubmissionFileCategory, GroupSubmissionWithFiles, TaskProjectGroupSubmissionFile } from '../lib/types/database';

interface GroupSubmissionAttachmentsProps {
  groupAssignmentId: string;
  allowFiles: boolean;
  requireFiles: boolean;
  allowedCategories: GroupSubmissionFileCategory[];
  maxFiles: number;
  maxSizeBytes: number;
  maxTotalBytes: number;
  isSubmitted: boolean;
  isApproved: boolean;
  isTeacherView?: boolean;
}

const ImageThumbnail: React.FC<{ attachmentId: string, asStudent?: boolean }> = ({ attachmentId, asStudent }) => {
  const [url, setUrl] = useState<string | null>(null);
  
  useEffect(() => {
    getRepository().getGroupSubmissionFileUrl(attachmentId, asStudent).then(setUrl).catch(console.error);
  }, [attachmentId, asStudent]);

  if (!url) return <div className="w-10 h-10 bg-mission-bg-secondary animate-pulse rounded" />;
  
  return <img src={url} alt="thumbnail" className="w-10 h-10 object-cover rounded shrink-0" />;
};

export const GroupSubmissionAttachments: React.FC<GroupSubmissionAttachmentsProps> = ({
  groupAssignmentId,
  allowFiles,
  requireFiles,
  allowedCategories,
  maxFiles,
  maxSizeBytes,
  maxTotalBytes,
  isSubmitted,
  isApproved,
  isTeacherView = false
}) => {
  const [attempts, setAttempts] = useState<GroupSubmissionWithFiles[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAttempts = async () => {
    try {
      const data = await getRepository().getGroupSubmissionAttempts(groupAssignmentId, !isTeacherView);
      setAttempts(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttempts();
  }, [groupAssignmentId]);

  const currentAttempt = attempts[0];
  const activeFiles = currentAttempt?.status === 'draft' 
    ? currentAttempt.files.filter(f => f.upload_status === 'ready' || f.upload_status === 'pending')
    : currentAttempt?.files.filter(f => f.upload_status === 'ready') || [];
    
  const currentTotalBytes = activeFiles.reduce((acc, f) => acc + f.file_size_bytes, 0);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    
    if (activeFiles.length + files.length > maxFiles) {
      setError(`Cannot exceed maximum of ${maxFiles} files.`);
      return;
    }

    setUploading(true);
    setError(null);
    const repo = getRepository();

    try {
      for (const file of files) {
        if (file.size > maxSizeBytes) {
          throw new Error(`File ${file.name} exceeds ${Math.round(maxSizeBytes / 1024 / 1024)}MB limit.`);
        }

        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        let category: GroupSubmissionFileCategory = 'document';
        if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
          category = 'image';
        }

        if (!allowedCategories.includes(category)) {
          throw new Error(`File type ${category} not allowed for ${file.name}.`);
        }

        const prep = await repo.prepareGroupSubmissionUpload({
          group_assignment_id: groupAssignmentId,
          original_filename: file.name,
          mime_type: file.type || 'application/octet-stream',
          file_size_bytes: file.size,
          file_category: category
        });

        await repo.uploadGroupSubmissionFile(prep.storage_bucket, prep.storage_path, file);
        await repo.finalizeGroupSubmissionUpload(prep.attachment_id);
      }
      
      await loadAttempts();
    } catch (err: any) {
      setError(err.message || "Failed to upload file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async (attachmentId: string) => {
    if (!confirm('Remove this file?')) return;
    try {
      await getRepository().removeGroupSubmissionFile(attachmentId);
      await loadAttempts();
    } catch (err: any) {
      setError(err.message || "Failed to remove file");
    }
  };

  const handleDownload = async (attachmentId: string) => {
    try {
      const url = await getRepository().getGroupSubmissionFileUrl(attachmentId, !isTeacherView);
      window.open(url, '_blank');
    } catch (err) {
      console.error(err);
    }
  };

  if (!allowFiles && activeFiles.length === 0 && attempts.length <= 1) return null;

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 flex items-center gap-2 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Upload Area */}
      {!isTeacherView && !isSubmitted && !isApproved && allowFiles && (
        <div className="p-4 border-2 border-dashed border-mission-border rounded-lg text-center hover:border-radar-green transition-colors">
          <input 
            type="file" 
            multiple 
            ref={fileInputRef} 
            onChange={handleFileSelect} 
            className="hidden" 
            disabled={uploading || activeFiles.length >= maxFiles}
            accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.pptx,.xlsx,.txt"
          />
          <Button 
            variant="ghost" 
            className="text-radar-green"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || activeFiles.length >= maxFiles}
          >
            <Upload size={18} className="mr-2" />
            {uploading ? 'Uploading...' : 'Add Attachments'}
          </Button>
          <p className="mt-2 text-xs text-mission-muted-text">
            {activeFiles.length} of {maxFiles} files • {Math.round(currentTotalBytes / 1024 / 1024)} of {Math.round(maxTotalBytes / 1024 / 1024)}MB used
          </p>
          <p className="text-xs text-mission-muted-text mt-1">
            Allowed: {allowedCategories.join(', ')} up to {Math.round(maxSizeBytes / 1024 / 1024)}MB each
          </p>
        </div>
      )}

      {/* Current Files */}
      {activeFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-white flex items-center justify-between">
            <span>Attachments</span>
            {!isTeacherView && requireFiles && activeFiles.length === 0 && !isSubmitted && (
              <span className="text-xs text-amber-500">Required</span>
            )}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeFiles.map(f => (
              <div key={f.id} className="flex items-center justify-between p-3 bg-mission-bg border border-mission-border rounded-lg group">
                <div 
                  className="flex items-center gap-3 overflow-hidden cursor-pointer flex-1"
                  onClick={() => handleDownload(f.id)}
                >
                  {f.file_category === 'image' ? (
                    <ImageThumbnail attachmentId={f.id} asStudent={!isTeacherView} />
                  ) : (
                    <div className="w-10 h-10 bg-mission-bg-secondary rounded flex items-center justify-center shrink-0">
                      <FileText size={20} className="text-amber-400" />
                    </div>
                  )}
                  <div className="truncate">
                    <p className="text-sm text-white truncate hover:text-radar-green transition-colors">{f.original_file_name}</p>
                    <p className="text-xs text-mission-muted-text">{(f.file_size_bytes / 1024).toFixed(1)} KB • {f.uploaded_by_name_snapshot}</p>
                  </div>
                </div>
                {!isTeacherView && !isSubmitted && !isApproved && (
                  <button 
                    onClick={() => handleRemove(f.id)}
                    className="p-1.5 text-mission-muted-text hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove file"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Previous Attempts History */}
      {attempts.length > 1 && (
        <div className="mt-6 border-t border-mission-border pt-4">
          <h4 className="text-sm font-medium text-mission-muted-text mb-3">Previous Attempts</h4>
          <div className="space-y-3">
            {attempts.slice(1).map(attempt => (
              <div key={attempt.id} className="p-3 bg-mission-bg-secondary border border-mission-border rounded-lg opacity-75">
                <div className="flex justify-between items-center mb-2 text-xs text-mission-muted-text">
                  <span>Attempt #{attempt.attempt_number} • {attempt.status}</span>
                  {attempt.submitted_at && <span>{new Date(attempt.submitted_at).toLocaleDateString()}</span>}
                </div>
                {attempt.teacher_feedback && (
                  <div className="mb-2 p-2 bg-red-500/10 text-red-400 text-xs rounded border border-red-500/20">
                    <strong>Feedback:</strong> {attempt.teacher_feedback}
                  </div>
                )}
                {attempt.submission_text && (
                  <p className="text-sm text-mission-secondary-text mb-2 line-clamp-2">{attempt.submission_text}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {attempt.files.filter(f => f.upload_status === 'ready').map(f => (
                    <button 
                      key={f.id}
                      onClick={() => handleDownload(f.id)}
                      className="flex items-center gap-1.5 px-2 py-1 bg-mission-bg border border-mission-border rounded text-xs text-white hover:border-radar-green transition-colors"
                    >
                      <File size={12} className="text-radar-green" />
                      <span className="truncate max-w-[120px]">{f.original_file_name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
