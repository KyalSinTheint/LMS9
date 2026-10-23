import React, { useState, useRef, useMemo } from 'react';
import { useLms } from '../../context/LmsContext';
import { SkillDevelopmentResource, SkillCategory, SkillContentType } from '../../types/lms';
import { validateLessonFile, uploadLargeFileChunked, uploadImageFile, estimateVideoDuration, formatBytes } from '../../lib/storageUtils';
import { useBodyScrollLock } from '../../lib/useBodyScrollLock';
import {
  Compass,
  Plus,
  Play,
  FileText,
  ExternalLink,
  Upload,
  X,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Clock,
  Search,
  Layers,
  FolderPlus,
  Settings,
  Globe,
  Filter,
  Check,
} from 'lucide-react';
import { PdfThumbnail } from '../common/PdfThumbnail';
import { PdfViewerModal } from '../common/PdfViewerModal';
import { SkillVideoPlayerModal } from '../learner/SkillVideoPlayerModal';
import { ExternalLinkModal } from '../learner/ExternalLinkModal';

interface ResourceFormData {
  id?: string;
  title: string;
  description: string;
  category_id?: string;
  category: string;
  content_type: SkillContentType;
  file_url?: string;
  file_path?: string;
  file_name?: string;
  file_size_bytes?: number;
  file_size_formatted?: string;
  external_url?: string;
  video_duration?: string;
  thumbnail_url?: string;
  thumbnail_path?: string;
  instructor_name?: string;
  instructor_title?: string;
  instructor_avatar?: string;
  display_order: number;
  is_published: boolean;
}

const INITIAL_RESOURCE_FORM: ResourceFormData = {
  title: '',
  description: '',
  category: 'Business English',
  content_type: 'video',
  display_order: 1,
  is_published: true,
  instructor_name: 'KBZLife Academy',
  instructor_title: 'Lead Specialist',
  file_url: '',
  external_url: '',
};

interface CategoryFormData {
  id?: string;
  name: string;
  description: string;
  display_order: number;
  is_published: boolean;
}

const INITIAL_CATEGORY_FORM: CategoryFormData = {
  name: '',
  description: '',
  display_order: 1,
  is_published: true,
};

