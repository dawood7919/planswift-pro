# تشغيل Takeoff المرحلي على VPS

تستخدم البيئة المرحلية مساراً منفصلاً عن الخدمات القائمة:

| المورد | القيمة |
|---|---|
| مسار الإصدارات | `/home/ubuntu/takeoff-stage/releases/<UTC timestamp>` |
| الإصدار النشط | `/home/ubuntu/takeoff-stage/current` (رابط رمزي) |
| ملف التشغيل | `ops/vps/docker-compose.stage.yml` |
| فحص البناء | Compose profile: `validation` |
| تشغيل التطبيق | Compose profile: `app` على `127.0.0.1:4179` فقط |
| volumes الخاصة | `takeoff_stage_pnpm_store` و`takeoff_stage_node_modules` |

## فحص غير محمي

من داخل مسار الإصدار النشط، شغّل ملف Compose مع profile `validation`. ينفذ ذلك `pnpm install --frozen-lockfile` ثم `pnpm check` و`pnpm test` و`pnpm build` داخل حاوية Node 22 تحمل اسم `takeoff-stage-validation`. لا يفتح منافذ ولا يغير الحاويتين الموجودتين على الخادم.

## تشغيل التطبيق المحمي

لا يبدأ profile `app` قبل إنشاء الملف المحلي `/home/ubuntu/takeoff-stage/secrets/takeoff.stage.env` بملكية مقيدة. يجب أن يوفر هذا الملف بدائل مملوكة ومخصصة للمرحلة لـ`DATABASE_URL` و`JWT_SECRET` وإعدادات OAuth والتخزين. لا تضمّن أي قيمة سرية في مستودع Takeoff أو ملف Compose.

> نسخة Manus OAuth وقاعدة البيانات والتخزين المدمجة لا تنتقل تلقائياً إلى VPS. لذلك لا يجوز اعتبار تشغيل التطبيق أو تدفقات PDF المحمية على VPS صالحاً قبل توفير هذه البدائل والتحقق منها.

## إيقاف وتنظيف غير مدمر

أوقف تطبيق المرحلة فقط عبر `docker compose --profile app down` من دون استخدام `-v`، كي لا تمس volumes الخاصة بالخدمات الأخرى. لا تستخدم `docker system prune` في هذا الخادم؛ اقتصر عند الحاجة على `docker builder prune -af` بعد تحقق وموافقة لأن الحاويات القائمة مستقلة عن Takeoff.
