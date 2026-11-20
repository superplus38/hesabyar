
-- ساخت جدول اطلاعات کاربران

CREATE TABLE IF NOT EXISTS public.user_data (
    user_id UUID PRIMARY KEY
        REFERENCES auth.users(id) ON DELETE CASCADE,

    payload JSONB NOT NULL DEFAULT '{}'::JSONB,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فعال کردن امنیت جدول

ALTER TABLE public.user_data
ENABLE ROW LEVEL SECURITY;


-- اجازه مشاهده اطلاعات شخصی

CREATE POLICY "Users can read own data"
ON public.user_data
FOR SELECT
USING (auth.uid() = user_id);


-- اجازه ثبت اطلاعات شخصی

CREATE POLICY "Users can insert own data"
ON public.user_data
FOR INSERT
WITH CHECK (auth.uid() = user_id);


-- اجازه ویرایش اطلاعات شخصی

CREATE POLICY "Users can update own data"
ON public.user_data
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
