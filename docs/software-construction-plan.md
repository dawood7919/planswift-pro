# Software Construction Plan

## 1. القرار التنفيذي للنطاق

بناءً على وثائق المرحلة الأولى والملف المرفق، فإن الهدف ليس مجرد واجهة عرض، بل **برنامج Takeoff قابل للاستخدام فعلياً**. ومع ذلك، توجد مفاضلة هندسية واضحة بين الرؤية بعيدة المدى متعددة المنصات وبين بيئة التنفيذ الحالية للمشروع، وهي بيئة ويب كاملة المكدس. لذلك يُحسم التعارض على النحو الآتي: سيتم تنفيذ **MVP ويب حقيقي** داخل هذا المشروع أولاً، مع **نواة مشتركة معزولة من منطق الواجهة** بحيث يمكن لاحقاً إعادة استخدامها أو نقلها إلى تطبيقات Windows وAndroid من دون إعادة اختراع منطق القياس والحساب.

هذا القرار لا يلغي رؤية Windows وAndroid المذكورة في المرحلة الأولى، لكنه يمنع تجميد التنفيذ بانتظار بنية متعددة المنصات غير قابلة للتحقق حالياً. وتبقى واجهات المنصات الأخرى ضمن معمارية موثقة وحدود واضحة، بينما يسلّم هذا المستودع إصداراً ويبياً فعلياً بقدرات Takeoff حقيقية.

## 2. مصدر الحقيقة

تُعامل ملفات المرحلة الأولى بوصفها المصدر المرجعي للقرارات الوظيفية والمعمارية، وبخاصة: مصفوفة الميزات، معمارية المنتج، نموذج المجال، مواصفة الهندسة والمقياس، مواصفة Takeoff، مواصفة الصيغ والتقدير، مواصفة التخزين، مواصفة UX، ومتطلبات الأداء والأمان. عند ظهور تعارض، تعطى الأولوية لما يحقق:

1. صحة هندسية قابلة للاختبار.
2. فصل النواة عن الواجهة.
3. مسار MVP قابل للتسليم داخل هذا المشروع.
4. قابلية التوسع لاحقاً إلى منصات أخرى.

## 3. البنية المستهدفة للمستودع

سيعاد تنظيم المشروع الحالي بحيث يحتوي، بالإضافة إلى هيكل React/tRPC/DB القائم، على طبقات منتج واضحة:

```text
client/
  src/
    app/                    # shell, routing, layouts
    features/projects/      # project list/create/open flows
    features/canvas/        # drawing workspace and viewport UX
    features/takeoff/       # toolbars, inspectors, quantity panels
    features/estimate/      # pricing and estimate UI
    components/             # reusable UI components
    hooks/                  # frontend hooks
shared/
  takeoff-core/
    domain/                 # entities and value objects
    geometry/               # points, polygons, measures, hit testing
    scale/                  # calibration and unit transforms
    takeoff/                # sessions, items, quantities, commands
    estimate/               # rate logic and cost derivation
    persistence/            # project schema and serialization contracts
    tests/                  # pure domain tests if config is widened later
server/
  routers/                 # tRPC feature routers
  services/                # db + persistence services
drizzle/
  schema.ts                # relational schema for projects/pages/items
docs/
  software-construction-plan.md
  implementation-notes.md
  project-schema.md
tests/
  fixtures/
  golden/
scripts/
  benchmark-*.mjs
```

## 4. المكدس التقني

في هذا الإصدار، ستكون النواة المشتركة مكتوبة بـ**TypeScript** داخل `shared/takeoff-core`، لأن المشروع قائم بالفعل على TypeScript عبر العميل والخادم، ولأن هذا يسمح ببناء واختبار MVP فعلي سريعاً داخل بيئة واحدة. هذا **استبدال مؤقت ومدروس** لتوصية Rust المشروطة بـspike في وثائق المرحلة الأولى، وليس نقضاً لها. والشرط للحفاظ على سلامة القرار هو أن تبقى النواة:

