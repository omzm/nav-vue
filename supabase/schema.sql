-- ============================================================
-- nav 数据库结构声明（幂等，可重复执行）
-- 每次部署由 scripts/migrate.mjs 自动执行，全程零手工 SQL。
-- 改表结构直接改这个文件并保持幂等即可，不用再写 migration 文件
-- （只有数据搬运类变更才需要单独的 migration）。
-- 注意：管理员邮箱不再写死，存在 app_config 表中（key='admin_email'），
-- 首次部署由 /admin/setup 向导写入；RLS 策略与 RPC 均动态读取。
-- ============================================================

-- 应用配置表：存管理员邮箱等站点级配置，首次部署由 /admin/setup 向导写入
-- RLS 已启用且不对 anon/authenticated 开放任何策略：只有 service_role 可读写。
-- RLS 策略与 RPC 经下面的 SECURITY DEFINER 函数读取（函数需显式授权 EXECUTE）。
CREATE TABLE IF NOT EXISTS app_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- 清理旧版的公开读策略（如果存在）
DROP POLICY IF EXISTS "Allow anyone to read app_config" ON app_config;

-- 管理员判断函数：SECURITY DEFINER + 固定 search_path，
-- 只返回 boolean，不泄露管理员邮箱；供 RLS 策略与排序 RPC 调用
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM app_config
    WHERE key = 'admin_email'
      AND lower(value) <> ''
      AND lower(value) = lower(auth.jwt()->>'email')
  );
$$;

-- 旧版返回邮箱的函数不再使用，直接删除（不向客户端泄露邮箱）
DROP FUNCTION IF EXISTS get_admin_email();

REVOKE ALL ON FUNCTION is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_admin() TO anon, authenticated;

-- 创建分类表
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  is_private BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建链接表
CREATE TABLE IF NOT EXISTS links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  is_private BOOLEAN DEFAULT FALSE,
  source TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_categories_order ON categories("order");
CREATE INDEX IF NOT EXISTS idx_categories_is_private ON categories(is_private);
CREATE INDEX IF NOT EXISTS idx_links_category_id ON links(category_id);
CREATE INDEX IF NOT EXISTS idx_links_order ON links("order");
CREATE INDEX IF NOT EXISTS idx_links_is_private ON links(is_private);

-- 启用行级安全 (RLS)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE links ENABLE ROW LEVEL SECURITY;

-- 创建策略：公开分类对所有人可见，私密分类只对认证用户可见
DROP POLICY IF EXISTS "Allow public read on public categories" ON categories;
CREATE POLICY "Allow public read on public categories"
  ON categories FOR SELECT
  USING (is_private = FALSE OR (is_admin()));

-- 创建策略：公开链接对所有人可见，私密链接只对认证用户可见
DROP POLICY IF EXISTS "Allow public read on public links" ON links;
CREATE POLICY "Allow public read on public links"
  ON links FOR SELECT
  USING (is_admin() OR (is_private = FALSE AND EXISTS (
    SELECT 1 FROM categories c WHERE c.id = links.category_id AND c.is_private = FALSE
  )));

-- 创建策略：只有管理员可以修改（管理员邮箱从 app_config 表动态读取）
DROP POLICY IF EXISTS "Allow admin to insert categories" ON categories;
CREATE POLICY "Allow admin to insert categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Allow admin to update categories" ON categories;
CREATE POLICY "Allow admin to update categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Allow admin to delete categories" ON categories;
CREATE POLICY "Allow admin to delete categories"
  ON categories FOR DELETE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Allow admin to insert links" ON links;
CREATE POLICY "Allow admin to insert links"
  ON links FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Allow admin to update links" ON links;
CREATE POLICY "Allow admin to update links"
  ON links FOR UPDATE
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Allow admin to delete links" ON links;
CREATE POLICY "Allow admin to delete links"
  ON links FOR DELETE
  TO authenticated
  USING (is_admin());


-- 创建点击记录表
CREATE TABLE IF NOT EXISTS link_clicks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  link_id UUID REFERENCES links(id) ON DELETE CASCADE,
  clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_link_clicks_link_id ON link_clicks(link_id);
CREATE INDEX IF NOT EXISTS idx_link_clicks_clicked_at ON link_clicks(clicked_at);
CREATE INDEX IF NOT EXISTS idx_link_clicks_clicked_at_link_id ON link_clicks(clicked_at, link_id);

