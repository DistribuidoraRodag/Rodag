-- ============================================
-- 006: EG OS v3 Improvements
-- New columns for ICP, funnel, hook, captions
-- Notification improvements
-- ============================================

-- Add new columns to content table
ALTER TABLE content ADD COLUMN IF NOT EXISTS hook text;
ALTER TABLE content ADD COLUMN IF NOT EXISTS icp_target text;
ALTER TABLE content ADD COLUMN IF NOT EXISTS funnel_stage text DEFAULT 'awareness'
  CHECK (funnel_stage IN ('awareness', 'interest', 'consideration', 'conversion', 'retention'));
ALTER TABLE content ADD COLUMN IF NOT EXISTS caption_short text;
ALTER TABLE content ADD COLUMN IF NOT EXISTS caption_long text;

-- Add read status to notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- Index for funnel stage queries
CREATE INDEX IF NOT EXISTS idx_content_funnel ON content(funnel_stage);
CREATE INDEX IF NOT EXISTS idx_content_icp ON content(icp_target);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;