| الطبقة | التقنية الحالية | سبب الاختيار |
|---|---|---|
| الواجهة | React 19 + Tailwind 4 | متاحة داخل القالب الحالي وسريعة للتفاعل المعقد |
| التوجيه والبيانات | Wouter + tRPC | موجودة وتدعم حدوداً واضحة بين UI والمنطق |
| الخادم | Express + tRPC | مناسب للحفظ وإدارة المشاريع وعمليات التصدير |
| قاعدة البيانات | MySQL/TiDB عبر Drizzle | ملائمة لمشاريع المستخدمين وبيانات takeoff المنظمة |
| النواة المشتركة | TypeScript pure modules | تعظيم إعادة الاستخدام وتقليل زمن spike الأول |
| الرسم | SVG/HTML Canvas هجيني | للوصول إلى تحرير تفاعلي سلس من دون إدخال محرك رسوميات ثقيل مبكراً |
| دعم PDF | مرحلة لاحقة مباشرة بعد تثبيت المحرر | لأن الوظيفة الحتمية أهم أولاً من تعدد صيغ الإدخال |

## 5. قرار MVP الحقيقي

سيركز أول إصدار قابل للاستخدام على المسار العمودي التالي:

**Project → Page workspace → Scale calibration → Area/Linear/Segment/Count → Quantity panel → Basic estimate → Save/Reopen**

ويدخل ضمن MVP الفعلي:

| المجال | ما سيدخل |
|---|---|
| المشاريع | إنشاء مشروع، فتحه، تعديل بياناته الأساسية |
| الصفحات | صفحة رسم عملية داخل المشروع، مع طبقة مخطط أساسية قابلة للمعاينة |
| العرض | pan/zoom، تحويل بين screen/world، selection، status bar |
| القياس | Area, Linear, Segment, Count |
| التحرير | move vertex، delete، duplicate، undo/redo، multi-select أساسي |
| المعايرة | مسافة مرجعية + وحدة + نتيجة قابلة للحفظ |
| التقدير | سعر وحدة ومجموع item ومجموع project |
| الحفظ | حفظ المشروع واستعادته من قاعدة البيانات |
| الاختبارات | domain + geometry + routes + core flows |

ويؤجل من الإصدار الأول: Auto Count، AI، DWG/DXF الحقيقي، المزامنة متعددة المستخدمين، التصدير المتقدم، الأدوات المتخصصة مثل Roof/Grid/Joist، والتطبيقات الأصلية لسطح المكتب وAndroid.

## 6. معمارية النواة المشتركة

ستتبع النواة تقسيم الوثائق المرجعية:

| الوحدة | المسؤولية |
|---|---|
| `domain` | Project, Page, TakeoffItem, TakeoffSection, QuantityResult |
| `geometry` | Point2D, Polyline, PolygonRegion, Rect, hit-test, bounds |
| `scale` | CalibrationEvidence, ScaleModel, unit transforms |
| `takeoff` | tool sessions, command log, quantity derivation |
| `estimate` | rate inputs, cost lines, total rollups |
| `persistence` | DTOs، schema versions، serialization guards |

المبدأ الحاكم هو أن **الواجهة لا تحسب الكميات**. الواجهة ترسل intents وأوامر؛ والنواة فقط هي التي تنتج quantity، diagnostics، وderived costs.

## 7. محرك الرسم والقياس

سيستخدم محرر الويب إحداثيات مرجعية للرسم داخل `DrawingSpace` مع تحويلات viewport مستقلة. وسينفذ الإصدار الأول:

1. `Point2D`, `LineSegment`, `Polyline`, `PolygonRegion`, `Rect`.
2. حساب `length`, `perimeter`, `netArea`, و`count`.
3. snap أساسي إلى vertex والنقطة القريبة، مع توسيع midpoint/intersection لاحقاً إن سمح الوقت.
4. selection وvertex editing وpreview transient.
5. command stack للـundo/redo.

لن تُنفذ arcs أو scale regions أو boolean operations المعقدة خارج cutout polygon الأساسي إلا إذا ثبتت سلامة المسار الأول أولاً.

## 8. استراتيجية الصفحة والوثيقة

بسبب أن دعم PDF الكامل ومحرك الوثائق متعدد الصيغ مجال واسع بحد ذاته، سيبدأ التنفيذ بصفحة رسم عملية تدعم:

- خلفية مخطط/Canvas محفوظة ضمن المشروع.
- العمل على إحداثيات رسم موحدة.
- واجهة استيراد أصلية لاحقاً لإضافة صفحة PDF أو صورة.

إذا تبين أن دمج PDF حقيقي يمكن إنجازه بسرعة وبموثوقية داخل الويب، فسيضاف مباشرة بعد تثبيت المحرر. أما DWG/DXF فسيبقى خلف abstraction موثقة ولن يُستبدل بمفسر زائف.

