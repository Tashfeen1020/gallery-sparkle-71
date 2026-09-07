export type Lang = "en" | "bn" | "ar";

export const CATEGORIES = [
  "Cars",
  "Planes",
  "Nature",
  "People",
  "Animals",
  "Food",
  "Architecture",
  "Tech",
  "Sports",
  "Travel",
  "Art",
  "Other",
] as const;

/** Categories are dynamic: the AI may return a label outside the list above. */
export type Category = string;

export function categoryLabel(lang: Lang, c: string): string {
  return dictionaries[lang].categoryNames[c] ?? c;
}

export const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "bn", label: "বাংলা" },
  { code: "ar", label: "العربية" },
];

export type Dict = {
  title: string;
  tagline: string;
  uploaderName: string;
  namePlaceholder: string;
  photo: string;
  secretPin: string;
  upload: string;
  uploading: string;
  searchPlaceholder: string;
  favouritesOnly: string;
  loading: string;
  noMatch: string;
  empty: string;
  toggleFavourite: string;
  savePhoto: string;
  deletePhoto: string;
  altPhoto: (n: string) => string;
  pinPrompt: string;
  pinFourDigits: string;
  chooseFile: string;
  onlyImages: string;
  uploaded: string;
  uploadFailed: (m: string) => string;
  deleteFailed: (m: string) => string;
  wrongPin: string;
  deleted: string;
  cleanupFailed: (m: string) => string;
  saved: string;
  saveFailed: (m: string) => string;
  loadFailed: (m: string) => string;
  theme: string;
  language: string;
  viewPhoto: string;
  close: string;
  allCategories: string;
  compressing: string;
  analyzing: string;
  uploadedBy: string;
  orientation: string;
  landscape: string;
  portrait: string;
  photosCount: string;
  description: string;
  descriptionPlaceholder: string;
  noDescription: string;
  rating: string;
  rateStars: (n: number) => string;
  ratingSaved: string;
  ratingFailed: (m: string) => string;
  noRatings: string;
  thanksTitle: string;
  thanksBody: string;
  categoryNames: Record<string, string>;
};

