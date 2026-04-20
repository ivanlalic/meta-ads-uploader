import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  meta_user_id: text("meta_user_id"),
  meta_user_name: text("meta_user_name"),
  access_token: text("access_token").notNull(),
  token_expires_at: timestamp("token_expires_at"),
  ad_account_id: text("ad_account_id").notNull(),
  ad_account_name: text("ad_account_name"),
  currency: text("currency"),
  status: text("status").default("active"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const account_defaults = pgTable("account_defaults", {
  id: uuid("id").defaultRandom().primaryKey(),
  account_id: uuid("account_id")
    .references(() => accounts.id)
    .notNull(),
  facebook_page_id: text("facebook_page_id"),
  facebook_page_name: text("facebook_page_name"),
  instagram_account_id: text("instagram_account_id"),
  pixel_id: text("pixel_id"),
  pixel_name: text("pixel_name"),
  default_cta: text("default_cta").default("SHOP_NOW"),
  default_description: text("default_description"),
  default_url: text("default_url"),
  advantage_plus_config: jsonb("advantage_plus_config"),
  created_at: timestamp("created_at").defaultNow(),
  updated_at: timestamp("updated_at").defaultNow(),
});

export const upload_history = pgTable("upload_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  account_id: uuid("account_id")
    .references(() => accounts.id)
    .notNull(),
  action: text("action").notNull(),
  campaign_id: text("campaign_id"),
  campaign_name: text("campaign_name"),
  adset_id: text("adset_id"),
  adset_name: text("adset_name"),
  ad_id: text("ad_id"),
  ad_name: text("ad_name"),
  creative_type: text("creative_type"),
  initial_status: text("initial_status"),
  result: text("result").notNull(),
  error_message: text("error_message"),
  created_at: timestamp("created_at").defaultNow(),
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type AccountDefaults = typeof account_defaults.$inferSelect;
export type UploadHistory = typeof upload_history.$inferSelect;