ALTER TABLE link_clicks ENABLE ROW LEVEL SECURITY;

-- 点击记录只允许服务端写入（service_role 绕过 RLS，经 /api/link-click 限流+校验后插入）。
-- 匿名直写通道已关闭：防止绕过 API 限流刷点击、操纵今日热门。
DROP POLICY IF EXISTS "Allow anyone to insert link_clicks" ON link_clicks;

-- 点击记录仅管理员可读（今日热门走 SECURITY DEFINER 的 get_today_hot_links 聚合）
DROP POLICY IF EXISTS "Allow admin to read link_clicks" ON link_clicks;
CREATE POLICY "Allow admin to read link_clicks"
  ON link_clicks FOR SELECT
  TO authenticated
  USING (is_admin());

-- 数据库侧聚合今日热门，首页只读取聚合后的前 N 条结果
CREATE TABLE IF NOT EXISTS site_stats (
  key TEXT PRIMARY KEY,
  value BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO site_stats (key, value)
VALUES ('total_views', 0)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE site_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anyone to read site_stats" ON site_stats;
CREATE POLICY "Allow anyone to read site_stats"
  ON site_stats FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION increment_site_view()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_value BIGINT;
BEGIN
  INSERT INTO site_stats AS stats (key, value, updated_at)
  VALUES ('total_views', 1, NOW())
  ON CONFLICT (key)
  DO UPDATE SET
    value = stats.value + 1,
    updated_at = EXCLUDED.updated_at
  RETURNING value INTO next_value;

  RETURN next_value;
END;
$$;

CREATE OR REPLACE FUNCTION get_today_hot_links(limit_count integer DEFAULT 3)
RETURNS TABLE (
  title TEXT,
  url TEXT,
  icon TEXT,
  click_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.title,
    l.url,
    l.icon,
    COUNT(c.id)::BIGINT AS click_count
  FROM link_clicks c
  JOIN links l ON l.id = c.link_id
  JOIN categories cat ON cat.id = l.category_id
  WHERE c.clicked_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai'
    AND c.clicked_at < date_trunc('day', now() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai' + interval '1 day'
    AND COALESCE(l.is_private, false) = false
    -- 私密分类下的链接不得出现在公开热门榜（与首页快照口径对齐）
    AND COALESCE(cat.is_private, false) = false
  GROUP BY l.id, l.title, l.url, l.icon
  ORDER BY click_count DESC, l.title ASC
  LIMIT GREATEST(limit_count, 0);
$$;

-- 首页快照 RPC：只返回公开分类/链接（私密内容走 get_nav_private_data）
CREATE OR REPLACE FUNCTION get_nav_snapshot_data(limit_count integer DEFAULT 3)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'categories',
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'icon', c.icon,
          'order', c."order",
          'isPrivate', false,
          'links', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', l.id,
                'title', l.title,
                'url', l.url,
                'description', l.description,
                'icon', l.icon,
                'isPrivate', false
              )
              ORDER BY l."order" ASC
            )
            FROM links l
            WHERE l.category_id = c.id
              AND COALESCE(l.is_private, false) = false
          ), '[]'::jsonb)
        )
        ORDER BY c."order" ASC
      )
      FROM categories c
      WHERE COALESCE(c.is_private, false) = false
    ), '[]'::jsonb),
    'hotLinks',
    COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'title', h.title,
          'url', h.url,
          'icon', h.icon,
          'clickCount', h.click_count
        )
        ORDER BY h.click_count DESC, h.title ASC
      )
      FROM get_today_hot_links(limit_count) h
    ), '[]'::jsonb),
    'stats',
    jsonb_build_object(
      'categoryCount', (SELECT COUNT(*) FROM categories WHERE COALESCE(is_private, false) = false),
      'linkCount', (SELECT COUNT(*) FROM links l JOIN categories c ON c.id = l.category_id
        WHERE COALESCE(l.is_private, false) = false AND COALESCE(c.is_private, false) = false),
      'totalViewCount', COALESCE((SELECT value FROM site_stats WHERE key = 'total_views'), 0)
    ),
    'generatedAt', now()
  );
$$;

