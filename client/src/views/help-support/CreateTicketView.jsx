import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  Folder,
  ChevronDown,
  ArrowDown,
  Info,
  Flame,
  UploadCloud,
  Send,
  X,
  FileText
} from 'lucide-react';

export default function CreateTicketView({ currentUser, onBack, onTicketCreated }) {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('Medium'); // 'Low' | 'Medium' | 'High'
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const categories = [
    'Payment & Billing',
    'Login & Authentication',
    'Droplet & Cloud Server Management',
    'Store Multi-Tenancy & Database',
    'POS System & Hardware',
    'Bug Report',
    'Feature Request',
    'General Inquiry'
  ];

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setAttachments(prev => [...prev, ...files.map(f => ({
        name: f.name,
        size: (f.size / (1024 * 1024)).toFixed(2) + ' MB'
      }))]);
    }
  };

  const handleRemoveFile = (index) => {
    setAttachments(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim()) {
      alert('Please enter a ticket subject.');
      return;
    }
    if (!category) {
      alert('Please select a category.');
      return;
    }
    if (!description.trim()) {
      alert('Please provide a description.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Real database creation via POST /api/support/tickets
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          category,
          priority,
          description: description.trim(),
          attachments: attachments.map(a => a.name),
          userId: currentUser?.id || currentUser?.tiwiId || '',
          userName: currentUser?.name || 'Imran'
        })
      });

      const data = await res.json();
      if (data?.ticket) {
        if (onTicketCreated) {
          onTicketCreated(data.ticket);
        }
      } else {
        alert('Could not save ticket to server.');
      }
    } catch (err) {
      console.error('Error creating ticket:', err);
      alert('Error creating ticket. Please check connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Navigation Bar (Full Width) */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-full bg-white dark:bg-gray-800 hover:bg-slate-50 dark:hover:bg-gray-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition border border-slate-200/80 dark:border-gray-700 shadow-2xs cursor-pointer group"
          title="Back"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition" />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Create Ticket
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Tell us what you need help with
          </p>
        </div>
      </div>

      {/* Form Card (Full Width Content matching screenshot View 3) */}
      <div className="bg-white dark:bg-gray-800/80 rounded-2xl sm:rounded-3xl p-4 sm:p-8 border border-slate-200/80 dark:border-gray-700/80 shadow-xs">
        <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
          {/* Subject Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Subject <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                {subject.length}/100
              </span>
            </div>
            <input
              type="text"
              maxLength={100}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter a short subject..."
              className="w-full px-4 py-3 rounded-xl text-xs sm:text-sm bg-white dark:bg-gray-900/80 border border-slate-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition placeholder-slate-400 dark:placeholder-slate-500 text-slate-800 dark:text-slate-100 shadow-2xs"
              required
            />
          </div>

          {/* Category Dropdown */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Category <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Folder className="w-4 h-4" />
              </div>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full pl-10 pr-10 py-3 rounded-xl text-xs sm:text-sm bg-white dark:bg-gray-900/80 border border-slate-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition appearance-none cursor-pointer text-slate-700 dark:text-slate-200 shadow-2xs"
                required
              >
                <option value="" disabled>Select a category</option>
                {categories.map((cat, idx) => (
                  <option key={idx} value={cat}>{cat}</option>
                ))}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Priority Toggles matching screenshot View 3 */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Priority
            </label>
            <div className="grid grid-cols-3 gap-3">
              {/* Low */}
              <button
                type="button"
                onClick={() => setPriority('Low')}
                className={`py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  priority === 'Low'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-400 dark:border-emerald-600 shadow-2xs'
                    : 'bg-white dark:bg-gray-900/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800'
                }`}
              >
                <ArrowDown className="w-3.5 h-3.5 text-emerald-500" />
                <span>Low</span>
              </button>

              {/* Medium (Selected in screenshot with blue tone) */}
              <button
                type="button"
                onClick={() => setPriority('Medium')}
                className={`py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  priority === 'Medium'
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border-blue-400 dark:border-blue-600 shadow-2xs'
                    : 'bg-white dark:bg-gray-900/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800'
                }`}
              >
                <Info className="w-3.5 h-3.5 text-blue-500" />
                <span>Medium</span>
              </button>

              {/* High */}
              <button
                type="button"
                onClick={() => setPriority('High')}
                className={`py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border transition-all cursor-pointer ${
                  priority === 'High'
                    ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-400 dark:border-red-600 shadow-2xs'
                    : 'bg-white dark:bg-gray-900/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-800'
                }`}
              >
                <Flame className="w-3.5 h-3.5 text-red-500" />
                <span>High</span>
              </button>
            </div>
          </div>

          {/* Description Textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Description <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                {description.length}/1000
              </span>
            </div>
            <textarea
              rows={5}
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your issue in detail..."
              className="w-full px-4 py-3 rounded-xl text-xs sm:text-sm bg-white dark:bg-gray-900/80 border border-slate-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition placeholder-slate-400 dark:placeholder-slate-500 text-slate-800 dark:text-slate-100 resize-none shadow-2xs"
              required
            />
          </div>

          {/* Attachments Dropzone */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Attachments (optional)
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 rounded-2xl p-6 text-center cursor-pointer transition bg-slate-50/50 dark:bg-gray-900/30 hover:bg-blue-50/20"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept=".jpg,.jpeg,.png,.pdf,.zip"
              />
              <div className="flex flex-col items-center justify-center gap-2">
                <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <UploadCloud className="w-5 h-5" />
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">Drag and drop files here</span>, or click to browse
                </div>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  Supports: JPG, PNG, PDF, ZIP (Max 10MB)
                </p>
              </div>
            </div>

            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {attachments.map((file, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-gray-800 text-xs text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-gray-700"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-500" />
                    <span className="truncate max-w-[150px]">{file.name}</span>
                    <span className="text-[10px] text-slate-400">({file.size})</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(idx)}
                      className="text-slate-400 hover:text-red-500 transition ml-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Primary Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'Creating Ticket...' : 'Create Ticket'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
