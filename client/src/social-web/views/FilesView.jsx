import React, { useState } from 'react';
import {
  FileText,
  Search,
  Upload,
  Download,
  Share2,
  HardDrive,
  FileCode,
  FileSpreadsheet,
  FileImage,
  FolderArchive,
  MoreHorizontal,
  Clock,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';

export default function FilesView() {
  const { currentUser, showToast } = useSocial();
  const [selectedFilter, setSelectedFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filters = ['All', 'Documents', 'Design Specs', 'Code & Architecture', 'Archives'];

  const files = [
    {
      id: 'f_1',
      name: 'Square_Design_System_v2.0_Spec.pdf',
      type: 'pdf',
      category: 'Documents',
      size: '8.4 MB',
      updatedAt: 'Yesterday at 4:30 PM',
      author: 'Ahmad Nur Fawaid',
      downloads: 142
    },
    {
      id: 'f_2',
      name: 'Tiwi_Social_Architecture_PostgreSQL_Schema.sql',
      type: 'code',
      category: 'Code & Architecture',
      size: '240 KB',
      updatedAt: '3 days ago',
      author: 'Alex Rivera',
      downloads: 89
    },
    {
      id: 'f_3',
      name: 'Brand_Guidelines_And_Vector_Assets_2026.zip',
      type: 'archive',
      category: 'Archives',
      size: '42.6 MB',
      updatedAt: '1 week ago',
      author: 'Sophia Chen',
      downloads: 312
    },
    {
      id: 'f_4',
      name: 'Q3_Community_Engagement_Analytics.xlsx',
      type: 'sheet',
      category: 'Documents',
      size: '1.2 MB',
      updatedAt: '2 weeks ago',
      author: 'Marcus Chen',
      downloads: 45
    },
    {
      id: 'f_5',
      name: 'Tiwi_Mobile_Component_Library.fig',
      type: 'design',
      category: 'Design Specs',
      size: '18.9 MB',
      updatedAt: '5 days ago',
      author: 'Elena Rostova',
      downloads: 204
    },
    {
      id: 'f_6',
      name: 'Security_Checkup_Cryptographic_Attestation.pdf',
      type: 'pdf',
      category: 'Documents',
      size: '3.1 MB',
      updatedAt: '1 month ago',
      author: 'Tiwi Security Team',
      downloads: 98
    }
  ];

  const getFileIcon = (type) => {
    switch (type) {
      case 'code':
        return <FileCode className="w-5 h-5 text-emerald-500" />;
      case 'sheet':
        return <FileSpreadsheet className="w-5 h-5 text-green-600" />;
      case 'archive':
        return <FolderArchive className="w-5 h-5 text-amber-500" />;
      case 'design':
        return <FileImage className="w-5 h-5 text-purple-500" />;
      case 'pdf':
      default:
        return <FileText className="w-5 h-5 text-[#1E75FF]" />;
    }
  };

  const handleDownload = (file) => {
    showToast(`Downloading ${file.name}...`, 'info');
  };

  const handleShareFile = (file) => {
    navigator.clipboard?.writeText(`${window.location.origin}/tiwi/files/${file.id}`);
    showToast(`Secure file link copied for ${file.name}`, 'info');
  };

  const filteredFiles = files.filter((f) => {
    const matchesFilter = selectedFilter === 'All' || f.category === selectedFilter;
    const matchesQuery = f.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesQuery;
  });

  return (
    <div className="w-full flex flex-col gap-5 pb-20">
      {/* 1. Header Card */}
      <div className="bg-white dark:bg-[#161822] rounded-2xl border border-[#EAECF0] dark:border-[#1E232F] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#1E75FF]/10 text-[#1E75FF] flex items-center justify-center flex-shrink-0">
            <FileText className="w-6 h-6 stroke-[2]" />
          </div>
          <div>
            <h1 className="text-[20px] font-extrabold text-[#111827] dark:text-white tracking-tight flex items-center gap-2">
              Files & Documents
              <span className="text-[12px] font-semibold bg-[#1E75FF]/10 text-[#1E75FF] px-2.5 py-0.5 rounded-full">
                Cloud Vault
              </span>
            </h1>
            <p className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF]">
              Secure workspace file repository, assets, architectural specs, and shared documents
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-60">
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[38px] pl-9 pr-3 bg-[#F4F5F7] dark:bg-[#1A1D27] text-[13px] rounded-xl outline-none focus:ring-2 focus:ring-[#1E75FF]/30 transition"
            />
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-2.5" />
          </div>

          <button
            type="button"
            onClick={() => showToast('Upload file dialog opened', 'info')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E75FF] hover:bg-[#1A66E5] text-white text-[12.5px] font-bold shadow-xs transition cursor-pointer flex-shrink-0"
          >
            <Upload className="w-4 h-4" />
            <span>Upload File</span>
          </button>
        </div>
      </div>

      {/* 2. Storage Quota Banner */}
      <div className="bg-white dark:bg-[#161822] rounded-2xl border border-[#EAECF0] dark:border-[#1E232F] p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-10 h-10 rounded-xl bg-[#F4F5F7] dark:bg-[#1A1D27] flex items-center justify-center text-[#1E75FF]">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-[14px] text-[#111827] dark:text-white">
                Workspace Storage Quota
              </span>
              <span className="text-[12px] font-medium text-[#1E75FF]">14.2 GB of 50 GB used</span>
            </div>
            <div className="w-full sm:w-72 h-2 bg-gray-100 dark:bg-gray-800 rounded-full mt-1.5 overflow-hidden">
              <div className="h-full bg-[#1E75FF] rounded-full w-[28%]" />
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => showToast('Cloud storage settings', 'info')}
          className="text-[12.5px] font-semibold text-[#1E75FF] hover:underline"
        >
          Manage Storage →
        </button>
      </div>

      {/* 3. Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {filters.map((fil) => (
          <button
            key={fil}
            type="button"
            onClick={() => setSelectedFilter(fil)}
            className={`px-4 py-2 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedFilter === fil
                ? 'bg-[#1E75FF] text-white shadow-xs'
                : 'bg-white dark:bg-[#161822] text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] border border-[#EAECF0] dark:border-[#1E232F]'
            }`}
          >
            {fil}
          </button>
        ))}
      </div>

      {/* 4. Files List */}
      <div className="bg-white dark:bg-[#161822] rounded-2xl border border-[#EAECF0] dark:border-[#1E232F] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <div className="p-4 border-b border-[#F2F4F7] dark:border-[#1E232F] flex items-center justify-between">
          <span className="font-bold text-[14px] text-[#111827] dark:text-white">
            Files ({filteredFiles.length})
          </span>
          <span className="text-[12px] text-[#9CA3AF]">
            Sorted by Last Modified
          </span>
        </div>

        <div className="divide-y divide-[#F2F4F7] dark:divide-[#1E232F]">
          {filteredFiles.map((file) => (
            <div
              key={file.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#FAFBFD] dark:hover:bg-[#14161F] transition"
            >
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center flex-shrink-0">
                  {getFileIcon(file.type)}
                </div>

                <div className="flex flex-col min-w-0">
                  <span className="font-bold text-[14px] text-[#111827] dark:text-white truncate hover:text-[#1E75FF] transition-colors cursor-pointer">
                    {file.name}
                  </span>
                  <div className="flex items-center gap-3 text-[12px] text-[#9CA3AF] mt-0.5">
                    <span>{file.size}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {file.updatedAt}
                    </span>
                    <span>•</span>
                    <span>By {file.author}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownload(file)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E75FF]/10 hover:bg-[#1E75FF] text-[#1E75FF] hover:text-white text-[12px] font-bold transition cursor-pointer"
                  title="Download File"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleShareFile(file)}
                  className="p-2 rounded-lg text-[#6B7280] hover:text-[#1E75FF] hover:bg-gray-100 dark:hover:bg-gray-800 transition cursor-pointer"
                  title="Share File Link"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