-- 私密数据 RPC：校验口令后下发私密分类/链接
CREATE OR REPLACE FUNCTION get_nav_private_data(p_phrase text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- 解锁口令来源（按优先级）：app_config 表（后台"解锁口令"页可配）→
  -- GUC app.settings.unlock_phrase（运维覆盖）→ 默认'开门'
  v_expected text := COALESCE(
    NULLIF((SELECT value FROM public.app_config WHERE key = 'unlock_phrase'), ''),
    NULLIF(current_setting('app.settings.unlock_phrase', true), ''),
    '开门'
  );
BEGIN
  IF p_phrase IS NULL OR p_phrase <> v_expected THEN
    RETURN jsonb_build_object('unlocked', false, 'categories', '[]'::jsonb);
  END IF;

  RETURN jsonb_build_object(
    'unlocked', true,
    'categories', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', c.id,
          'name', c.name,
          'icon', c.icon,
          'order', c."order",
          'isPrivate', true,
          'links', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', l.id,
                'title', l.title,
                'url', l.url,
                'description', l.description,
                'icon', l.icon,
                'isPrivate', COALESCE(l.is_private, false)
              )
              ORDER BY l."order" ASC
            )
            FROM links l
            WHERE l.category_id = c.id
              AND (
                COALESCE(c.is_private, false) = true
                OR COALESCE(l.is_private, false) = true
              )
          ), '[]'::jsonb)
        )
        ORDER BY c."order" ASC
      )
      FROM categories c
      WHERE COALESCE(c.is_private, false) = true
         OR EXISTS (
           SELECT 1 FROM links l2
           WHERE l2.category_id = c.id AND COALESCE(l2.is_private, false) = true
         )
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION reorder_links(p_ordered_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
BEGIN
  -- 管理员身份由 is_admin() 判断（只返回 boolean，不泄露邮箱）
  IF NOT is_admin() THEN
    RAISE EXCEPTION '未授权：仅管理员可调整链接排序';
  END IF;

  -- 按数组顺序批量写入 order（unnest with ordinality 取出下标）
  UPDATE links AS l
  SET "order" = ordered.rn::integer
  FROM (
    SELECT u.id, u.ord AS rn
    FROM unnest(p_ordered_ids) WITH ORDINALITY AS u(id, ord)
  ) AS ordered
  WHERE l.id = ordered.id;
END;
$$;
CREATE OR REPLACE FUNCTION reorder_categories(p_ordered_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
BEGIN
  -- 管理员身份由 is_admin() 判断（只返回 boolean，不泄露邮箱）
  IF NOT is_admin() THEN
    RAISE EXCEPTION '未授权：仅管理员可调整分类排序';
  END IF;

  -- 按数组顺序批量写入 order（unnest with ordinality 取出下标）
  UPDATE categories AS c
  SET "order" = ordered.rn::integer
  FROM (
    SELECT u.id, u.ord AS rn
    FROM unnest(p_ordered_ids) WITH ORDINALITY AS u(id, ord)
  ) AS ordered
  WHERE c.id = ordered.id;
END;
$$;

REVOKE ALL ON FUNCTION get_nav_private_data(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION reorder_links(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION reorder_categories(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_today_hot_links(integer) TO anon, authenticated;
-- 浏览量 RPC 仅服务端调用（service_role），关闭匿名/登录用户直调通道，
-- 防止绕过 /api/site-view 的限流直接刷浏览量。
REVOKE ALL ON FUNCTION increment_site_view() FROM PUBLIC;
REVOKE ALL ON FUNCTION increment_site_view() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_site_view() TO service_role;
GRANT EXECUTE ON FUNCTION get_nav_snapshot_data(integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_nav_private_data(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION reorder_links(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION reorder_categories(uuid[]) TO authenticated;

-- 上海时间 00:05 清理前一天记录；边界显式指定时区，不依赖数据库会话时区。
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'clean-old-link-clicks';
SELECT cron.schedule(
  'clean-old-link-clicks',
  '5 16 * * *',
  $$DELETE FROM link_clicks WHERE clicked_at < date_trunc('day', now() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai'$$
);

-- URL duplicates remain allowed for administrators. These indexes serve equality and quota queries.
CREATE INDEX IF NOT EXISTS idx_links_url ON links USING hash(url);
CREATE INDEX IF NOT EXISTS idx_links_public_created ON links(created_at) WHERE source = 'public';

CREATE TABLE IF NOT EXISTS rate_limit_windows (
  key text PRIMARY KEY,
  hits timestamptz[] NOT NULL DEFAULT '{}',
  expires_at timestamptz NOT NULL
);
ALTER TABLE rate_limit_windows ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_rate_limit_expiry ON rate_limit_windows(expires_at);

CREATE OR REPLACE FUNCTION consume_rate_limit(p_key text, p_limit integer, p_window_ms integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  recent timestamptz[];
  v_now timestamptz;
BEGIN
  IF length(p_key) > 300 OR p_limit NOT BETWEEN 1 AND 1000 OR p_window_ms NOT BETWEEN 1 AND 86400000 THEN
    RAISE EXCEPTION 'Invalid rate limit';
  END IF;
  INSERT INTO rate_limit_windows AS bucket(key, expires_at) VALUES (p_key, clock_timestamp())
    ON CONFLICT(key) DO UPDATE SET key = EXCLUDED.key RETURNING bucket.hits INTO recent;
  v_now := clock_timestamp();
  SELECT COALESCE(array_agg(t), '{}') INTO recent FROM unnest(recent) AS t
    WHERE t > v_now - p_window_ms * interval '1 millisecond';
  IF cardinality(recent) >= p_limit THEN RETURN false; END IF;
  UPDATE rate_limit_windows SET hits = array_append(recent, v_now),
    expires_at = v_now + p_window_ms * interval '1 millisecond' WHERE key = p_key;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION consume_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION consume_rate_limit(text, integer, integer) TO service_role;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'clean-expired-rate-limits';
SELECT cron.schedule('clean-expired-rate-limits', '17 * * * *',
  $$DELETE FROM rate_limit_windows WHERE expires_at < now()$$);

-- Public cache revision contains no business data. Triggers invalidate every server instance.
CREATE TABLE IF NOT EXISTS nav_cache_state (id boolean PRIMARY KEY DEFAULT true CHECK (id), version bigint NOT NULL DEFAULT 0);
INSERT INTO nav_cache_state(id) VALUES (true) ON CONFLICT DO NOTHING;
ALTER TABLE nav_cache_state ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION get_nav_snapshot_version() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT version::text FROM nav_cache_state WHERE id;
$$;
CREATE OR REPLACE FUNCTION bump_nav_snapshot_version() RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE nav_cache_state SET version = version + 1 WHERE id;
$$;
CREATE OR REPLACE FUNCTION invalidate_nav_snapshot() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN PERFORM bump_nav_snapshot_version(); RETURN NULL; END;
$$;
DROP TRIGGER IF EXISTS categories_snapshot_revision ON categories;
CREATE TRIGGER categories_snapshot_revision AFTER INSERT OR UPDATE OR DELETE ON categories FOR EACH STATEMENT EXECUTE FUNCTION invalidate_nav_snapshot();
DROP TRIGGER IF EXISTS links_snapshot_revision ON links;
CREATE TRIGGER links_snapshot_revision AFTER INSERT OR UPDATE OR DELETE ON links FOR EACH STATEMENT EXECUTE FUNCTION invalidate_nav_snapshot();
DROP TRIGGER IF EXISTS views_snapshot_revision ON site_stats;
CREATE TRIGGER views_snapshot_revision AFTER INSERT OR UPDATE OR DELETE ON site_stats FOR EACH STATEMENT EXECUTE FUNCTION invalidate_nav_snapshot();
DROP TRIGGER IF EXISTS clicks_snapshot_revision ON link_clicks;
CREATE TRIGGER clicks_snapshot_revision AFTER INSERT OR UPDATE OR DELETE ON link_clicks FOR EACH STATEMENT EXECUTE FUNCTION invalidate_nav_snapshot();
REVOKE ALL ON FUNCTION get_nav_snapshot_version() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_nav_snapshot_version() TO anon, authenticated, service_role;
REVOKE ALL ON FUNCTION bump_nav_snapshot_version() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION bump_nav_snapshot_version() TO service_role;
REVOKE ALL ON FUNCTION invalidate_nav_snapshot() FROM PUBLIC, anon, authenticated;

-- Server-only RPCs preserve atomicity after the application verifies its signed admin cookie.
CREATE OR REPLACE FUNCTION admin_reorder_items(p_table text, p_ids uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE affected integer;
BEGIN
  IF p_table NOT IN ('links', 'categories') OR cardinality(p_ids) NOT BETWEEN 1 AND 1000 OR
    cardinality(p_ids) <> (SELECT count(DISTINCT id) FROM unnest(p_ids) id) THEN
    RAISE EXCEPTION 'Invalid ordering';
  END IF;
  EXECUTE format('UPDATE %I t SET "order" = u.ord::integer FROM unnest($1) WITH ORDINALITY u(id,ord) WHERE t.id = u.id', p_table) USING p_ids;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> cardinality(p_ids) THEN RAISE EXCEPTION 'Some items no longer exist'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION admin_reorder_items(text, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_reorder_items(text, uuid[]) TO service_role;

CREATE OR REPLACE FUNCTION admin_update_category(p_id uuid, p_name text, p_icon text, p_order integer, p_private boolean, p_cascade boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE categories SET name = p_name, icon = p_icon, "order" = p_order, is_private = p_private WHERE id = p_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF p_private AND p_cascade THEN UPDATE links SET is_private = true WHERE category_id = p_id AND is_private = false; END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION admin_update_category(uuid,text,text,integer,boolean,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_update_category(uuid,text,text,integer,boolean,boolean) TO service_role;

CREATE OR REPLACE FUNCTION admin_move_links(p_ids uuid[], p_category_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target categories; first_order integer; affected integer;
BEGIN
  IF cardinality(p_ids) NOT BETWEEN 1 AND 1000 OR cardinality(p_ids) <> (SELECT count(DISTINCT id) FROM unnest(p_ids) id) THEN RAISE EXCEPTION 'Invalid IDs'; END IF;
  SELECT * INTO target FROM categories WHERE id = p_category_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Target category does not exist'; END IF;
  SELECT COALESCE(max("order"),0) INTO first_order FROM links WHERE category_id = p_category_id;
  WITH moving AS (SELECT id, row_number() OVER (ORDER BY "order", id) AS n FROM links WHERE id = ANY(p_ids))
  UPDATE links l SET category_id = p_category_id, is_private = target.is_private, "order" = first_order + moving.n
    FROM moving WHERE l.id = moving.id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> cardinality(p_ids) THEN RAISE EXCEPTION 'Some links no longer exist'; END IF;
  RETURN jsonb_build_object('count', affected, 'categoryName', target.name);
END;
$$;
REVOKE ALL ON FUNCTION admin_move_links(uuid[],uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_move_links(uuid[],uuid) TO service_role;

CREATE OR REPLACE FUNCTION submit_public_link(p_category_id uuid, p_title text, p_url text, p_description text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE target categories; next_order integer;
BEGIN
  -- Serialize duplicate/quota checks and insertion across all application instances.
  PERFORM pg_advisory_xact_lock(hashtext('nav-public-submission'));
  SELECT * INTO target FROM categories WHERE id = p_category_id AND is_private = false FOR UPDATE;
  IF NOT FOUND THEN RETURN 'invalid_category'; END IF;
  IF (SELECT count(*) FROM links WHERE source = 'public' AND created_at >= now() - interval '1 hour') >= 20 THEN RETURN 'rate_limited'; END IF;
  IF EXISTS(SELECT 1 FROM links WHERE url = p_url) THEN RETURN 'duplicate'; END IF;
  SELECT COALESCE(max("order"),0) + 1 INTO next_order FROM links WHERE category_id = p_category_id;
  INSERT INTO links(category_id,title,url,description,icon,"order",is_private,source)
    VALUES(p_category_id,p_title,p_url,p_description,'',next_order,false,'public');
  RETURN 'ok';
END;
$$;
REVOKE ALL ON FUNCTION submit_public_link(uuid,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_public_link(uuid,text,text,text) TO service_role;

CREATE OR REPLACE FUNCTION begin_admin_account_change(p_expected_version text, p_new_version text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO app_config(key,value) VALUES('admin_session_version','0') ON CONFLICT DO NOTHING;
  UPDATE app_config SET value = p_new_version, updated_at = now()
    WHERE key = 'admin_session_version' AND value = p_expected_version;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION begin_admin_account_change(text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION begin_admin_account_change(text,text) TO service_role;

-- Existing installations also receive timezone-correct timestamp defaults.
ALTER TABLE app_config ALTER COLUMN updated_at SET DEFAULT now();
ALTER TABLE categories ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE links ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE link_clicks ALTER COLUMN clicked_at SET DEFAULT now();
ALTER TABLE site_stats ALTER COLUMN updated_at SET DEFAULT now();
