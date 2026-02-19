import Link from 'next/link'
import { BarChart3, CheckCircle2, ChevronRight, Mic, ShieldCheck, Sparkles, Stars, Users } from 'lucide-react'

const FEATURES = [
  {
    icon: Mic,
    title: 'Voice-first Assessments',
    text: 'Students respond in real time, making understanding visible through spoken reasoning.',
  },
  {
    icon: ShieldCheck,
    title: 'Hard to Fake, Easy to Verify',
    text: 'Socratic follow-up questioning structurally reduces copy-paste and AI-assisted cheating.',
  },
  {
    icon: BarChart3,
    title: 'Actionable Teacher Reports',
    text: 'AI-generated criterion-aligned evidence and growth points help you coach faster.',
  },
]

const REVIEWS = [
  {
    name: 'Aisha R.',
    role: 'IB Physics Teacher',
    quote: 'VoiceIQ helped me hear actual thinking. My feedback quality improved in week one.',
  },
  {
    name: 'Daniel M.',
    role: 'MYP Science Coordinator',
    quote: 'Students engage more seriously when they know they must explain concepts out loud.',
  },
  {
    name: 'Priya S.',
    role: 'Academic Director',
    quote: 'The assessment evidence is clear, and moderation conversations are far easier now.',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#ece8c7] text-[#223a83]">
      <header className="sticky top-0 z-30 border-b border-[#b9c7ce] bg-[#dce9eb]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#24408f] text-[#f3efcf]">
              <Sparkles size={16} />
            </div>
            <div>
              <p className="text-lg font-semibold leading-none">VoiceIQ</p>
              <p className="text-[11px] text-[#5b6d88]">AI Oral Assessment Platform</p>
            </div>
          </div>
          <nav className="hidden gap-6 text-sm text-[#2b427f] md:flex">
            <a href="#features" className="hover:text-[#1c3273]">Features</a>
            <a href="#reviews" className="hover:text-[#1c3273]">Reviews</a>
            <a href="#how" className="hover:text-[#1c3273]">How it works</a>
          </nav>
          <Link href="/login" className="rounded-lg bg-[#24408f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#1d3578]">
            Login
          </Link>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(72,95,166,0.22),transparent_45%),radial-gradient(circle_at_80%_10%,rgba(58,145,167,0.22),transparent_35%)]" />
          <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-4 pb-20 pt-16 sm:px-6 md:grid-cols-[1.2fr_1fr] md:pt-24">
            <div>
              <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#b8c8d4] bg-[#edf2fb] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#2f4a86]">
                <Stars size={12} />
                Built for MYP & IB classrooms
              </p>
              <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
                Oral assessments that reveal real understanding.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-[#415677]">
                VoiceIQ turns one access code into a guided oral session, concept-aware follow-up questions, and report-ready evidence for teachers.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-[#24408f] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1c3579]">
                  Go to Login
                  <ChevronRight size={15} />
                </Link>
                <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl border border-[#9db0bf] bg-[#f2f7fb] px-5 py-3 text-sm font-semibold text-[#24408f] hover:bg-[#e7eff6]">
                  Create teacher account
                </Link>
              </div>
              <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-[#bfd0d8] bg-[#f3f8fb] p-3">
                  <p className="text-xl font-semibold">10m</p>
                  <p className="text-xs text-[#5b6d88]">Average oral check-in</p>
                </div>
                <div className="rounded-xl border border-[#bfd0d8] bg-[#f3f8fb] p-3">
                  <p className="text-xl font-semibold">6Q</p>
                  <p className="text-xs text-[#5b6d88]">Adaptive questions per session</p>
                </div>
                <div className="rounded-xl border border-[#bfd0d8] bg-[#f3f8fb] p-3">
                  <p className="text-xl font-semibold">Instant</p>
                  <p className="text-xs text-[#5b6d88]">Teacher-facing evidence report</p>
                </div>
              </div>
            </div>
            <div className="rounded-3xl border border-[#a6b8c8] bg-[#f5f4eb] p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Why schools choose VoiceIQ</h2>
              <ul className="mt-4 space-y-3">
                <li className="flex gap-2 text-sm text-[#425877]">
                  <CheckCircle2 size={16} className="mt-0.5 text-[#2a8f68]" />
                  Concept-checking dialogue instead of static, one-shot written responses.
                </li>
                <li className="flex gap-2 text-sm text-[#425877]">
                  <CheckCircle2 size={16} className="mt-0.5 text-[#2a8f68]" />
                  Better academic integrity through live explanation and follow-up probing.
                </li>
                <li className="flex gap-2 text-sm text-[#425877]">
                  <CheckCircle2 size={16} className="mt-0.5 text-[#2a8f68]" />
                  Clear, criterion-aligned evidence teachers can review and override when needed.
                </li>
              </ul>
              <div className="mt-6 rounded-2xl border border-[#c1cddd] bg-[#edf3ff] p-4">
                <p className="text-xs uppercase tracking-wider text-[#5872a0]">For Teachers</p>
                <p className="mt-1 text-sm text-[#2f4b87]">
                  Create class → build assessment → share code → review reports.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <h2 className="text-2xl font-semibold">Core Features</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <article key={feature.title} className="gd-surface p-5">
                <feature.icon size={18} className="text-[#2a4a8b]" />
                <h3 className="mt-3 font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-[#50627f]">{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how" className="border-y border-[#c8d3d9] bg-[#e2eef0]">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
            <h2 className="text-2xl font-semibold">How it Works</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-4">
              {['Create class', 'Build assessment', 'Share access code', 'Review evidence report'].map((step, idx) => (
                <div key={step} className="rounded-2xl border border-[#b7c8d5] bg-[#f3f8fb] p-4">
                  <p className="text-xs font-semibold text-[#6581a8]">Step {idx + 1}</p>
                  <p className="mt-1 text-sm font-medium text-[#2a447f]">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="reviews" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-2xl font-semibold">What Teachers Say</h2>
            <div className="hidden items-center gap-1 text-sm text-[#51637f] sm:flex">
              <Users size={15} />
              200+ educator sessions completed
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {REVIEWS.map((review) => (
              <article key={review.name} className="rounded-2xl border border-[#b7c7d5] bg-[#f4f4f5] p-5 shadow-sm">
                <p className="text-sm leading-relaxed text-[#435878]">&ldquo;{review.quote}&rdquo;</p>
                <div className="mt-4 border-t border-[#d3dbe6] pt-3">
                  <p className="text-sm font-semibold text-[#223a83]">{review.name}</p>
                  <p className="text-xs text-[#61728f]">{review.role}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-[#bccad3] bg-[#dce9eb]">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 px-4 py-10 sm:flex-row sm:items-center sm:px-6">
            <div>
              <p className="text-2xl font-semibold">Ready to run your next oral assessment?</p>
              <p className="mt-1 text-sm text-[#526682]">Sign in to your teacher workspace and launch in minutes.</p>
            </div>
            <Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-[#24408f] px-5 py-3 text-sm font-semibold text-white hover:bg-[#1c3579]">
              Continue to Login
              <ChevronRight size={15} />
            </Link>
          </div>
        </section>
      </main>
    </div>
  )
}
