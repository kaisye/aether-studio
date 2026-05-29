"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Language = "en" | "vi";

const dictionaries = {
  en: {
    languageLabel: "English",
    nav: {
      dashboard: "Dashboard",
      queueVideo: "Queue Video",
      projects: "Projects",
      assets: "Assets",
      voices: "Voices",
      settings: "Settings",
      docs: "Docs",
      support: "Support",
      newProject: "New Project",
      publish: "Publish",
      timeline: "Timeline",
      review: "Review",
      collaborate: "Collaborate",
      export: "Export",
    },
    search: {
      workspace: "Search workspace...",
      queue: "Search queue...",
      projects: "Search projects...",
      assets: "Search assets...",
      voices: "Search voices...",
      settings: "Search settings...",
      reviewNotes: "Search review notes...",
      projectsOrAssets: "Search projects or assets...",
    },
    common: {
      loading: "Loading",
      filter: "Filter",
      sort: "Sort",
      view: "View",
      grid: "Grid",
      list: "List",
      cancel: "Cancel",
      edit: "Edit",
      progress: "Progress",
      platform: "Platform",
      voice: "Voice",
      language: "Language",
      publish: "Publish",
      unscheduled: "Unscheduled",
    },
    dashboard: {
      title: "Good morning, User",
      description: "Track every localization run, review task, schedule, and published asset from one operating view.",
      viewAnalytics: "View Analytics",
      quickRun: "Quick Run",
      totalVideos: "Total Videos",
      processing: "Processing",
      scheduledPosts: "Scheduled Posts",
      published: "Published",
      storageUsage: "Storage Usage",
      updatedFromQueue: "Updated from live queue data",
      pinnedProjects: "Pinned Projects",
      viewAll: "View All",
      recentJobs: "Recent Processing Jobs",
      recentActivity: "Recent Activity",
    },
    queue: {
      title: "Content Queue",
      description: "Manage localization jobs, schedules, voices, and publishing status.",
      newRows: "New Rows",
      bulkImport: "Bulk Import",
      schedule: "Schedule",
      runSelected: "Run Selected",
      deleteRows: "Delete Rows",
      deleteRowsConfirm: "Delete selected rows?",
      pasteUrls: "Paste video URLs",
      pasteDescription: "Paste URLs from a spreadsheet, one per line or separated by tabs.",
      addToQueue: "Add to Queue",
      loading: "Loading content queue",
    },
    projects: {
      title: "Projects",
      description: "Manage active localization projects, review status, language coverage, and render health.",
      queueVideos: "Queue Videos",
      storageInsights: "Storage Insights",
      queueStatus: "Queue Status",
      priorityLane: "Priority Lane",
      tasksRunning: "tasks waiting or running",
    },
    assets: {
      title: "Assets",
      description: "Browse source videos, generated audio, subtitles, thumbnails, and rendered media prepared by the studio.",
      uploadAsset: "Upload Asset",
      sourceVideos: "Source Videos",
      audioFiles: "Audio Files",
      subtitles: "Subtitles",
      renderedMedia: "Rendered Media",
      mediaLibrary: "Media Library",
      loading: "Loading assets",
    },
    voices: {
      title: "Voices",
      description: "Manage reusable voice profiles for localized versions, previews, and review-ready narration.",
      voiceFilters: "Voice Filters",
      newVoice: "New Voice",
      voiceStudio: "Voice Studio",
      cloneReady: "Clone-ready profile",
      cloneDescription: "Prepare approved reference audio and assign it to projects after review.",
      previewWorkflow: "Preview workflow",
      previewDescription: "Test tone, rate, and emotion before running localization.",
    },
    settings: {
      title: "Settings",
      description: "Configure workspace preferences, defaults, notifications, storage, and provider readiness.",
      workspaceDefaults: "Workspace Defaults",
      runtimeReady: "MVP Runtime Ready",
      runtimeDescription: "The current workspace uses SQLite for local development, mocked media adapters, and product-facing job states. Provider credentials can be added later without changing the user workflow.",
    },
    workspace: {
      loading: "Loading workspace",
      notFound: "Video not found.",
      breadcrumbProjects: "Projects",
      breadcrumbWorkspace: "Localization Workspace",
      ready: "Ready to prepare",
      destination: "Destination",
      steps: "steps",
      runLocalization: "Run Localization",
      openReview: "Open Video Review",
      inspector: "Inspector",
      outputResolution: "Output Resolution",
      format: "Format",
      bitrate: "Bitrate",
      qaChecklist: "QA Checklist",
      runtimeLogs: "Runtime Logs",
      refreshReview: "Refresh Review",
      approvePublishing: "Approve for Publishing",
    },
    studio: {
      loading: "Loading video studio",
      notFound: "Video not found.",
      inspector: "Inspector",
      targetLanguage: "Target Language",
      voiceSettings: "Voice Settings",
      pitch: "Pitch",
      speechRate: "Speech Rate",
      emotion: "Emotion",
      lipSyncReview: "Lip Sync Review",
      lipSyncDescription: "Review mouth movement, caption timing, and localized tone before approving the final render.",
      regeneratePreview: "Regenerate Preview",
      approveBake: "Approve & Bake",
      original: "Original",
      localized: "Localized",
      subtitles: "Subtitles",
    },
    status: {
      draft: "Draft",
      queued: "Queued",
      processing: "Processing",
      needs_review: "Needs Review",
      scheduled: "Scheduled",
      published: "Published",
      failed: "Failed",
    },
  },
  vi: {
    languageLabel: "Tiếng Việt",
    nav: {
      dashboard: "Tổng quan",
      queueVideo: "Hàng đợi video",
      projects: "Dự án",
      assets: "Tài nguyên",
      voices: "Giọng nói",
      settings: "Cài đặt",
      docs: "Tài liệu",
      support: "Hỗ trợ",
      newProject: "Dự án mới",
      publish: "Xuất bản",
      timeline: "Dòng thời gian",
      review: "Duyệt",
      collaborate: "Cộng tác",
      export: "Xuất file",
    },
    search: {
      workspace: "Tìm trong workspace...",
      queue: "Tìm trong hàng đợi...",
      projects: "Tìm dự án...",
      assets: "Tìm tài nguyên...",
      voices: "Tìm giọng nói...",
      settings: "Tìm cài đặt...",
      reviewNotes: "Tìm ghi chú duyệt...",
      projectsOrAssets: "Tìm dự án hoặc tài nguyên...",
    },
    common: {
      loading: "Đang tải",
      filter: "Bộ lọc",
      sort: "Sắp xếp",
      view: "Hiển thị",
      grid: "Lưới",
      list: "Danh sách",
      cancel: "Hủy",
      edit: "Sửa",
      progress: "Tiến độ",
      platform: "Nền tảng",
      voice: "Giọng",
      language: "Ngôn ngữ",
      publish: "Xuất bản",
      unscheduled: "Chưa lên lịch",
    },
    dashboard: {
      title: "Chào buổi sáng, User",
      description: "Theo dõi mọi lượt bản địa hóa, tác vụ duyệt, lịch đăng và tài sản đã xuất bản trong một màn hình vận hành.",
      viewAnalytics: "Xem phân tích",
      quickRun: "Chạy nhanh",
      totalVideos: "Tổng video",
      processing: "Đang xử lý",
      scheduledPosts: "Bài đã lên lịch",
      published: "Đã xuất bản",
      storageUsage: "Dung lượng",
      updatedFromQueue: "Cập nhật từ hàng đợi",
      pinnedProjects: "Dự án ghim",
      viewAll: "Xem tất cả",
      recentJobs: "Job xử lý gần đây",
      recentActivity: "Hoạt động gần đây",
    },
    queue: {
      title: "Hàng đợi nội dung",
      description: "Quản lý job bản địa hóa, lịch đăng, giọng nói và trạng thái xuất bản.",
      newRows: "Dòng mới",
      bulkImport: "Nhập hàng loạt",
      schedule: "Lên lịch",
      runSelected: "Chạy mục đã chọn",
      deleteRows: "Xóa rows",
      deleteRowsConfirm: "Xóa các rows đã chọn?",
      pasteUrls: "Dán URL video",
      pasteDescription: "Dán URL từ spreadsheet, mỗi dòng một URL hoặc phân tách bằng tab.",
      addToQueue: "Thêm vào hàng đợi",
      loading: "Đang tải hàng đợi",
    },
    projects: {
      title: "Dự án",
      description: "Quản lý dự án bản địa hóa đang chạy, trạng thái duyệt, phạm vi ngôn ngữ và sức khỏe render.",
      queueVideos: "Đưa video vào hàng đợi",
      storageInsights: "Thông tin dung lượng",
      queueStatus: "Trạng thái hàng đợi",
      priorityLane: "Luồng ưu tiên",
      tasksRunning: "tác vụ đang chờ hoặc đang chạy",
    },
    assets: {
      title: "Tài nguyên",
      description: "Duyệt video nguồn, audio đã tạo, phụ đề, thumbnail và media render bởi studio.",
      uploadAsset: "Tải tài nguyên",
      sourceVideos: "Video nguồn",
      audioFiles: "File audio",
      subtitles: "Phụ đề",
      renderedMedia: "Media đã render",
      mediaLibrary: "Thư viện media",
      loading: "Đang tải tài nguyên",
    },
    voices: {
      title: "Giọng nói",
      description: "Quản lý voice profile dùng lại cho bản địa hóa, preview và narration sẵn sàng duyệt.",
      voiceFilters: "Lọc giọng",
      newVoice: "Giọng mới",
      voiceStudio: "Voice Studio",
      cloneReady: "Profile sẵn sàng clone",
      cloneDescription: "Chuẩn bị audio tham chiếu đã duyệt và gán vào dự án sau khi kiểm tra.",
      previewWorkflow: "Quy trình preview",
      previewDescription: "Kiểm tra tone, tốc độ và cảm xúc trước khi chạy bản địa hóa.",
    },
    settings: {
      title: "Cài đặt",
      description: "Cấu hình workspace, mặc định, thông báo, lưu trữ và trạng thái provider.",
      workspaceDefaults: "Mặc định workspace",
      runtimeReady: "MVP đã sẵn sàng chạy",
      runtimeDescription: "Workspace hiện dùng SQLite cho local development, adapter media giả lập và trạng thái job hướng sản phẩm. Có thể thêm credential provider sau mà không đổi workflow người dùng.",
    },
    workspace: {
      loading: "Đang tải workspace",
      notFound: "Không tìm thấy video.",
      breadcrumbProjects: "Dự án",
      breadcrumbWorkspace: "Workspace bản địa hóa",
      ready: "Sẵn sàng chuẩn bị",
      destination: "Đích xuất bản",
      steps: "bước",
      runLocalization: "Chạy bản địa hóa",
      openReview: "Mở màn duyệt video",
      inspector: "Bảng kiểm tra",
      outputResolution: "Độ phân giải xuất",
      format: "Định dạng",
      bitrate: "Bitrate",
      qaChecklist: "Checklist QA",
      runtimeLogs: "Log xử lý",
      refreshReview: "Làm mới duyệt",
      approvePublishing: "Duyệt để xuất bản",
    },
    studio: {
      loading: "Đang tải video studio",
      notFound: "Không tìm thấy video.",
      inspector: "Bảng kiểm tra",
      targetLanguage: "Ngôn ngữ đích",
      voiceSettings: "Cài đặt giọng",
      pitch: "Cao độ",
      speechRate: "Tốc độ nói",
      emotion: "Cảm xúc",
      lipSyncReview: "Duyệt lip-sync",
      lipSyncDescription: "Kiểm tra khẩu hình, thời gian phụ đề và sắc thái bản địa hóa trước khi duyệt render cuối.",
      regeneratePreview: "Tạo lại preview",
      approveBake: "Duyệt & hoàn tất",
      original: "Gốc",
      localized: "Bản địa hóa",
      subtitles: "Phụ đề",
    },
    status: {
      draft: "Nháp",
      queued: "Đang chờ",
      processing: "Đang xử lý",
      needs_review: "Cần duyệt",
      scheduled: "Đã lên lịch",
      published: "Đã xuất bản",
      failed: "Lỗi",
    },
  },
} as const;

type Dictionary = (typeof dictionaries)[Language];

const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
  toggleLanguage: () => void;
  t: Dictionary;
} | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem("aether-language");
    if (stored === "en" || stored === "vi") {
      setLanguageState(stored);
    }
  }, []);

  const setLanguage = (next: Language) => {
    setLanguageState(next);
    window.localStorage.setItem("aether-language", next);
  };

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      toggleLanguage: () => setLanguage(language === "en" ? "vi" : "en"),
      t: dictionaries[language],
    }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider");
  }
  return context;
}
