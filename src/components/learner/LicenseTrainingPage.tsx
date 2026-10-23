import React, { useState, useMemo } from 'react';
import { useLms } from '../../context/LmsContext';
import { LicenseTrainingLesson } from '../../types/lms';
import { useBodyScrollLock } from '../../lib/useBodyScrollLock';
import { formatBytes } from '../../lib/storageUtils';
import {
  Award,
  Play,
  FileText,
  Search,
  Clock,
  HardDrive,
  X,
  BookOpen,
  CheckCircle2,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { PdfThumbnail } from '../common/PdfThumbnail';
import { PdfViewerModal } from '../common/PdfViewerModal';
import { LicenseVideoPlayerModal } from './LicenseVideoPlayerModal';

export const LicenseTrainingPage: React.FC = () => {
  const { getPublishedLicenseLessons, getLessonProgress } = useLms();
  const publishedLessons = getPublishedLicenseLessons();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'video' | 'pdf'>('all');
  const [selectedVideoLesson, setSelectedVideoLesson] = useState<LicenseTrainingLesson | null>(null);
  const [selectedPdfLesson, setSelectedPdfLesson] = useState<LicenseTrainingLesson | null>(null);

  // Lock body scroll when either player/viewer modal is open
  useBodyScrollLock(!!selectedVideoLesson || !!selectedPdfLesson);

  // Filter lessons by tab and by simple title or description search
  const filteredLessons = useMemo(() => {
    let list = publishedLessons;

    // Filter by type
    if (activeTab !== 'all') {
      list = list.filter((l) => (l.lesson_type || l.content_type || 'video') === activeTab);
    }

    // Filter by simple search query on title or description only
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (l) =>
          l.title.toLowerCase().includes(q) ||
          (l.description && l.description.toLowerCase().includes(q))
      );
    }

    return list;
  }, [publishedLessons, activeTab, searchQuery]);

  const videoCount = publishedLessons.filter((l) => (l.lesson_type || l.content_type) === 'video').length;
  const pdfCount = publishedLessons.filter((l) => (l.lesson_type || l.content_type) === 'pdf').length;

  return (
    <div className="space-y-8 py-4 text-left">
      {/* Page Header Banner */}
      <div className="bg-gradient-to-r from-[#176B98]/12 via-[#176B98]/6 to-white p-6 sm:p-8 rounded-3xl border border-[#176B98]/15 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-3xl">
            {/* Clean unboxed text kicker adhering to zero-pill discipline */}
            <div className="flex items-center gap-2 text-xs font-bold text-[#176B98] uppercase tracking-wider mb-2">
              <ShieldCheck className="w-4 h-4 text-[#176B98]" />
              <span>Official Insurance Licensing & Regulatory Compliance Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#176B98] tracking-tight">
              License Training Library
            </h1>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Access official KBZLife Insurance agent licensing modules, statutory compliance curriculum, and professional underwriting study handbooks. Watch streaming video lessons and review interactive study materials directly in your secure learning workspace.
            </p>
          </div>

          {/* Quick Stats Counter */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="bg-white/90 backdrop-blur-xs px-4 py-3 rounded-2xl border border-slate-200/80 shadow-2xs text-center min-w-[100px]">
              <span className="block text-2xl font-extrabold text-[#176B98] tabular-nums">
                {publishedLessons.length}
              </span>
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Total Lessons
              </span>
            </div>
            <div className="bg-white/90 backdrop-blur-xs px-4 py-3 rounded-2xl border border-slate-200/80 shadow-2xs text-center min-w-[100px]">
              <span className="block text-2xl font-extrabold text-emerald-700 tabular-nums">
                {videoCount}
              </span>
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                Video Modules
              </span>
            </div>
          </div>
        </div>

        {/* Filter and Simple Search Bar (Category filters removed per requirements) */}
        <div className="mt-8 pt-6 border-t border-[#176B98]/15 flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Format Tabs (All, Videos, PDFs) */}
          <div className="inline-flex p-1 bg-white rounded-xl border border-slate-200 shadow-2xs shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-[#176B98] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-[#176B98]'
              }`}
            >
              All Materials ({publishedLessons.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('video')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'video'
                  ? 'bg-[#176B98] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-[#176B98]'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Video Lessons ({videoCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pdf')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'pdf'
                  ? 'bg-[#176B98] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-[#176B98]'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF Handbooks ({pdfCount})</span>
            </button>
          </div>

          {/* Simple Search Bar (Title or Description) */}
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search lessons by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 bg-white text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#176B98]/30 focus:border-[#176B98] transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content Grid */}
      {filteredLessons.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 max-w-md mx-auto my-8 shadow-card-elevated">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No lessons match your search</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            {searchQuery
              ? `No lessons found matching "${searchQuery}". Clear your search query or switch formats.`
              : 'There are currently no published lessons in this category.'}
          </p>
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveTab('all');
              }}
              className="mt-4 px-4 py-2 text-xs font-semibold text-[#176B98] bg-[#F3F8FB] hover:bg-[#176B98] hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          {filteredLessons.map((lesson) => {
            const isVideo = (lesson.lesson_type || lesson.content_type) === 'video';
            const displayDuration = lesson.video_duration || lesson.duration;
            const displaySize = lesson.file_size_formatted || (lesson.file_size_bytes ? formatBytes(lesson.file_size_bytes) : undefined);

            return (
              <div
                key={lesson.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-card-elevated hover:shadow-card-hover transition-all duration-300 flex flex-col justify-between overflow-hidden group hover:-translate-y-1 text-left"
              >
                {/* Media Thumbnail Container */}
                <div className="relative aspect-16/9 bg-slate-900 overflow-hidden">
                  {isVideo ? (
                    lesson.thumbnail_url ? (
                      <img
                        src={lesson.thumbnail_url}
                        alt={lesson.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 to-[#176B98] text-white p-4">
                        <Play className="w-10 h-10 text-white/80" />
                        <span className="text-[10px] font-bold mt-2 text-white/70 tracking-widest">
                          KBZLIFE ACADEMY
                        </span>
                      </div>
                    )
                  ) : (
                    /* PDF: Render real first page preview without placeholder images */
                    <PdfThumbnail
                      fileUrl={lesson.file_url}
                      title={lesson.title}
                      aspectClass="aspect-16/9"
                    />
                  )}

                  {/* Measured Scrim for contrast */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent pointer-events-none" />

                  {/* Top Format Label */}
                  <div className="absolute top-3 left-3 z-10">
                    <span
                      className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider backdrop-blur-md shadow-xs flex items-center gap-1 ${
                        isVideo
                          ? 'bg-[#176B98]/90 text-white'
                          : 'bg-emerald-600/90 text-white'
                      }`}
                    >
                      {isVideo ? (
                        <>
                          <Play className="w-3 h-3 fill-white" />
                          <span>Video Lesson</span>
                        </>
                      ) : (
                        <>
                          <FileText className="w-3 h-3" />
                          <span>PDF Handbook</span>
                        </>
                      )}
                    </span>
                  </div>

                  {/* Play Action Overlay for Videos (Watch in LMS) */}
                  {isVideo && (
                    <button
                      type="button"
                      onClick={() => setSelectedVideoLesson(lesson)}
                      className="absolute inset-0 flex items-center justify-center cursor-pointer group/btn"
                      aria-label={`Watch ${lesson.title} in LMS`}
                    >
                      <div className="w-13 h-13 rounded-full bg-[#176B98]/90 hover:bg-[#176B98] text-white flex items-center justify-center shadow-xl group-hover/btn:scale-115 transition-all duration-300 ring-4 ring-white/20">
                        <Play className="w-6 h-6 fill-white ml-0.5" />
                      </div>
                    </button>
                  )}

                  {/* Preview Action Overlay for PDFs (Open in Full LMS Viewer) */}
                  {!isVideo && (
                    <button
                      type="button"
                      onClick={() => setSelectedPdfLesson(lesson)}
                      className="absolute inset-0 flex items-center justify-center cursor-pointer group/btn opacity-85 hover:opacity-100 transition-opacity"
                      aria-label={`Open and preview ${lesson.title} in LMS`}
                    >
                      <div className="w-11 h-11 rounded-full bg-emerald-600/90 hover:bg-emerald-600 text-white flex items-center justify-center shadow-xl group-hover/btn:scale-115 transition-all duration-300 ring-4 ring-white/20">
                        <Eye className="w-5 h-5 ml-0.5" />
                      </div>
                    </button>
                  )}

                  {/* Bottom Duration & Size Indicators */}
                  <div className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1.5">
                    {isVideo && displayDuration && (
                      <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-white text-[10px] font-bold flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-sky-400" />
                        <span>{displayDuration}</span>
                      </span>
                    )}
                    {!isVideo && displaySize && (
                      <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-white text-[10px] font-bold flex items-center gap-1 font-mono">
                        <HardDrive className="w-3 h-3 text-emerald-400" />
                        <span>{displaySize}</span>
                      </span>
                    )}
                  </div>

                  {/* Module sequence badge */}
                  <div className="absolute bottom-2.5 left-2.5 z-10">
                    <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-white/90 text-[10px] font-mono">
                      Module #{lesson.display_order}
                    </span>
                  </div>
                </div>

                {/* Card Details */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    {/* Unboxed Metadata (Zero-pill discipline) */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1.5">
                      <span className="font-semibold text-slate-700">
                        {isVideo ? 'Streaming Video' : 'Official PDF Document'}
                      </span>
                      {displaySize && (
                        <>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span className="font-mono text-[11px]">{displaySize}</span>
                        </>
                      )}
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="text-emerald-700 font-medium">Verified</span>
                    </div>

                    {/* Card Title & Description */}
                    <h3 className="text-base font-extrabold text-slate-900 tracking-tight group-hover:text-[#176B98] transition-colors leading-snug">
                      {lesson.title}
                    </h3>
                    {lesson.description && (
                      <p className="text-xs text-slate-600 mt-2 line-clamp-3 leading-relaxed">
                        {lesson.description}
                      </p>
                    )}

                    {/* Completion Progress Tracking Bar (0-100%) */}
                    {(() => {
                      const prog = getLessonProgress(lesson.id);
                      const isComplete = prog.completion_status === 'completed' || prog.progress_percentage >= 95;
                      const pct = Math.min(100, Math.max(0, prog.progress_percentage));

                      return (
                        <div className="mt-4 pt-3 border-t border-slate-100">
                          <div className="flex items-center justify-between text-xs mb-1.5">
                            <div className="flex items-center gap-1.5">
                              {isComplete ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Completed (100%)</span>
                                </span>
                              ) : pct > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#176B98] bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
                                  <Clock className="w-3 h-3 text-[#176B98]" />
                                  <span>In Progress ({pct}%)</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                                  <span>Not Started (0%)</span>
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-mono font-bold text-slate-700">
                              {pct}%
                            </span>
                          </div>

                          {/* Progress Track */}
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/60 shadow-inner">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                isComplete
                                  ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                                  : pct > 0
                                  ? 'bg-gradient-to-r from-[#176B98] to-[#25A9D2]'
                                  : 'bg-transparent'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Footer Action Bar (Strictly View-Only: NO DOWNLOAD BUTTONS) */}
                  <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
                    {isVideo ? (
                      (() => {
                        const prog = getLessonProgress(lesson.id);
                        const isComplete = prog.completion_status === 'completed' || prog.progress_percentage >= 95;
                        const pct = Math.min(100, Math.max(0, prog.progress_percentage));

                        return (
                          <button
                            type="button"
                            onClick={() => setSelectedVideoLesson(lesson)}
                            className="w-full px-4 py-2.5 rounded-xl bg-[#176B98] hover:bg-[#12567a] text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs hover:shadow-md active:scale-[0.99]"
                          >
                            <Play className="w-3.5 h-3.5 fill-white" />
                            <span>
                              {isComplete
                                ? 'Rewatch Video Lesson'
                                : pct > 0
                                ? `Resume Lesson (${pct}%)`
                                : 'Watch Video Lesson'}
                            </span>
                          </button>
                        );
                      })()
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedPdfLesson(lesson)}
                        className="w-full px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs hover:shadow-md active:scale-[0.99]"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Read Official Handbook</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          AUTHENTICATED & SECURE VIDEO PLAYER MODAL (WITH ACCURATE PLAYBACK TRACKING)
          ========================================================================= */}
      {selectedVideoLesson && (
        <LicenseVideoPlayerModal
          lesson={selectedVideoLesson}
          onClose={() => setSelectedVideoLesson(null)}
        />
      )}

      {/* =========================================================================
          PROTECTED IN-APP PDF VIEWER MODAL (VIEW-ONLY, WATERMARKED)
          ========================================================================= */}
      {selectedPdfLesson && (
        <PdfViewerModal
          isOpen={!!selectedPdfLesson}
          onClose={() => setSelectedPdfLesson(null)}
          fileUrl={selectedPdfLesson.file_url}
          title={selectedPdfLesson.title}
          subtitle={`Module #${selectedPdfLesson.display_order}`}
        />
      )}
    </div>
  );
};
