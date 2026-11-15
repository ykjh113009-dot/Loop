// Subjects, days and formats used by the tutor application and the Tutors Directory.
export const TUTOR_SUBJECTS = [
  "SAT", "AP Chemistry", "AP Biology", "AP Physics", "AP Calculus",
  "Math", "Physics", "Chemistry", "Biology", "Arabic", "English", "French", "History", "Geography", "Technology",
];
export const DAYS = [
  { id: "sun", label: "Sun" }, { id: "mon", label: "Mon" }, { id: "tue", label: "Tue" }, { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" }, { id: "fri", label: "Fri" }, { id: "sat", label: "Sat" },
] as const;
export const FORMATS = [
  { id: "online", label: "Online" }, { id: "in_person", label: "In person" }, { id: "both", label: "Both" },
] as const;
export const DOC_KINDS = [
  { id: "cv", label: "CV" }, { id: "certificate", label: "Certificate" }, { id: "academic", label: "Academic record" }, { id: "other", label: "Other" },
] as const;
export const DOC_TYPES: Record<string, string> = {
  "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};
export const MAX_DOC_MB = 8;
export const formatLabel = (id: string) => FORMATS.find((f) => f.id === id)?.label ?? id;