export const dictionaries: Record<Lang, Dict> = {
  en: {
    title: "Pixel Vault",
    tagline:
      "Upload a photo with your name and a 4-digit PIN. Anyone can view — only the PIN can delete.",
    uploaderName: "Uploader name",
    namePlaceholder: "Jane Doe",
    photo: "Photo",
    secretPin: "Secret PIN",
    upload: "Upload photo",
    uploading: "Uploading…",
    searchPlaceholder: "Search by uploader or file name…",
    favouritesOnly: "Favourites only",
    loading: "Loading gallery…",
    noMatch: "No photos match your filters.",
    empty: "No photos yet — be the first!",
    toggleFavourite: "Toggle favourite",
    savePhoto: "Save photo",
    deletePhoto: "Delete photo",
    altPhoto: (n) => `Photo uploaded by ${n}`,
    pinPrompt: "Enter the 4-digit PIN used to upload this photo:",
    pinFourDigits: "PIN must be exactly 4 digits.",
    chooseFile: "Please choose an image file.",
    onlyImages: "Only image files are allowed.",
    uploaded: "Photo uploaded!",
    uploadFailed: (m) => `Upload failed: ${m}`,
    deleteFailed: (m) => `Delete failed: ${m}`,
    wrongPin: "Wrong PIN — delete cancelled.",
    deleted: "Photo deleted.",
    cleanupFailed: (m) => `Removed from gallery, file cleanup failed: ${m}`,
    saved: "Photo saved to your device.",
    saveFailed: (m) => `Save failed: ${m}`,
    loadFailed: (m) => `Could not load gallery: ${m}`,
    theme: "Toggle theme",
    language: "Language",
    viewPhoto: "View photo",
    close: "Close",
    allCategories: "All",
    compressing: "Compressing image…",
    analyzing: "AI is analysing…",
    uploadedBy: "Uploaded by",
    orientation: "Orientation",
    landscape: "Landscape",
    portrait: "Portrait",
    photosCount: "photos",
    thanksTitle: "Thanks for downloading!",
    thanksBody: "Your photo is saved to your device. Enjoy!",
    description: "Description",
    descriptionPlaceholder: "Say something about this photo…",
    noDescription: "No description",
    rating: "Rating",
    rateStars: (n) => `Rate ${n} star${n > 1 ? "s" : ""}`,
    ratingSaved: "Thanks for rating!",
    ratingFailed: (m) => `Rating failed: ${m}`,
    noRatings: "Not rated yet",
    categoryNames: {
      Cars: "Cars",
      Planes: "Planes",
      Tech: "Tech",
      Sports: "Sports",
      Travel: "Travel",
      Nature: "Nature",
      People: "People",
      Animals: "Animals",
      Food: "Food",
      Architecture: "Architecture",
      Art: "Art",
      Other: "Other",
    },
  },
  bn: {
    title: "পিক্সেল ভল্ট",
    tagline:
      "আপনার নাম ও ৪ সংখ্যার পিন দিয়ে ছবি আপলোড করুন। সবাই দেখতে পারবে — শুধু পিন দিয়েই মুছে ফেলা যাবে।",
    uploaderName: "আপলোডারের নাম",
    namePlaceholder: "রহিম উদ্দিন",
    photo: "ছবি",
    secretPin: "গোপন পিন",
    upload: "ছবি আপলোড করুন",
    uploading: "আপলোড হচ্ছে…",
    searchPlaceholder: "নাম বা ফাইলের নাম দিয়ে খুঁজুন…",
    favouritesOnly: "শুধু প্রিয়",
    loading: "গ্যালারি লোড হচ্ছে…",
    noMatch: "আপনার ফিল্টারের সাথে কোনো ছবি মেলেনি।",
    empty: "এখনো কোনো ছবি নেই — আপনিই প্রথম হন!",
    toggleFavourite: "প্রিয় তালিকায় যোগ/বাদ",
    savePhoto: "ছবি সংরক্ষণ",
    deletePhoto: "ছবি মুছুন",
    altPhoto: (n) => `${n} এর আপলোড করা ছবি`,
    pinPrompt: "এই ছবিটি আপলোডের সময় ব্যবহৃত ৪ সংখ্যার পিন লিখুন:",
    pinFourDigits: "পিন অবশ্যই ৪ সংখ্যার হতে হবে।",
    chooseFile: "অনুগ্রহ করে একটি ছবি ফাইল নির্বাচন করুন।",
    onlyImages: "শুধুমাত্র ছবি ফাইল অনুমোদিত।",
    uploaded: "ছবি আপলোড হয়েছে!",
    uploadFailed: (m) => `আপলোড ব্যর্থ: ${m}`,
    deleteFailed: (m) => `মুছে ফেলা ব্যর্থ: ${m}`,
    wrongPin: "ভুল পিন — মুছে ফেলা বাতিল।",
    deleted: "ছবি মুছে ফেলা হয়েছে।",
    cleanupFailed: (m) => `গ্যালারি থেকে সরানো হয়েছে, ফাইল মুছতে ব্যর্থ: ${m}`,
    saved: "ছবি আপনার ডিভাইসে সংরক্ষিত হয়েছে।",
    saveFailed: (m) => `সংরক্ষণ ব্যর্থ: ${m}`,
    loadFailed: (m) => `গ্যালারি লোড করা যায়নি: ${m}`,
    theme: "থিম পরিবর্তন",
    language: "ভাষা",
    viewPhoto: "ছবি দেখুন",
    close: "বন্ধ করুন",
    allCategories: "সব",
    compressing: "ছবি সংকুচিত হচ্ছে…",
    analyzing: "এআই বিশ্লেষণ করছে…",
    uploadedBy: "আপলোড করেছেন",
    orientation: "অভিমুখ",
    landscape: "ল্যান্ডস্কেপ",
    portrait: "পোর্ট্রেট",
    photosCount: "ছবি",
    thanksTitle: "ডাউনলোডের জন্য ধন্যবাদ!",
    thanksBody: "ছবিটি আপনার ডিভাইসে সংরক্ষিত হয়েছে। উপভোগ করুন!",
    description: "বিবরণ",
    descriptionPlaceholder: "ছবিটি সম্পর্কে কিছু লিখুন…",
    noDescription: "কোনো বিবরণ নেই",
    rating: "রেটিং",
    rateStars: (n) => `${n} স্টার দিন`,
    ratingSaved: "রেটিং দেওয়ার জন্য ধন্যবাদ!",
    ratingFailed: (m) => `রেটিং ব্যর্থ: ${m}`,
    noRatings: "এখনো রেটিং হয়নি",
    categoryNames: {
      Cars: "গাড়ি",
      Planes: "উড়োজাহাজ",
      Tech: "প্রযুক্তি",
      Sports: "খেলাধুলা",
      Travel: "ভ্রমণ",
      Nature: "প্রকৃতি",
      People: "মানুষ",
      Animals: "প্রাণী",
      Food: "খাবার",
      Architecture: "স্থাপত্য",
      Art: "শিল্প",
      Other: "অন্যান্য",
    },
  },
  ar: {
    title: "خزنة البكسل",
    tagline:
      "ارفع صورة باسمك ورمز PIN من أربعة أرقام. يمكن للجميع المشاهدة — والحذف بالرمز فقط.",
    uploaderName: "اسم الرافع",
    namePlaceholder: "محمد أحمد",
    photo: "الصورة",
    secretPin: "الرمز السري",
    upload: "رفع الصورة",
    uploading: "جارٍ الرفع…",
    searchPlaceholder: "ابحث بالاسم أو اسم الملف…",
    favouritesOnly: "المفضلة فقط",
    loading: "جارٍ تحميل المعرض…",
    noMatch: "لا توجد صور مطابقة للتصفية.",
    empty: "لا توجد صور بعد — كن الأول!",
    toggleFavourite: "تبديل المفضلة",
    savePhoto: "حفظ الصورة",
    deletePhoto: "حذف الصورة",
    altPhoto: (n) => `صورة رفعها ${n}`,
    pinPrompt: "أدخل الرمز المكوّن من 4 أرقام المستخدم عند رفع الصورة:",
    pinFourDigits: "يجب أن يتكون الرمز من 4 أرقام.",
    chooseFile: "الرجاء اختيار ملف صورة.",
    onlyImages: "ملفات الصور فقط مسموح بها.",
    uploaded: "تم رفع الصورة!",
    uploadFailed: (m) => `فشل الرفع: ${m}`,
    deleteFailed: (m) => `فشل الحذف: ${m}`,
    wrongPin: "رمز خاطئ — تم إلغاء الحذف.",
    deleted: "تم حذف الصورة.",
    cleanupFailed: (m) => `تمت الإزالة من المعرض، وفشل حذف الملف: ${m}`,
    saved: "تم حفظ الصورة على جهازك.",
    saveFailed: (m) => `فشل الحفظ: ${m}`,
    loadFailed: (m) => `تعذّر تحميل المعرض: ${m}`,
    theme: "تبديل السمة",
    language: "اللغة",
    viewPhoto: "عرض الصورة",
    close: "إغلاق",
    allCategories: "الكل",
    compressing: "جارٍ ضغط الصورة…",
    analyzing: "تحليل الذكاء الاصطناعي…",
    uploadedBy: "رفعها",
    orientation: "الاتجاه",
    landscape: "أفقي",
    portrait: "عمودي",
    photosCount: "صور",
    thanksTitle: "شكرًا للتنزيل!",
    thanksBody: "تم حفظ الصورة على جهازك. استمتع!",
    description: "الوصف",
    descriptionPlaceholder: "اكتب شيئًا عن هذه الصورة…",
    noDescription: "لا يوجد وصف",
    rating: "التقييم",
    rateStars: (n) => `قيّم بـ ${n} نجوم`,
    ratingSaved: "شكرًا على التقييم!",
    ratingFailed: (m) => `فشل التقييم: ${m}`,
    noRatings: "لم يُقيَّم بعد",
    categoryNames: {
      Cars: "سيارات",
      Planes: "طائرات",
      Tech: "تقنية",
      Sports: "رياضة",
      Travel: "سفر",
      Nature: "طبيعة",
      People: "أشخاص",
      Animals: "حيوانات",
      Food: "طعام",
      Architecture: "عمارة",
      Art: "فن",
      Other: "أخرى",
    },
  },
};
