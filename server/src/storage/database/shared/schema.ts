import { pgTable, serial, timestamp, varchar, integer, jsonb, text, index } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"


export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

// 配料分析历史表
export const scanHistory = pgTable(
  "scan_history",
  {
    id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
    image_key: varchar("image_key", { length: 255 }).notNull(),  // 对象存储 key
    image_url: text("image_url").notNull(),  // 图片公网 URL
    product_name: varchar("product_name", { length: 255 }),  // 产品名称（可选）
    // 配料内容 hash（用于缓存相同配料内容的分析结果）
    content_hash: varchar("content_hash", { length: 64 }),
    // 人群身份（adult/pregnant/child），不同人群健康标准不同
    identity: varchar("identity", { length: 20 }).notNull().default('adult'),
    // 内容+身份组合 hash（用于缓存，因为不同人群分析结果不同）
    content_identity_hash: varchar("content_identity_hash", { length: 64 }),
    health_score: integer("health_score").notNull(),  // 健康评分 0-100
    recommendation: varchar("recommendation", { length: 50 }).notNull(),  // recommend/caution/avoid
    ingredients: jsonb("ingredients").notNull(),  // 配料列表 JSON
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    // image_key 用于缓存查询，必须建索引
    index("scan_history_image_key_idx").on(table.image_key),
    // created_at 用于历史记录排序
    index("scan_history_created_at_idx").on(table.created_at),
    // 配料内容 hash 索引（用于快速查询相同配料内容）
    index("scan_history_content_hash_idx").on(table.content_hash),
    // 内容+身份组合 hash 索引（主要缓存查询索引）
    index("scan_history_content_identity_hash_idx").on(table.content_identity_hash),
  ]
);