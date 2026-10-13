export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
}

export interface Organization {
  _id: string;
  name: string;
  description: string;
  owner: string;
  members: { user: User; role: "OWNER" | "ADMIN" | "MEMBER" }[];
  createdAt?: string;
}

export interface Project {
  _id: string;
  name: string;
  description: string;
  status: string;
  priority: string;
  dueDate?: string;
  owner: User | string;
  members: User[];
  managers?: string[];
  organization: string | { _id: string };
  taskCount?: number;
  progress?: number;
}

export interface Task {
  _id: string;
  title: string;
  description: string;
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "COMPLETED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  dueDate?: string;
  labels: string[];
  assignee: User | null;
  reporter: User;
  project: string;
  updatedAt: string;
}

export interface Comment {
  _id: string;
  text: string;
  author: User;
  createdAt: string;
}

export interface Activity {
  _id: string;
  action: string;
  detail: string;
  createdAt: string;
  actor: User | null;
  project?: { _id: string; name: string } | null;
  task?: { _id: string; title: string } | null;
}

export interface Dashboard {
  projectCount: number;
  activeProjects: number;
  completedProjects: number;
  taskCount: number;
  assignedTasks: number;
  overdueTasks: number;
  tasksByStatus: Record<string, number>;
  tasksByPriority: Record<string, number>;
  recentActivity: Activity[];
}
