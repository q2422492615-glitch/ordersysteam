-- ============================================
-- 智能看板 - Supabase 数据库初始化 SQL
-- 在 Supabase 项目的 SQL Editor 中运行此文件
-- ============================================

-- 用户表：存储登录账户
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 应用数据表：以 JSON 格式存储所有业务数据（包厢、菜品、预订、分类）
CREATE TABLE IF NOT EXISTS app_data (
  id int PRIMARY KEY CHECK (id = 1),
  data jsonb,
  updated_at timestamptz DEFAULT now()
);

-- 默认管理员账户（用户名: admin，密码: admin123）
-- 如需修改密码，直接改下方的 'admin123' 即可
INSERT INTO users (username, password)
VALUES ('hyxy', 'hyxy123')
ON CONFLICT (username) DO NOTHING;
