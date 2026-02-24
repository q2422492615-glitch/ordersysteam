-- ============================================
-- 智能看板 - 关系型数据库结构 (Relational Schema)
-- 替换旧版本 app_data 单体 JSON 的方案
-- ============================================

-- 1. 用户表：存储登录账户 (From init.sql)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 2. 包厢表 (Rooms)
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  capacity int NOT NULL DEFAULT 10,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. 菜品分类表 (Categories)
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3. 菜品库 (Dishes)
CREATE TABLE IF NOT EXISTS dishes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric(10, 2) NOT NULL DEFAULT 0,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL, -- 关联分类表，可空以便兼容分类删除
  category_name text NOT NULL, -- 冗余字段方便直接读取
  tags text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. 预订表 (Reservations)
CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid REFERENCES rooms(id) ON DELETE RESTRICT,
  customer_name text NOT NULL,
  phone text,
  pax int NOT NULL DEFAULT 2,
  standard_price numeric(10, 2) NOT NULL DEFAULT 0,
  total_price numeric(10, 2) NOT NULL DEFAULT 0,
  period text NOT NULL CHECK (period IN ('lunch', 'dinner')),
  reservation_date date NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'checked-in', 'cancelled')),
  menu jsonb DEFAULT '[]', -- 菜单作为当时快照保存
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS (Row Level Security) 策略设置
-- 为了快速兼容前端的简单认证，目前均允许匿名全量的增删改查
-- 后续可以根据 Supabase auth.uid() 限制

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE dishes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on rooms" ON rooms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on categories" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on dishes" ON dishes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on reservations" ON reservations FOR ALL USING (true) WITH CHECK (true);

-- 插入默认管理员账户
INSERT INTO users (username, password)
VALUES ('hyxy', 'hyxy123')
ON CONFLICT (username) DO NOTHING;

-- 插入默认的分类
INSERT INTO categories (name) VALUES 
 ('家禽'), ('河鲜'), ('牛羊肉'), ('海鲜'), ('火锅菜品'), ('猪肉'), ('小炒'), ('各客'), ('其他')
ON CONFLICT (name) DO NOTHING;
