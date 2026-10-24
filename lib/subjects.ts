// School subjects used by tutoring, study buddies and the Tawjihi corner.
export const SUBJECTS = [
  "Math",
  "Physics",
  "Chemistry",
  "Biology",
  "Arabic",
  "English",
  "French",
  "Islamic Education",
  "Christian Education",
  "History",
  "Geography",
  "Technology",
  "Other",
];

export const TAWJIHI_TOPICS = [...SUBJECTS.filter((s) => s !== "Other"), "Study tips", "University", "Other"];