## 9. نموذج البيانات وقاعدة البيانات

سيُمدد المخطط الحالي في Drizzle ليشمل على الأقل الجداول التالية:

| الجدول | الغرض |
|---|---|
| `projects` | بيانات المشروع ومالكه وإعداداته |
| `projectPages` | صفحات المشروع وخلفيات الرسم والتحويلات |
| `takeoffItems` | عناصر القياس والتقدير |
| `takeoffSections` | sections المرتبطة بالعناصر |
| `projectCommands` | سجل الأوامر للأثر والاسترجاع |
| `estimateLines` | أسعار الوحدة والمجاميع المشتقة |

سيستخدم التخزين في الإصدار الأول قاعدة البيانات بوصفها persistence layer عملية، مع تمثيل schema version داخل بيانات المشروع نفسها تحضيراً لمسار project bundle لاحقاً.

## 10. الحفظ والاسترجاع

في بيئة الويب الحالية، سيُنفذ `ProjectStore` منطقياً فوق الخادم وقاعدة البيانات، لا كملف محلي كامل منذ البداية. ويعني ذلك:

- حفظ المشروع وصفحاته وعناصر القياس وأوامره في جداول منظمة.
- استرجاع مشروع كامل إلى client state من snapshot قاعدة البيانات.
- دعم migrations على مستوى schema والجداول.
- إبقاء واجهة تحويل مستقبلية إلى bundle export/import ممكناً.

## 11. Undo/Redo

سيبنى undo/redo على command stack صريح في النواة. كل أمر سيحمل payload يسمح بإعادة التطبيق والعكس. وسيبدأ التنفيذ بمجموعة الأوامر التالية:

- create item
- add vertex
- close polygon
- place count mark
- move vertex
- delete selection
- duplicate item
- calibrate scale
- set rate

## 12. استراتيجية الاختبارات

سيتم توسيع الاختبارات تدريجياً بالتوازي مع البناء، لا بعده. والمسارات ذات الأولوية:

| النوع | النطاق الأول |
|---|---|
| Unit | geometry math, scale transform, estimate rollups |
| Domain | item/session transitions, undo/redo, diagnostics |
| Server | create/open/save project procedures |
| Integration | create project → calibrate → draw area → compute estimate |
| UI | navigation, tool switching, quantity panel visibility |

## 13. GitHub والمستودع

ينص الملف المرفق على إنشاء مستودع GitHub جديد احترافي. وبناء على ذلك، سيتم في المرحلة التالية:

1. إنشاء مستودع GitHub خاص باسم مهني.
2. إضافة README, LICENSE, CONTRIBUTING, CHANGELOG، وقوالب `.github/`.
3. دفع حالة المعمارية والخطة قبل تنفيذ الجزء الأكبر من الشفرة.

لكن لن يجري ذلك قبل تثبيت مخطط التنفيذ الأول داخل هذا المشروع ومراجعة الملفات الحالية المطلوبة للتنفيذ.

## 14. المخاطر والقرارات الصريحة

| الخطر | القرار الحالي |
|---|---|
| التوسع الفوري إلى Windows/Android | يؤجل كتطبيقات مستقلة؛ يحفظ فقط في حدود معمارية النواة |
| PDF/DWG/DXF الكامل | يبدأ بـpage workspace عملية، ثم PDF إذا اندمج بشكل موثوق؛ DWG/DXF لاحقاً |
| Rust مقابل TypeScript core | TypeScript الآن داخل boundaries واضحة؛ تقييم Rust لاحقاً عند الحاجة الفعلية |
| AI وAuto Count | خارج MVP الأول بالكامل |
| التقدير المتقدم والصيغ العامة | يبدأ بتقدير unit-rate deterministic قبل AST الكامل |

## 15. تعريف النجاح في هذه المرحلة

تُعد هذه المرحلة مكتملة عندما تصبح لدينا داخل المشروع:

1. خطة بناء موثقة.
2. نطاق MVP محدد وقابل للتسليم.
3. قرار معماري صريح حول النواة المشتركة والويب أولاً.
4. قاعدة بيانات ومسارات تنفيذية جاهزة لبدء الترميز الحقيقي.

بعد ذلك يبدأ التنفيذ الفعلي للـdomain model، ثم الجداول، ثم shell التطبيق، ثم مساحة الرسم والقياس، ثم التقدير والحفظ.