export const SkillDevelopmentManagement: React.FC = () => {
  const {
    skillCategories,
    skillDevelopmentResources,
    createSkillCategory,
    updateSkillCategory,
    deleteSkillCategory,
    createSkillResource,
    updateSkillResource,
    deleteSkillResource,
    showToast,
  } = useLms();

  // Resource Modal state
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [resourceForm, setResourceForm] = useState<ResourceFormData>(INITIAL_RESOURCE_FORM);

  // Category Manager Modal state
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState<CategoryFormData>(INITIAL_CATEGORY_FORM);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  // Delete confirmations
  const [deleteResourceConfirmId, setDeleteResourceConfirmId] = useState<string | null>(null);
  const [deleteCategoryConfirmId, setDeleteCategoryConfirmId] = useState<string | null>(null);

  // Preview modals
  const [previewVideoResource, setPreviewVideoResource] = useState<SkillDevelopmentResource | null>(null);
  const [previewPdfResource, setPreviewPdfResource] = useState<SkillDevelopmentResource | null>(null);
  const [previewLinkResource, setPreviewLinkResource] = useState<SkillDevelopmentResource | null>(null);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'published' | 'draft'>('all');

  // File upload progress state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatusText, setUploadStatusText] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Form submission loading
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lock body scroll during any active modal
  useBodyScrollLock(
    isResourceModalOpen ||
    isCategoryModalOpen ||
    !!deleteResourceConfirmId ||
    !!deleteCategoryConfirmId ||
    !!previewVideoResource ||
    !!previewPdfResource ||
    !!previewLinkResource
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Active categories list
  const activeCategories = useMemo(() => {
    return [...skillCategories].sort((a, b) => a.display_order - b.display_order);
  }, [skillCategories]);

  // Filtered resources
  const filteredResources = useMemo(() => {
    let list = skillDevelopmentResources;

    if (filterCategory !== 'all') {
      list = list.filter(
        (r) =>
          (r.category_id && r.category_id === filterCategory) ||
          r.category?.toLowerCase() === filterCategory.toLowerCase() ||
          r.topic?.toLowerCase() === filterCategory.toLowerCase()
      );
    }

    if (filterType !== 'all') {
      list = list.filter((r) => r.content_type === filterType);
    }

    if (filterStatus === 'published') {
      list = list.filter((r) => r.is_published === true || r.status === 'published');
    } else if (filterStatus === 'draft') {
      list = list.filter((r) => r.is_published === false || r.status === 'draft');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          (r.description && r.description.toLowerCase().includes(q)) ||
          r.category?.toLowerCase().includes(q) ||
          r.topic?.toLowerCase().includes(q) ||
          (r.instructor_name && r.instructor_name.toLowerCase().includes(q))
      );
    }

    return list;
  }, [skillDevelopmentResources, filterCategory, filterType, filterStatus, searchQuery]);

  // Quick stats
  const totalCount = skillDevelopmentResources.length;
  const publishedCount = skillDevelopmentResources.filter((r) => r.is_published === true || r.status === 'published').length;
  const videoCount = skillDevelopmentResources.filter((r) => r.content_type === 'video').length;
  const pdfCount = skillDevelopmentResources.filter((r) => r.content_type === 'pdf').length;
  const linkCount = skillDevelopmentResources.filter((r) => r.content_type === 'link').length;

  // -------------------------------------------------------------
  // RESOURCE HANDLERS
  // -------------------------------------------------------------

  const handleOpenCreateResource = () => {
    const defaultCat = activeCategories[0]?.name || 'Business English';
    const defaultCatId = activeCategories[0]?.id;
    setResourceForm({
      ...INITIAL_RESOURCE_FORM,
      category: defaultCat,
      category_id: defaultCatId,
      display_order: skillDevelopmentResources.length + 1,
    });
    setUploadError(null);
    setUploadProgress(0);
    setIsResourceModalOpen(true);
  };

  const handleOpenEditResource = (r: SkillDevelopmentResource) => {
    const currentCategory = r.category || r.topic || activeCategories[0]?.name || 'General';
    const matchedCategory = activeCategories.find(
      (c) => c.id === r.category_id || c.name.toLowerCase() === currentCategory.toLowerCase()
    );

    setResourceForm({
      id: r.id,
      title: r.title,
      description: r.description || '',
      category_id: matchedCategory?.id || r.category_id,
      category: matchedCategory?.name || currentCategory,
      content_type: r.content_type,
      file_url: r.file_url || r.content_url || '',
      file_path: r.file_path || r.storage_path,
      file_name: r.file_name,
      file_size_bytes: r.file_size_bytes || r.file_size,
      file_size_formatted: r.file_size_formatted,
      external_url: r.external_url || (r.content_type === 'link' ? r.content_url : ''),
      video_duration: r.video_duration || r.duration,
      thumbnail_url: r.thumbnail_url || '',
      thumbnail_path: r.thumbnail_path,
      instructor_name: r.instructor_name || '',
      instructor_title: r.instructor_title || r.instructor_role || '',
      instructor_avatar: r.instructor_avatar || '',
      display_order: r.display_order,
      is_published: r.is_published ?? (r.status === 'published'),
    });
    setUploadError(null);
    setUploadProgress(0);
    setIsResourceModalOpen(true);
  };

  const handleToggleResourcePublish = async (r: SkillDevelopmentResource, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = !(r.is_published ?? (r.status === 'published'));
    await updateSkillResource(r.id, {
      is_published: newStatus,
      status: newStatus ? 'published' : 'draft',
    });
    showToast(
      'info',
      newStatus ? 'Resource Published' : 'Resource Unpublished',
      `"${r.title}" is now ${newStatus ? 'visible to learners' : 'set to draft'}.`
    );
  };

  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsUploading(false);
    setUploadProgress(0);
    setUploadStatusText('Upload cancelled by administrator.');
    showToast('info', 'Upload Cancelled', 'File upload was halted.');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (resourceForm.content_type === 'link') return;

    const expectedType = resourceForm.content_type === 'video' ? 'video' : 'pdf';
    const validation = validateLessonFile(file, expectedType);
    if (!validation.valid) {
      setUploadError(validation.error || 'Invalid file');
      showToast('error', 'Invalid File', validation.error || 'Please select a valid file.');
      return;
    }

    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(5);
    setUploadStatusText('Preparing file for upload...');

    abortControllerRef.current = new AbortController();

    try {
      let durationStr: string | undefined = undefined;
      if (expectedType === 'video') {
        try {
          const durationSeconds = await estimateVideoDuration(file);
          const mins = Math.floor(durationSeconds / 60);
          const secs = Math.floor(durationSeconds % 60);
          durationStr = `${mins}:${secs.toString().padStart(2, '0')}`;
        } catch {
          durationStr = undefined;
        }
      }

      const res = await uploadLargeFileChunked(
        file,
        'skill-materials',
        (percent, loaded, total) => {
          setUploadProgress(percent);
          setUploadStatusText(`Uploading: ${percent}% (${(loaded / 1024 / 1024).toFixed(1)}MB of ${(total / 1024 / 1024).toFixed(1)}MB)`);
        },
        abortControllerRef.current.signal
      );

      if (res.success && res.url) {
        setResourceForm((prev) => ({
          ...prev,
          file_url: res.url,
          file_path: res.storage_path || res.path || res.fileName,
          file_name: res.fileName,
          file_size_bytes: res.size,
          file_size_formatted: res.formattedSize || formatBytes(res.size || 0),
          video_duration: durationStr || prev.video_duration,
          title: prev.title.trim() ? prev.title : file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '),
        }));
        showToast('success', 'Upload Complete', `${file.name} successfully uploaded.`);
      } else {
        throw new Error(res.error || 'Upload failed.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('abort') || msg.includes('cancelled')) {
        setUploadStatusText('Upload cancelled.');
      } else {
        setUploadError(msg);
        showToast('error', 'Upload Error', msg);
      }
    } finally {
      setIsUploading(false);
      abortControllerRef.current = null;
    }
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      showToast('info', 'Uploading Thumbnail', 'Processing image...');
      const res = await uploadImageFile(file, 'skill-thumbnails');
      if (res.success && res.url) {
        setResourceForm((prev) => ({
          ...prev,
          thumbnail_url: res.url,
          thumbnail_path: res.storage_path || res.path,
        }));
        showToast('success', 'Thumbnail Updated', 'Cover image uploaded.');
      } else {
        throw new Error(res.error || 'Thumbnail upload failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast('error', 'Thumbnail Error', msg);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      showToast('info', 'Uploading Avatar', 'Processing instructor photo...');
      const res = await uploadImageFile(file, 'skill-instructors');
      if (res.success && res.url) {
        setResourceForm((prev) => ({
          ...prev,
          instructor_avatar: res.url,
        }));
        showToast('success', 'Avatar Updated', 'Instructor photo uploaded.');
      } else {
        throw new Error(res.error || 'Avatar upload failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast('error', 'Avatar Error', msg);
    }
  };

  const handleSubmitResource = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resourceForm.title.trim()) {
      showToast('error', 'Validation Error', 'Resource title is required.');
      return;
    }

    if (resourceForm.content_type === 'link') {
      if (!resourceForm.external_url?.trim()) {
        showToast('error', 'Validation Error', 'External learning URL is required.');
        return;
      }
      try {
        new URL(resourceForm.external_url.trim());
      } catch {
        showToast('error', 'Invalid URL', 'Please provide a valid URL starting with http:// or https://');
        return;
      }
    } else {
      if (!resourceForm.file_url?.trim()) {
        showToast('error', 'File Missing', `Please upload or provide a URL for this ${resourceForm.content_type.toUpperCase()} resource.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const selectedCategory = activeCategories.find((c) => c.name === resourceForm.category);
      const categoryId = selectedCategory?.id || resourceForm.category_id;
      const categoryName = resourceForm.category.trim();

      const resourcePayload = {
        title: resourceForm.title.trim(),
        description: resourceForm.description.trim(),
        category_id: categoryId,
        category: categoryName,
        topic: categoryName,
        content_type: resourceForm.content_type,
        file_url: resourceForm.file_url?.trim() || undefined,
        content_url: resourceForm.content_type === 'link' ? resourceForm.external_url?.trim() : resourceForm.file_url?.trim(),
        external_url: resourceForm.content_type === 'link' ? resourceForm.external_url?.trim() : undefined,
        file_path: resourceForm.file_path,
        storage_path: resourceForm.file_path,
        file_name: resourceForm.file_name,
        file_size_bytes: resourceForm.file_size_bytes,
        file_size_formatted: resourceForm.file_size_formatted,
        video_duration: resourceForm.video_duration,
        duration: resourceForm.video_duration,
        thumbnail_url: resourceForm.thumbnail_url?.trim() || undefined,
        instructor_name: resourceForm.instructor_name?.trim() || 'KBZLife Academy',
        instructor_role: resourceForm.instructor_title?.trim() || 'Lead Specialist',
        instructor_title: resourceForm.instructor_title?.trim() || 'Lead Specialist',
        instructor_avatar: resourceForm.instructor_avatar?.trim() || undefined,
        lesson_count: 1,
        display_order: Number(resourceForm.display_order) || 1,
        status: resourceForm.is_published ? ('published' as const) : ('draft' as const),
        is_published: resourceForm.is_published,
      };

      if (resourceForm.id) {
        await updateSkillResource(resourceForm.id, resourcePayload);
        showToast('success', 'Resource Updated', `"${resourcePayload.title}" has been updated.`);
      } else {
        await createSkillResource(resourcePayload);
        showToast('success', 'Resource Published', `"${resourcePayload.title}" has been created.`);
      }

      setIsResourceModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast('error', 'Save Failed', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteResource = async () => {
    if (!deleteResourceConfirmId) return;
    await deleteSkillResource(deleteResourceConfirmId);
    setDeleteResourceConfirmId(null);
  };

  // -------------------------------------------------------------
  // CATEGORY MANAGEMENT HANDLERS
  // -------------------------------------------------------------

  const handleOpenCategoryManager = () => {
    setCategoryForm({
      ...INITIAL_CATEGORY_FORM,
      display_order: skillCategories.length + 1,
    });
    setEditingCategoryId(null);
    setIsCategoryModalOpen(true);
  };

  const handleEditCategory = (cat: SkillCategory) => {
    setCategoryForm({
      id: cat.id,
      name: cat.name,
      description: cat.description || '',
      display_order: cat.display_order,
      is_published: cat.is_published,
    });
    setEditingCategoryId(cat.id);
  };

  const handleCancelEditCategory = () => {
    setCategoryForm({
      ...INITIAL_CATEGORY_FORM,
      display_order: skillCategories.length + 1,
    });
    setEditingCategoryId(null);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim()) {
      showToast('error', 'Validation Error', 'Category name is required.');
      return;
    }

    try {
      if (editingCategoryId) {
        await updateSkillCategory(editingCategoryId, {
          name: categoryForm.name.trim(),
          description: categoryForm.description.trim(),
          display_order: Number(categoryForm.display_order) || 1,
          is_published: categoryForm.is_published,
        });
        showToast('success', 'Category Updated', `"${categoryForm.name}" updated successfully.`);
      } else {
        // Check uniqueness
        if (skillCategories.some((c) => c.name.toLowerCase() === categoryForm.name.trim().toLowerCase())) {
          showToast('error', 'Duplicate Category', 'A category with this name already exists.');
          return;
        }

        await createSkillCategory({
          name: categoryForm.name.trim(),
          description: categoryForm.description.trim(),
          display_order: Number(categoryForm.display_order) || skillCategories.length + 1,
          is_published: categoryForm.is_published,
        });
        showToast('success', 'Category Created', `"${categoryForm.name}" created successfully.`);
      }

      setCategoryForm({
        ...INITIAL_CATEGORY_FORM,
        display_order: skillCategories.length + 1,
      });
      setEditingCategoryId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast('error', 'Category Save Failed', msg);
    }
  };

  const handleToggleCategoryPublish = async (cat: SkillCategory) => {
    await updateSkillCategory(cat.id, { is_published: !cat.is_published });
  };

  const handleConfirmDeleteCategory = async () => {
    if (!deleteCategoryConfirmId) return;
    const cat = skillCategories.find((c) => c.id === deleteCategoryConfirmId);
    if (!cat) return;

    // Check count of assigned resources
    const assignedCount = skillDevelopmentResources.filter(
      (r) => r.category_id === cat.id || r.category === cat.name || r.topic === cat.name
    ).length;

    await deleteSkillCategory(deleteCategoryConfirmId);
    setDeleteCategoryConfirmId(null);
    if (assignedCount > 0) {
      showToast(
        'info',
        'Category Deleted',
        `"${cat.name}" was removed. ${assignedCount} assigned resources have been retained.`
      );
    }
  };

  // Preview Handler
  const handlePreview = (r: SkillDevelopmentResource) => {
    if (r.content_type === 'video') {
      setPreviewVideoResource(r);
    } else if (r.content_type === 'pdf') {
      setPreviewPdfResource(r);
    } else {
      setPreviewLinkResource(r);
    }
  };

  return (
    <div className="space-y-8 text-left pb-16">
      {/* 1. Header Banner & Quick Counters (Consistent with LicenseTrainingManagement) */}
      <div className="bg-gradient-to-r from-[#176B98]/12 via-[#176B98]/6 to-white p-6 sm:p-8 rounded-3xl border border-[#176B98]/15 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-3xl">
            {/* Zero-pill unboxed kicker */}
            <div className="flex items-center gap-2 text-xs font-bold text-[#176B98] uppercase tracking-wider mb-2">
              <Compass className="w-4 h-4 text-[#176B98]" />
              <span>Skill Development & Capability Governance Console</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#176B98] tracking-tight">
              Skill Development Management
            </h1>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Curate professional business English, Microsoft Excel automation, executive leadership, and technical digital capabilities for KBZLife employees. Create custom categories, upload protected videos and PDFs, or register verified external learning links.
            </p>
          </div>

          {/* Quick Stats Grid */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="bg-white/95 backdrop-blur-xs px-4 py-3 rounded-2xl border border-slate-200/80 shadow-2xs text-center min-w-[90px]">
              <span className="block text-xl font-extrabold text-[#176B98] tabular-nums">
                {totalCount}
              </span>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                Total Classes
              </span>
            </div>
            <div className="bg-white/95 backdrop-blur-xs px-4 py-3 rounded-2xl border border-slate-200/80 shadow-2xs text-center min-w-[90px]">
              <span className="block text-xl font-extrabold text-emerald-700 tabular-nums">
                {publishedCount}
              </span>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                Published
              </span>
            </div>
            <div className="bg-white/95 backdrop-blur-xs px-4 py-3 rounded-2xl border border-slate-200/80 shadow-2xs text-center min-w-[90px]">
              <span className="block text-xl font-extrabold text-[#25A9D2] tabular-nums">
                {skillCategories.length}
              </span>
              <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                Categories
              </span>
            </div>
          </div>
        </div>

        {/* Action Bar: Category Manager Button + Add Resource Button + Filter Controls */}
        <div className="mt-8 pt-6 border-t border-[#176B98]/15 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Manage Categories Button */}
            <button
              type="button"
              onClick={handleOpenCategoryManager}
              className="px-4 py-2.5 rounded-xl border border-[#176B98]/30 bg-white hover:bg-[#F3F8FB] text-[#176B98] text-xs font-bold transition-all flex items-center gap-2 shadow-2xs cursor-pointer"
            >
              <FolderPlus className="w-4 h-4 text-[#176B98]" />
              <span>Manage Categories ({skillCategories.length})</span>
            </button>

            {/* Add New Resource Button */}
            <button
              type="button"
              onClick={handleOpenCreateResource}
              className="px-4 py-2.5 rounded-xl bg-[#176B98] hover:bg-[#12567a] text-white text-xs font-bold transition-all flex items-center gap-2 shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Learning Resource</span>
            </button>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Category Filter Dropdown */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-3 py-2 bg-white text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#176B98]/30 font-medium text-slate-700 shadow-2xs cursor-pointer"
            >
              <option value="all">All Categories ({skillDevelopmentResources.length})</option>
              {activeCategories.map((c) => {
                const count = skillDevelopmentResources.filter(
                  (r) => r.category_id === c.id || r.category === c.name || r.topic === c.name
                ).length;
                return (
                  <option key={c.id} value={c.name}>
                    {c.name} ({count})
                  </option>
                );
              })}
            </select>

            {/* Content Type Filter */}
            <div className="inline-flex p-1 bg-white rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  filterType === 'all' ? 'bg-[#176B98] text-white' : 'text-slate-600 hover:text-[#176B98]'
                }`}
              >
                All ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterType('video')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  filterType === 'video' ? 'bg-[#176B98] text-white' : 'text-slate-600 hover:text-[#176B98]'
                }`}
              >
                <Play className="w-3 h-3" />
                <span>Video ({videoCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterType('pdf')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  filterType === 'pdf' ? 'bg-[#176B98] text-white' : 'text-slate-600 hover:text-[#176B98]'
                }`}
              >
                <FileText className="w-3 h-3" />
                <span>PDF ({pdfCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setFilterType('link')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  filterType === 'link' ? 'bg-[#176B98] text-white' : 'text-slate-600 hover:text-[#176B98]'
                }`}
              >
                <ExternalLink className="w-3 h-3" />
                <span>Link ({linkCount})</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-60">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search classes or author..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-2 bg-white text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#176B98]/30 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Resources Management Grid */}
      {filteredResources.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 max-w-md mx-auto my-8 shadow-card-elevated">
          <Compass className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No resources found</h3>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            {searchQuery
              ? `No resources match "${searchQuery}". Reset your query or filter.`
              : 'No learning materials created yet. Click "Add Learning Resource" above to create your first class.'}
          </p>
          {(searchQuery || filterCategory !== 'all' || filterType !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilterCategory('all');
                setFilterType('all');
                setFilterStatus('all');
              }}
              className="mt-4 px-4 py-2 text-xs font-semibold text-[#176B98] bg-[#F3F8FB] hover:bg-[#176B98] hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
          {filteredResources.map((resource) => {
            const isVideo = resource.content_type === 'video';
            const isPdf = resource.content_type === 'pdf';
            const isLink = resource.content_type === 'link';
            const isPublished = resource.is_published ?? (resource.status === 'published');
            const displayCategory = resource.category || resource.topic || 'General';

            return (
              <div
                key={resource.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-card-elevated hover:shadow-card-hover transition-all duration-300 flex flex-col justify-between overflow-hidden group hover:-translate-y-1 text-left"
              >
                {/* Media Preview Header */}
                <div className="relative aspect-16/9 bg-slate-900 overflow-hidden">
                  {isPdf ? (
                    <PdfThumbnail
                      fileUrl={resource.file_url || resource.content_url || ''}
                      title={resource.title}
                      aspectClass="aspect-16/9"
                    />
                  ) : resource.thumbnail_url ? (
                    <img
                      src={resource.thumbnail_url}
                      alt={resource.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-[#176B98] text-white p-4">
                      {isVideo && <Play className="w-10 h-10 text-white/80" />}
                      {isLink && <ExternalLink className="w-10 h-10 text-white/80" />}
                      <span className="text-[10px] font-bold mt-2 text-white/70 uppercase tracking-widest">
                        {displayCategory}
                      </span>
                    </div>
                  )}

                  {/* Scrim Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent pointer-events-none" />

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider backdrop-blur-md shadow-xs flex items-center gap-1 ${
                        isVideo
                          ? 'bg-[#176B98]/90 text-white'
                          : isPdf
                          ? 'bg-emerald-600/90 text-white'
                          : 'bg-sky-600/90 text-white'
                      }`}
                    >
                      {isVideo && (
                        <>
                          <Play className="w-3 h-3 fill-white" />
                          <span>Video</span>
                        </>
                      )}
                      {isPdf && (
                        <>
                          <FileText className="w-3 h-3" />
                          <span>PDF</span>
                        </>
                      )}
                      {isLink && (
                        <>
                          <ExternalLink className="w-3 h-3" />
                          <span>External Link</span>
                        </>
                      )}
                    </span>

                    <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-black/60 backdrop-blur-md text-white/95">
                      {displayCategory}
                    </span>
                  </div>

                  {/* Published status tag */}
                  <div className="absolute top-3 right-3 z-10">
                    <button
                      type="button"
                      onClick={(e) => handleToggleResourcePublish(resource, e)}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1 shadow-xs cursor-pointer transition-colors backdrop-blur-md ${
                        isPublished
                          ? 'bg-emerald-500/90 text-white hover:bg-emerald-600'
                          : 'bg-amber-500/90 text-white hover:bg-amber-600'
                      }`}
                      title="Click to toggle publish status"
                    >
                      {isPublished ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Published</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3 h-3" />
                          <span>Draft</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Bottom Duration & Size tags */}
                  <div className="absolute bottom-2.5 right-2.5 z-10 flex items-center gap-1.5">
                    {isVideo && (resource.video_duration || resource.duration) && (
                      <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-white text-[10px] font-bold flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-sky-400" />
                        <span>{resource.video_duration || resource.duration}</span>
                      </span>
                    )}
                    {isPdf && resource.file_size_formatted && (
                      <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-white text-[10px] font-bold flex items-center gap-1 font-mono">
                        <HardDrive className="w-3 h-3 text-emerald-400" />
                        <span>{resource.file_size_formatted}</span>
                      </span>
                    )}
                    {isLink && (
                      <span className="px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-xs text-white text-[10px] font-bold flex items-center gap-1">
                        <Globe className="w-3 h-3 text-sky-300" />
                        <span>Web Resource</span>
                      </span>
                    )}
                  </div>

                  <div className="absolute bottom-2.5 left-2.5 z-10">
                    <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-white/90 text-[10px] font-mono">
                      Order #{resource.display_order}
                    </span>
                  </div>
                </div>

                {/* Card Content & Details */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-base font-extrabold text-[#176B98] tracking-tight group-hover:text-[#12567a] transition-colors leading-snug line-clamp-2">
                      {resource.title}
                    </h3>
                    {resource.description && (
                      <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                        {resource.description}
                      </p>
                    )}
                  </div>

                  {/* Instructor row */}
                  {resource.instructor_name && (
                    <div className="pt-3 border-t border-slate-100 flex items-center gap-2.5">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {resource.instructor_avatar ? (
                          <img
                            src={resource.instructor_avatar}
                            alt={resource.instructor_name}
                            className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-[#176B98]/10 text-[#176B98] flex items-center justify-center font-bold text-[10px] shrink-0">
                            {resource.instructor_name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800 truncate">
                            {resource.instructor_name}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {resource.instructor_title || resource.instructor_role || 'Specialist'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Management Action Bar */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handlePreview(resource)}
                      className="px-3 py-1.5 rounded-lg bg-[#F3F8FB] hover:bg-[#176B98] hover:text-white text-[#176B98] text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      title="Preview as learner"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditResource(resource)}
                        className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                        title="Edit resource"
                        aria-label="Edit resource"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteResourceConfirmId(resource.id)}
                        className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors cursor-pointer"
                        title="Delete resource"
                        aria-label="Delete resource"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          3. CATEGORY MANAGEMENT MODAL (Create, Edit, Delete, Reorder)
          ========================================================================= */}
      {isCategoryModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
          onClick={() => setIsCategoryModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200 my-auto animate-in fade-in zoom-in-95 duration-200 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-[#F3F8FB]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#176B98] text-white flex items-center justify-center shadow-xs">
                  <FolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Manage Skill Categories
                  </h3>
                  <p className="text-xs text-slate-500">
                    Organize classes into published subject tracks for employees
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Category Add/Edit Form */}
              <form onSubmit={handleSaveCategory} className="p-4 rounded-2xl bg-[#F3F8FB] border border-[#176B98]/20 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-[#176B98] uppercase tracking-wider">
                    {editingCategoryId ? 'Edit Category' : 'Create New Category'}
                  </h4>
                  {editingCategoryId && (
                    <button
                      type="button"
                      onClick={handleCancelEditCategory}
                      className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Category Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Business English, Data Analytics..."
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      className="w-full px-3 py-2 bg-white text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#176B98]/30 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Display Order
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={categoryForm.display_order}
                      onChange={(e) => setCategoryForm({ ...categoryForm, display_order: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 bg-white text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#176B98]/30 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Description / Scope
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Brief description of skills covered in this category..."
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    className="w-full px-3 py-2 bg-white text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#176B98]/30"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={categoryForm.is_published}
                      onChange={(e) => setCategoryForm({ ...categoryForm, is_published: e.target.checked })}
                      className="w-4 h-4 rounded text-[#176B98] focus:ring-[#176B98]"
                    />
                    <span>Publish immediately to learners</span>
                  </label>

                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-[#176B98] hover:bg-[#12567a] text-white text-xs font-bold transition-all shadow-2xs cursor-pointer"
                  >
                    {editingCategoryId ? 'Save Changes' : '+ Add Category'}
                  </button>
                </div>
              </form>

              {/* Current Categories List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Existing Categories ({skillCategories.length})
                </h4>

                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                  {skillCategories.map((cat) => {
                    const resourceCount = skillDevelopmentResources.filter(
                      (r) => r.category_id === cat.id || r.category === cat.name || r.topic === cat.name
                    ).length;

                    return (
                      <div
                        key={cat.id}
                        className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] text-slate-400 font-bold">
                              #{cat.display_order}
                            </span>
                            <span className="text-xs font-extrabold text-slate-900">
                              {cat.name}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                cat.is_published
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {cat.is_published ? 'Published' : 'Draft'}
                            </span>
                          </div>
                          {cat.description && (
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                              {cat.description}
                            </p>
                          )}
                          <span className="text-[10px] text-[#176B98] font-bold mt-1 inline-block">
                            {resourceCount} {resourceCount === 1 ? 'class assigned' : 'classes assigned'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleCategoryPublish(cat)}
                            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                            title={cat.is_published ? 'Unpublish' : 'Publish'}
                          >
                            {cat.is_published ? <Eye className="w-3.5 h-3.5 text-emerald-600" /> : <EyeOff className="w-3.5 h-3.5 text-amber-600" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEditCategory(cat)}
                            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteCategoryConfirmId(cat.id)}
                            className="p-1.5 rounded-lg hover:bg-red-100 text-red-600 transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          4. CREATE / EDIT RESOURCE MODAL
          ========================================================================= */}
      {isResourceModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
          onClick={() => !isUploading && setIsResourceModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-slate-200 my-auto animate-in fade-in zoom-in-95 duration-200 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-[#F3F8FB]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#176B98] text-white flex items-center justify-center shadow-xs">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {resourceForm.id ? 'Edit Skill Resource' : 'Add New Skill Resource'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Publish videos, PDF handbooks, or interactive external learning links
                  </p>
                </div>
              </div>

              {!isUploading && (
                <button
                  type="button"
                  onClick={() => setIsResourceModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                  aria-label="Close modal"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSubmitResource} className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
              {/* Content Type Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  1. Select Content Format <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setResourceForm({ ...resourceForm, content_type: 'video' })}
                    className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      resourceForm.content_type === 'video'
                        ? 'border-[#176B98] bg-[#176B98]/10 text-[#176B98] shadow-2xs ring-2 ring-[#176B98]/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Play className="w-5 h-5" />
                    <span>Video Lesson</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResourceForm({ ...resourceForm, content_type: 'pdf' })}
                    className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      resourceForm.content_type === 'pdf'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700 shadow-2xs ring-2 ring-emerald-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <FileText className="w-5 h-5" />
                    <span>PDF Handbook</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResourceForm({ ...resourceForm, content_type: 'link' })}
                    className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      resourceForm.content_type === 'link'
                        ? 'border-sky-600 bg-sky-50 text-sky-700 shadow-2xs ring-2 ring-sky-500/20'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <ExternalLink className="w-5 h-5" />
                    <span>External Link</span>
                  </button>
                </div>
              </div>

              {/* Title & Category Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Resource Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. English for Client Advisory & Presentation"
                    value={resourceForm.title}
                    onChange={(e) => setResourceForm({ ...resourceForm, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#176B98]/30 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Assigned Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={resourceForm.category}
                    onChange={(e) => {
                      const matched = activeCategories.find((c) => c.name === e.target.value);
                      setResourceForm({
                        ...resourceForm,
                        category: e.target.value,
                        category_id: matched?.id,
                      });
                    }}
                    className="w-full px-3.5 py-2.5 bg-white text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#176B98]/30 font-medium text-slate-800"
                  >
                    {activeCategories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description & Key Takeaways
                </label>
                <textarea
                  rows={3}
                  placeholder="Summarize course content, target insurance audience, and learning objectives..."
                  value={resourceForm.description}
                  onChange={(e) => setResourceForm({ ...resourceForm, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-white text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#176B98]/30"
                />
              </div>

              {/* File Upload or External Link Input */}
              {resourceForm.content_type === 'link' ? (
                <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200/80 space-y-3">
                  <label className="block text-xs font-bold text-sky-900">
                    External Learning URL <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <Globe className="w-4 h-4 text-sky-600 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="url"
                      required
                      placeholder="https://www.youtube.com/... or https://coursera.org/..."
                      value={resourceForm.external_url || ''}
                      onChange={(e) => setResourceForm({ ...resourceForm, external_url: e.target.value })}
                      className="w-full pl-9 pr-3 py-2.5 bg-white text-xs border border-sky-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500/30 font-mono"
                    />
                  </div>
                  <p className="text-[11px] text-sky-700">
                    Learners will be prompted with a clear external destination preview and informed that internal watermarking and offline restrictions do not apply to third-party hosted content.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-800">
                      Upload {resourceForm.content_type === 'video' ? 'Video File (MP4/WebM)' : 'PDF Handbook'} <span className="text-red-500">*</span>
                    </label>
                    {resourceForm.file_size_formatted && (
                      <span className="text-[11px] font-mono text-slate-500 font-bold">
                        Size: {resourceForm.file_size_formatted}
                      </span>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={resourceForm.content_type === 'video' ? 'video/mp4,video/webm' : 'application/pdf'}
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  {/* Drop area */}
                  <div
                    onClick={() => !isUploading && fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all ${
                      resourceForm.file_url
                        ? 'border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50'
                        : 'border-slate-300 hover:border-[#176B98] bg-white hover:bg-slate-50'
                    }`}
                  >
                    <Upload className="w-6 h-6 text-[#176B98] mx-auto mb-1.5" />
                    {resourceForm.file_name ? (
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-emerald-800 truncate">
                          {resourceForm.file_name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Click to replace file ({resourceForm.file_size_formatted || 'Uploaded'})
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-slate-700">
                          Click to upload from device (supports up to 1GB)
                        </p>
                        <p className="text-[10px] text-slate-400">
                          Chunked streaming to Supabase Storage with local resilient fallback
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Upload Progress Bar */}
                  {isUploading && (
                    <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-[#176B98]">{uploadStatusText}</span>
                        <span className="font-mono text-slate-700">{uploadProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#176B98] to-[#25A9D2] transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                      <div className="text-right">
                        <button
                          type="button"
                          onClick={handleCancelUpload}
                          className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
                        >
                          Cancel Upload
                        </button>
                      </div>
                    </div>
                  )}

                  {uploadError && (
                    <p className="text-xs text-red-600 font-semibold">{uploadError}</p>
                  )}

                  {/* Or Direct URL option */}
                  <div className="pt-2">
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Or Direct Media URL:
                    </label>
                    <input
                      type="text"
                      placeholder="https://... or /uploads/..."
                      value={resourceForm.file_url || ''}
                      onChange={(e) => setResourceForm({ ...resourceForm, file_url: e.target.value })}
                      className="w-full px-3 py-2 bg-white text-xs border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Cover Thumbnail Image (Optional) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Custom Cover Image (Optional)
                  </label>
                  <input
                    ref={thumbnailInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailUpload}
                    className="hidden"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Image URL or upload"
                      value={resourceForm.thumbnail_url || ''}
                      onChange={(e) => setResourceForm({ ...resourceForm, thumbnail_url: e.target.value })}
                      className="flex-1 px-3 py-2 bg-white text-xs border border-slate-200 rounded-xl"
                    />
                    <button
                      type="button"
                      onClick={() => thumbnailInputRef.current?.click()}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                    >
                      Browse
                    </button>
                  </div>
                </div>

                {resourceForm.content_type === 'video' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Video Duration (mm:ss)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 28:15"
                      value={resourceForm.video_duration || ''}
                      onChange={(e) => setResourceForm({ ...resourceForm, video_duration: e.target.value })}
                      className="w-full px-3 py-2 bg-white text-xs border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Instructor / Curator Info */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Instructor & Attribution
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Instructor Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Daw Eleanor Pena"
                      value={resourceForm.instructor_name || ''}
                      onChange={(e) => setResourceForm({ ...resourceForm, instructor_name: e.target.value })}
                      className="w-full px-3 py-2 bg-white text-xs border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Instructor Title / Role
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Corporate Language Specialist"
                      value={resourceForm.instructor_title || ''}
                      onChange={(e) => setResourceForm({ ...resourceForm, instructor_title: e.target.value })}
                      className="w-full px-3 py-2 bg-white text-xs border border-slate-200 rounded-xl"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Instructor Avatar URL
                    </label>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Avatar image URL"
                        value={resourceForm.instructor_avatar || ''}
                        onChange={(e) => setResourceForm({ ...resourceForm, instructor_avatar: e.target.value })}
                        className="flex-1 px-3 py-2 bg-white text-xs border border-slate-200 rounded-xl"
                      />
                      <button
                        type="button"
                        onClick={() => avatarInputRef.current?.click()}
                        className="px-2.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        Upload
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Display Order
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={resourceForm.display_order}
                      onChange={(e) => setResourceForm({ ...resourceForm, display_order: parseInt(e.target.value) || 1 })}
                      className="w-full px-3 py-2 bg-white text-xs border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Published Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#F3F8FB] border border-[#176B98]/20">
                <div>
                  <span className="block text-xs font-bold text-slate-800">
                    Publish to Learner Workspace
                  </span>
                  <span className="block text-[11px] text-slate-500">
                    When enabled, this resource is instantly visible to approved employees
                  </span>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={resourceForm.is_published}
                    onChange={(e) => setResourceForm({ ...resourceForm, is_published: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#176B98]"></div>
                </label>
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsResourceModalOpen(false)}
                  disabled={isSubmitting || isUploading}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isUploading}
                  className="px-5 py-2.5 rounded-xl bg-[#176B98] hover:bg-[#12567a] text-white text-xs font-bold transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : resourceForm.id ? 'Save Updates' : 'Publish Resource'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          5. DELETE CONFIRMATION MODALS
          ========================================================================= */}
      {/* Delete Resource */}
      {deleteResourceConfirmId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          onClick={() => setDeleteResourceConfirmId(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 text-left shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Delete Skill Resource?
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                This will permanently remove the learning material from Supabase storage and employee portals. This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteResourceConfirmId(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteResource}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Delete Resource
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Category */}
      {deleteCategoryConfirmId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          onClick={() => setDeleteCategoryConfirmId(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 text-left shadow-2xl border border-slate-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Delete Category?
              </h3>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Deleting this category will remove it from learner navigation. Any classes currently assigned to it will remain in the catalog under general categorization.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteCategoryConfirmId(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCategory}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Delete Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          6. ADMIN PREVIEW MODALS (WATERMARK & DOWNLOAD PROTECTION)
          ========================================================================= */}
      {/* Video Preview */}
      {previewVideoResource && (
        <SkillVideoPlayerModal
          resource={previewVideoResource}
          onClose={() => setPreviewVideoResource(null)}
        />
      )}

      {/* PDF Preview */}
      {previewPdfResource && (
        <PdfViewerModal
          isOpen={true}
          onClose={() => setPreviewPdfResource(null)}
          fileUrl={previewPdfResource.file_url || previewPdfResource.content_url || ''}
          title={previewPdfResource.title}
          subtitle={`${previewPdfResource.category || previewPdfResource.topic || 'Skill Development'} · PDF Handbook`}
          fileName={previewPdfResource.file_name}
          watermarkContextLabel="KBZLIFE SKILL DEVELOPMENT"
        />
      )}

      {/* External Link Preview */}
      {previewLinkResource && (
        <ExternalLinkModal
          resource={previewLinkResource}
          onClose={() => setPreviewLinkResource(null)}
        />
      )}
    </div>
  );
};
