// Demo accounts created by supabase/seed.sql, shown on the login page when
// DEMO_MODE=true. They do not exist in the real school database.
export const DEMO_ACCOUNTS = [
  { email: "demo.rania@pioneers.edu.ps", name: "Rania Haddad", label: "Admin · Grade 12", avatar: "a07" },
  { email: "demo.omar@pioneers.edu.ps", name: "Omar Khalil", label: "Moderator · Grade 11", avatar: "a03" },
  { email: "demo.layla@pioneers.edu.ps", name: "Layla Nasser", label: "Student · Robotics leader", avatar: "a05" },
  { email: "demo.yousef@pioneers.edu.ps", name: "Yousef Saleh", label: "Student · Football captain", avatar: "a02" },
  { email: "demo.maya@pioneers.edu.ps", name: "Maya Odeh", label: "Student · New in grade 9", avatar: "a09" },
];

export const isDemoMode = () => process.env.DEMO_MODE === "true";
