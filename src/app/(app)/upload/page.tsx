'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { uploadFitFile } from '@/lib/api';

export default function UploadPage() {
  const router = useRouter();
  const [dragActive, setDragActive] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    type: 'success' | 'duplicate' | 'error';
    message: string;
    activityId?: string;
  } | null>(null);

  const uploadMutation = useMutation({
    mutationFn: uploadFitFile,
    onSuccess: (data) => {
      if (data.duplicates) {
        setUploadResult({
          type: 'duplicate',
          message: `Potential duplicate found. Activity saved but may overlap with existing data.`,
          activityId: data.activity.id,
        });
      } else {
        setUploadResult({
          type: 'success',
          message: 'Activity uploaded successfully!',
          activityId: data.id,
        });
      }
    },
    onError: (error: Error) => {
      setUploadResult({
        type: 'error',
        message: error.message || 'Upload failed. Please try again.',
      });
    },
  });

  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith('.fit')) {
        setUploadResult({
          type: 'error',
          message: 'Only .FIT files are supported.',
        });
        return;
      }
      setUploadResult(null);
      uploadMutation.mutate(file);
    },
    [uploadMutation]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Upload Activity</h1>
        <p className="text-slate-500 mt-1">Import a .FIT file from your device</p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <input
          type="file"
          accept=".fit"
          onChange={handleChange}
          className="hidden"
          id="file-upload"
          disabled={uploadMutation.isPending}
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer flex flex-col items-center"
        >
          <Upload
            size={48}
            className={`mb-4 ${dragActive ? 'text-blue-500' : 'text-slate-400'}`}
          />
          <p className="text-lg font-medium text-slate-700">
            {uploadMutation.isPending
              ? 'Uploading...'
              : 'Drop your .FIT file here or click to browse'}
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Supports Garmin, Wahoo, Concept2, and other FIT files
          </p>
        </label>
      </div>

      {uploadResult && (
        <div
          className={`p-4 rounded-lg flex items-start gap-3 ${
            uploadResult.type === 'success'
              ? 'bg-green-50 border border-green-200'
              : uploadResult.type === 'duplicate'
              ? 'bg-yellow-50 border border-yellow-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {uploadResult.type === 'success' ? (
            <CheckCircle className="text-green-600 flex-shrink-0" />
          ) : (
            <AlertCircle
              className={
                uploadResult.type === 'duplicate'
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }
            />
          )}
          <div className="flex-1">
            <p
              className={
                uploadResult.type === 'success'
                  ? 'text-green-800'
                  : uploadResult.type === 'duplicate'
                  ? 'text-yellow-800'
                  : 'text-red-800'
              }
            >
              {uploadResult.message}
            </p>
            {uploadResult.activityId && (
              <button
                onClick={() => router.push(`/activities/${uploadResult.activityId}`)}
                className="text-sm text-blue-600 hover:underline mt-2"
              >
                View Activity
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
