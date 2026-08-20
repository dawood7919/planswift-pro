import { useState } from "react";
import {
  ArrowLeft,
  Calculator,
  Check,
  ChevronDown,
  CircleDot,
  Cpu,
  Globe2,
  Hash,
  Layers3,
  Menu,
  Monitor,
  MoveRight,
  MousePointer2,
  Network,
  PenTool,
  Ruler,
  ScanLine,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { faqItems, roadmap, toolCards } from "./homeContent";
import { useTranslation } from "@/i18n";
import { Link } from "wouter";

type RoadmapItem = (typeof roadmap)[number];
type FaqItem = (typeof faqItems)[number];

const navItems = [
  { labelKey: "home.navFeatures" as const, href: "#features" },
  { labelKey: "home.navPlatforms" as const, href: "#platforms" },
  { labelKey: "home.navRoadmap" as const, href: "#roadmap" },
  { labelKey: "home.navTechnology" as const, href: "#technology" },
  { labelKey: "home.navFaq" as const, href: "#faq" },
];

const toolIcons = {
  area: Ruler,
  linear: MoveRight,
  segment: ScanLine,
  count: Hash,
  estimate: Calculator,
};

export default function Home() {
  const { direction, t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <div className="landing-shell" dir={direction}>
      <header className="site-header">
          <nav className="nav-wrap" aria-label={t("home.navigationLabel")}>
          <a href="#top" className="brand" aria-label={t("home.homeLink")}>
            <span className="brand-mark" aria-hidden="true"><span /></span>
            <span>Takeoff<span className="brand-dot">.</span></span>
          </a>

          <div className="desktop-nav">
            {navItems.map((item) => <a key={item.href} href={item.href}>{t(item.labelKey)}</a>)}
          </div>

          <Link className="nav-cta" href="/projects">
            {t("home.openApp")} <ArrowLeft size={16} strokeWidth={2.3} />
          </Link>

          <button
            className="mobile-menu-button"
            type="button"
            aria-label={mobileMenuOpen ? t("home.closeMenu") : t("home.openMenu")}
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </nav>

        {mobileMenuOpen && (
          <div className="mobile-nav" aria-label={t("home.navigationLinks")}>
            {navItems.map((item) => <a key={item.href} href={item.href} onClick={closeMenu}>{t(item.labelKey)}</a>)}
            <Link href="/projects" className="mobile-nav-cta" onClick={closeMenu}>{t("home.openApp")} <ArrowLeft size={16} /></Link>
          </div>
        )}
      </header>

      <main id="top">
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-grid">
            <div className="hero-copy">
              <div className="eyebrow"><span className="signal-dot" />{t("home.heroEyebrow")}</div>
              <h1 id="hero-title">{t("home.heroTitleBefore")} <em>{t("home.heroTitleEmphasis")}</em><br />{t("home.heroTitleAfter")}</h1>
              <p className="hero-description">{t("home.heroDescription")}</p>
              <div className="hero-actions">
                <Link href="/projects" className="primary-button">{t("home.startProject")} <ArrowLeft size={18} /></Link>
                <span className="hero-note"><Check size={16} />{t("home.auditableResults")}</span>
              </div>
            </div>

            <div className="blueprint-stage" aria-label={t("home.blueprintLabel")} role="img">
              <div className="stage-ruler stage-ruler-top"><span>0</span><span>50</span><span>100</span></div>
              <div className="stage-ruler stage-ruler-side"><span>100</span><span>50</span><span>0</span></div>
              <div className="drawing-grid" />
              <svg className="blueprint-lines" viewBox="0 0 620 470" aria-hidden="true">
                <path d="M78 90H348L420 158V364H258L204 308H78Z" />
                <path d="M78 164H204V308M204 164V90M258 308V236H420M348 90V158H420" />
                <path d="M78 364L153 289M153 364L228 289" className="detail-line" />
                <path d="M460 118H562M460 118V238M562 118V238M460 238H562" className="measure-line" />
                <path d="M446 118H576M446 238H576" className="guide-line" />
                <path d="M510 258V354M455 354H568" className="measure-line" />
                <circle cx="78" cy="90" r="5" /><circle cx="420" cy="158" r="5" /><circle cx="258" cy="308" r="5" />
              </svg>
              <div className="floating-tag tag-area"><span className="tag-icon"><Ruler size={14} /></span><div><b>Area</b><small>1,284.6 m²</small></div></div>
              <div className="floating-tag tag-scale"><span className="tag-icon tag-icon-dark"><CircleDot size={14} /></span><div><b>Scale</b><small>1:100 verified</small></div></div>
              <div className="floating-tag tag-status"><span className="status-orb" /><span>Geometry valid</span></div>
              <div className="stage-caption"><span>DRAWING SPACE</span><span>REV 01 / 2026</span></div>
            </div>
          </div>
          <div className="hero-footnote"><span>01</span><div /><p>{t("home.oneCore")}</p></div>
        </section>

        <section id="features" className="features-section section-wrap" aria-labelledby="features-title">
          <div className="section-head features-head">
            <div><span className="section-kicker">01 / أدوات القياس</span><h2 id="features-title">كل نقطة محسوبة<br /><i>عن قصد.</i></h2></div>
            <p>أدوات مستقلة في الدلالة، متحدة في الدقة. اختر نوع القياس الذي يطابق المخطط، ثم تتبع كل نتيجة حتى هندستها الأصلية.</p>
          </div>
          <div className="features-grid">
            {toolCards.map((tool, index) => {
              const Icon = toolIcons[tool.icon];
              return (
                <article className={`feature-card feature-card-${index + 1}`} key={tool.title}>
                  <div className="feature-topline"><span>{String(index + 1).padStart(2, "0")}</span><Icon size={22} strokeWidth={1.7} /></div>
                  <span className="feature-eyebrow">{tool.eyebrow}</span>
                  <h3>{tool.title}</h3>
                  <p>{tool.description}</p>
                  <span className="feature-arrow"><ArrowLeft size={17} /></span>
                </article>
              );
            })}
          </div>
        </section>

        <section id="platforms" className="platforms-section" aria-labelledby="platforms-title">
          <div className="section-wrap platforms-layout">
            <div className="platforms-intro"><span className="section-kicker">02 / المعمارية والمنصات</span><h2 id="platforms-title">نفس الحقيقة.<br /><i>تجربة مناسبة لكل منصة.</i></h2><p>تتشارك المنصات نواة الحساب والأوامر، بينما تحتفظ كل واجهة بلغتها الطبيعية في الإدخال والرسم والتنقل.</p></div>
            <div className="platform-stack">
              <article className="platform-row"><span className="platform-number">A</span><Monitor size={27} /><div><h3>Windows</h3><p>لوحات كثيفة، اختصارات، وسياق عمل احترافي.</p></div><ArrowLeft size={18} /></article>
              <article className="platform-row"><span className="platform-number">B</span><Globe2 size={27} /><div><h3>Web / PWA</h3><p>تجربة سريعة، وضع غير متصل، وإدخال موحد.</p></div><ArrowLeft size={18} /></article>
              <article className="platform-row"><span className="platform-number">C</span><PenTool size={27} /><div><h3>Android / S Pen</h3><p>دقة القلم، لمس للتنقل، ومراجعة ميدانية.</p></div><ArrowLeft size={18} /></article>
            </div>
          </div>
        </section>

        <section id="roadmap" className="roadmap-section section-wrap" aria-labelledby="roadmap-title">
          <div className="section-head roadmap-head"><div><span className="section-kicker">03 / خارطة الطريق</span><h2 id="roadmap-title">نبني الثقة<br /> <i>على مراحل.</i></h2></div><p>كل مرحلة تقفل طبقة من الدقة قبل الانتقال إلى التالية؛ لا اختصارات على حساب قابلية التحقق.</p></div>
          <div className="roadmap-line" aria-hidden="true"><span /></div>
          <div className="roadmap-grid">
            {roadmap.map((item: RoadmapItem, index: number) => <article className="roadmap-card" key={item.phase}><div className="roadmap-marker"><span>{item.phase}</span><i /></div><h3>{item.title}</h3><p>{item.description}</p><span className="roadmap-state">{index === 0 ? "نقطة البداية" : "طبقة تالية"}</span></article>)}
          </div>
        </section>

        <section id="technology" className="technology-section" aria-labelledby="technology-title">
          <div className="section-wrap tech-layout">
            <div className="tech-copy"><span className="section-kicker section-kicker-light">04 / التقنية</span><h2 id="technology-title">هندسة لا<br /><i>تتخيل.</i></h2><p>النواة لا تعرف واجهة المستخدم؛ تعرف الإحداثيات والمقياس والوحدات والأوامر. لهذا تظل النتيجة نفسها، أينما فتحت المشروع.</p><a href="#faq" className="text-link">اقرأ مبادئ الأمان <ArrowLeft size={17} /></a></div>
            <div className="tech-cards">
              <article><span className="tech-icon"><Cpu size={20} /></span><h3>نواة حتمية</h3><p>حساب واحد، نتائج قابلة للإعادة، وسجل أوامر واضح.</p></article>
              <article><span className="tech-icon"><Network size={20} /></span><h3>محرك هندسة</h3><p>مقياس موثق، هندسة متجهية، والتقاط يشرح اختياراته.</p></article>
              <article><span className="tech-icon"><ShieldCheck size={20} /></span><h3>صيغ آمنة</h3><p>وحدات وأنواع وتبعيات مضبوطة من دون تنفيذ غير موثوق.</p></article>
            </div>
          </div>
        </section>

        <section id="faq" className="faq-section section-wrap" aria-labelledby="faq-title">
          <div className="faq-aside"><span className="section-kicker">05 / الأسئلة الشائعة</span><h2 id="faq-title">أسئلة دقيقة.<br /><i>إجابات واضحة.</i></h2><p>كل قرار تقني في المنصة يبدأ من قابلية المراجعة، لا من اختصار الواجهة.</p><span className="faq-orb"><Sparkles size={20} /></span></div>
          <div className="faq-list">
            {faqItems.map((item: FaqItem, index: number) => <details key={item.question} open={index === 0}><summary><span>{item.question}</span><ChevronDown size={20} /></summary><p>{item.answer}</p></details>)}
          </div>
        </section>
      </main>
    </div>
  );
}
