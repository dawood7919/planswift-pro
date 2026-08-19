# Takeoff Native for Android

هذا المجلد هو **تطبيق Android أصلي** مستقل، مكتوب بـKotlin وواجهة Jetpack Compose. لا يحتوي على WebView ولا يعيد تغليف موقع الويب. يبدأ التطبيق بفتح ملف PDF محلياً عبر منتقي ملفات Android، ثم يرسمه بواسطة `PdfRenderer` داخل مساحة قياس أصلية.

## قرارات التنفيذ

| المجال | القرار | السبب |
|---|---|---|
| اللغة والواجهة | Kotlin + Jetpack Compose | واجهة Android أصلية قابلة للتكيف مع الهاتف واللوحي. [1] |
| المخطط | `PdfRenderer` من Android | عرض PDF من URI محلي، من دون متصفح مضمّن. |
| القلم واللمس | `MotionEvent` عبر `pointerInteropFilter` | تمييز القلم، اللمس، والإلغاء الناتج عن رفض راحة اليد. [2] |
| القياس | نواة Kotlin حتمية مستقلة | يمكن اختبار الطول والمساحة محلياً قبل ربط السحابة. |
| ربط البيانات | API مصادق في مرحلة لاحقة | لا تُضمّن أي أسرار أو جلسات ويب في APK. |

تدعم النسخة الأولى استيراد صفحة PDF محلياً، التحريك، العد، الطول، والمساحة الحرة. يميّز السطح `TOOL_TYPE_STYLUS` ويعرض مصدر الإدخال، ويعالج `ACTION_CANCEL` بإلغاء المسار غير الملتزم. لا تُعامل نقاط التنبؤ أو ضغط القلم كقياسات محفوظة؛ القياس المحفوظ يعتمد فقط على النقاط الفعلية. [2]

## البناء محلياً

يتطلب البناء Android SDK، وJDK 17 أو أحدث، وGradle Wrapper. بعد إعداد Android SDK:

```bash
cd android-native
./gradlew :app:testDebugUnitTest
./gradlew :app:assembleDebug
```

سينتج APK تجريبي في `app/build/outputs/apk/debug/`. لا يُعد هذا إصداراً متجرّياً؛ يتطلب نشر Play Store لاحقاً توقيع Release وإعداد App Bundle.

## ملاحظات الخصوصية

يبقى ملف PDF المحلي في مساحة اختيار المستخدم ما لم يطلب المستخدم لاحقاً مزامنته. عند إضافة الربط الخلفي ستُستخدم مصادقة Android مخصصة ورموز قصيرة العمر، وليس ملفات تعريف ارتباط المتصفح.

## المراجع

[1]: https://developer.android.com/develop/ui/compose/documentation "Android Developers — Jetpack Compose"
[2]: https://developer.android.com/develop/ui/compose/touch-input/stylus-input/advanced-stylus-features "Android Developers — Advanced stylus features"
