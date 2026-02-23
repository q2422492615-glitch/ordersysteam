# Supabase 本地开发目录
# 此目录包含数据库迁移文件和配置

## 文件说明

- `config.toml` — Supabase CLI 本地开发配置（可选，仅使用 CLI 时需要）  
- `migrations/` — 数据库迁移 SQL 文件

## 快速开始（推荐方式：直接在 Dashboard 建表）

1. 打开 [Supabase 控制台](https://supabase.com/dashboard)
2. 进入你的项目 → 左侧点击 **SQL Editor**
3. 把 `migrations/20260222_init.sql` 中的内容**全部复制**，粘贴到编辑器中并点击 **Run**
4. 建表完成后，将 Supabase 的 `Project URL` 和 `anon key` 填入项目根目录的 `.env` 文件

## 可选：使用 Supabase CLI 本地开发

```bash
# 安装 Supabase CLI
npm install -g supabase

# 登录
supabase login

# 链接你的 Supabase 项目
supabase link --project-ref your-project-id

# 推送迁移到云端
supabase db push
```
