import { pgTable, text, serial, integer, boolean, json, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Robot schema
export const robots = pgTable("robots", {
  id: serial("id").primaryKey(),
  robotId: text("robot_id").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").default("offline").notNull(),
  batteryLevel: integer("battery_level"),
  lastSeen: timestamp("last_seen").defaultNow(),
  floor: text("floor"),
  error: text("error"),
  errorDetails: json("error_details").$type<ErrorDetails>(),
  metadata: json("metadata").$type<RobotMetadata>(),
});

// Points of Interest schema
export const pois = pgTable("pois", {
  id: serial("id").primaryKey(),
  poiId: text("poi_id").notNull().unique(),
  name: text("name").notNull(),
  x: integer("x").notNull(),
  y: integer("y").notNull(),
  yaw: integer("yaw"),
  areaId: text("area_id").notNull(),
  type: text("type").notNull(), // regular, charging, shelf, etc.
  floor: text("floor"),
  metadata: json("metadata").$type<PoiMetadata>(),
});

// Tasks schema
export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  taskId: text("task_id").notNull().unique(),
  name: text("name").notNull(),
  robotId: text("robot_id").notNull().references(() => robots.robotId),
  status: text("status").default("pending").notNull(),
  priority: text("priority").default("normal").notNull(),
  taskType: text("task_type").notNull(),
  runMode: integer("run_mode"),
  runNum: integer("run_num").default(1),
  runType: integer("run_type"),
  routeMode: integer("route_mode").default(1),
  ignorePublicSite: boolean("ignore_public_site").default(false),
  speed: integer("speed").default(-1),
  points: json("points").$type<TaskPoint[]>(),
  currentPoint: json("current_point").$type<TaskPoint | null>(),
  returnPoint: json("return_point").$type<TaskPoint | null>(),
  createdAt: timestamp("created_at").defaultNow(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  errorDetails: json("error_details").$type<ErrorDetails | null>(),
});

// Error log schema
export const errorLogs = pgTable("error_logs", {
  id: serial("id").primaryKey(),
  robotId: text("robot_id").references(() => robots.robotId),
  taskId: text("task_id").references(() => tasks.taskId),
  errorCode: integer("error_code").notNull(),
  errorMessage: text("error_message").notNull(),
  errorType: integer("error_type"), // 0=chassis, 1=route, 2=service
  errorLevel: integer("error_level"), // 0=error, 1=warning
  priority: boolean("priority").default(false),
  timestamp: timestamp("timestamp").defaultNow(),
  resolved: boolean("resolved").default(false),
  resolvedAt: timestamp("resolved_at"),
});

// Maps schema
export const maps = pgTable("maps", {
  id: serial("id").primaryKey(),
  areaId: text("area_id").notNull().unique(),
  name: text("name").notNull(),
  floor: text("floor").notNull(),
  building: text("building"),
  isActive: boolean("is_active").default(true),
});

// Robot SDK credentials
export const sdkCredentials = pgTable("sdk_credentials", {
  id: serial("id").primaryKey(),
  appId: text("app_id").notNull(),
  appSecret: text("app_secret").notNull(),
  mode: text("mode").default("WAN_APP").notNull(),
  isActive: boolean("is_active").default(true),
});

// Types for complex JSON fields
export type RobotMetadata = {
  connectionConfig?: {
    publicIp: string;
    localIp: string;
    port: number;
    useSsl: boolean;
    wsPort: number;
  };
  capabilities?: string[];
  manufacturer?: string;
  model?: string;
  softwareVersion?: string;
  hardwareVersion?: string;
};

export type TaskPoint = {
  x: number;
  y: number;
  yaw: number;
  stopRadius?: number;
  areaId: string;
  type?: number;
  ext?: {
    id?: string;
    name?: string;
  };
  stepActs?: StepAction[];
};

export type StepAction = {
  type: string | number;
  doorIds?: number[];
  duration?: number;
  data?: Record<string, any>;
};

export type ErrorDetails = {
  code: number;
  message: string;
  type?: number;
  level?: number;
  priority?: boolean;
};

export type PoiMetadata = {
  stopRadius?: number;
  dockingRadius?: number;
  doorIds?: number[];
};

// Create insert schemas
export const insertRobotSchema = createInsertSchema(robots).omit({ id: true });
export const insertPoiSchema = createInsertSchema(pois).omit({ id: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true, startedAt: true, completedAt: true });
export const insertErrorLogSchema = createInsertSchema(errorLogs).omit({ id: true, timestamp: true, resolvedAt: true });
export const insertMapSchema = createInsertSchema(maps).omit({ id: true });
export const insertSdkCredentialsSchema = createInsertSchema(sdkCredentials).omit({ id: true });

// Create types for inserts
export type InsertRobot = z.infer<typeof insertRobotSchema>;
export type InsertPoi = z.infer<typeof insertPoiSchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertErrorLog = z.infer<typeof insertErrorLogSchema>;
export type InsertMap = z.infer<typeof insertMapSchema>;
export type InsertSdkCredentials = z.infer<typeof insertSdkCredentialsSchema>;

// Create types for selects
export type Robot = typeof robots.$inferSelect;
export type Poi = typeof pois.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type ErrorLog = typeof errorLogs.$inferSelect;
export type Map = typeof maps.$inferSelect;
export type SdkCredentials = typeof sdkCredentials.$inferSelect;

// Task Status Enum
export const TaskStatus = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  PAUSED: "paused",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

// Robot Status Enum
export const RobotStatus = {
  ONLINE: "online",
  OFFLINE: "offline",
  ERROR: "error",
  WARNING: "warning",
  CHARGING: "charging",
  BUSY: "busy",
} as const;

// Task Type Enum
export const TaskType = {
  DROPOFF: "dropoff",
  PICKUP: "pickup",
  CHARGING: "charging",
  RACK: "rack_operation",
  MULTI_FLOOR: "multi_floor",
  PATROL: "patrol",
  CUSTOM: "custom",
} as const;

// Priority Enum
export const Priority = {
  LOW: "low",
  NORMAL: "normal",
  HIGH: "high",
  URGENT: "urgent",
} as const;

// Task Request Schema
export const taskRequestSchema = z.object({
  name: z.string().min(1, "Task name is required"),
  robotId: z.string().min(1, "Robot ID is required"),
  taskType: z.string().min(1, "Task type is required"),
  priority: z.string().default("normal"),
  points: z.array(z.any()).min(1, "At least one point is required"),
  currentPoint: z.any().optional(),
  returnPoint: z.any().optional(),
  runMode: z.number().optional(),
  runNum: z.number().optional(),
  runType: z.number().optional(),
  routeMode: z.number().optional(),
  speed: z.number().optional(),
  ignorePublicSite: z.boolean().optional(),
});

export type TaskRequest = z.infer<typeof taskRequestSchema>;

// Users table (required for the base template)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
