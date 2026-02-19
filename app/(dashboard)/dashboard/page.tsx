import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  BookOpenCheck,
  ClipboardList,
  PlayCircle,
  Users,
} from 'lucide-react'

export default async function TeacherDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: classes } = await supabase
    .from('classes')
    .select('id, name, year_group, programme')
    .eq('teacher_id', user!.id)
    .order('created_at', { ascending: false })

  const classIds = (classes ?? []).map((c) => c.id)

  const { data: assessments } = classIds.length
    ? await supabase
        .from('assessments')
        .select('id, title, status, access_code, created_at')
        .in('class_id', classIds)
        .order('created_at', { ascending: false })
    : { data: [] as Array<{ id: string; title: string; status: string; access_code: string | null; created_at: string }> }

  const assessmentIds = (assessments ?? []).map((a) => a.id)

  const { data: sessions } = assessmentIds.length
    ? await supabase
        .from('sessions')
        .select('id, assessment_id, status, mode, started_at')
        .in('assessment_id', assessmentIds)
        .order('started_at', { ascending: false })
        .limit(8)
    : { data: [] as Array<{ id: string; assessment_id: string; status: string; mode: string; started_at: string | null }> }

  const sessionIds = (sessions ?? []).map((s) => s.id)
  const { data: evaluations } = sessionIds.length
    ? await supabase
        .from('evaluations')
        .select('id')
        .in('session_id', sessionIds)
    : { data: [] as Array<{ id: string }> }

  const totalClasses = classes?.length ?? 0
  const totalAssessments = assessments?.length ?? 0
  const activeAssessments = (assessments ?? []).filter((a) => a.status === 'active').length
  const totalEvaluations = evaluations?.length ?? 0

  const assessmentTitleById = new Map((assessments ?? []).map((a) => [a.id, a.title]))
  const recentSessions = (sessions ?? []).slice(0, 5)

  return (
    <div className="space-y-7">
      <section className="rounded-3xl border border-[#9fb4bf] bg-gradient-to-br from-[#27428e] via-[#2f558f] to-[#2d7f92] px-6 py-8 text-white shadow-lg">
        <p className="text-xs uppercase tracking-[0.2em] text-white/75 mb-2">Teacher Command Center</p>
        <h1 className="text-3xl font-semibold leading-tight">Welcome back to VoiceIQ</h1>
        <p className="mt-3 max-w-2xl text-sm text-white/85">
          Run oral assessments, track concept mastery, and review AI-supported evidence without breaking your teaching flow.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/assessments/new"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#223a83] transition hover:bg-[#f4f7ff]"
          >
            Create Assessment
            <ArrowRight size={14} />
          </Link>
          <Link
            href="/reports"
            className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            View Reports
            <BarChart3 size={14} />
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="gd-surface p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-[#6a7792]">Classes</p>
            <Users size={15} className="text-[#5b6a86]" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-[#223a83]">{totalClasses}</p>
          <p className="mt-1 text-xs text-[#60718b]">Learning groups you manage</p>
        </article>

        <article className="gd-surface p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-[#6a7792]">Assessments</p>
            <ClipboardList size={15} className="text-[#5b6a86]" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-[#223a83]">{totalAssessments}</p>
          <p className="mt-1 text-xs text-[#60718b]">Total oral assessments</p>
        </article>

        <article className="gd-surface p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-[#6a7792]">Active Codes</p>
            <PlayCircle size={15} className="text-[#5b6a86]" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-[#223a83]">{activeAssessments}</p>
          <p className="mt-1 text-xs text-[#60718b]">Assessments students can join now</p>
        </article>

        <article className="gd-surface p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-[#6a7792]">Evaluations</p>
            <BookOpenCheck size={15} className="text-[#5b6a86]" />
          </div>
          <p className="mt-2 text-3xl font-semibold text-[#223a83]">{totalEvaluations}</p>
          <p className="mt-1 text-xs text-[#60718b]">Scored sessions in recent activity</p>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.6fr_1fr]">
        <div className="gd-surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#d8deea] bg-[#ece6bf] px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[#223a83]">Recent Session Activity</h2>
            <Link href="/reports" className="text-xs font-medium text-[#26428b] hover:text-[#1a3273]">
              Open reports
            </Link>
          </div>
          {recentSessions.length > 0 ? (
            <ul className="divide-y divide-[#d8deea]">
              {recentSessions.map((session) => (
                <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-[#223a83]">
                      {assessmentTitleById.get(session.assessment_id) ?? 'Assessment'}
                    </p>
                    <p className="text-xs text-[#6c7892]">
                      {session.started_at
                        ? new Date(session.started_at).toLocaleString()
                        : 'Not started yet'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-[#bcc8de] bg-[#eef2fa] px-2 py-0.5 text-xs text-[#35528f]">
                      {session.mode}
                    </span>
                    <span
                      className={[
                        'rounded-full px-2 py-0.5 text-xs font-medium',
                        session.status === 'completed'
                          ? 'bg-emerald-100 text-emerald-700'
                          : session.status === 'active'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600',
                      ].join(' ')}
                    >
                      {session.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-10 text-center">
              <p className="text-sm text-[#5f7090]">No sessions yet. Share an active assessment code to begin.</p>
            </div>
          )}
        </div>

        <aside className="gd-surface p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[#223a83]">Quick Actions</h2>
          <div className="mt-4 space-y-2">
            <Link href="/classes/new" className="block rounded-xl border border-[#b9c7de] bg-[#edf2fb] px-3 py-2 text-sm font-medium text-[#24408f] hover:bg-[#e1e9f7]">
              Create a class
            </Link>
            <Link href="/assessments/new" className="block rounded-xl border border-[#b9c7de] bg-[#edf2fb] px-3 py-2 text-sm font-medium text-[#24408f] hover:bg-[#e1e9f7]">
              Build a new assessment
            </Link>
            <Link href="/assessments" className="block rounded-xl border border-[#b9c7de] bg-[#edf2fb] px-3 py-2 text-sm font-medium text-[#24408f] hover:bg-[#e1e9f7]">
              Activate assessment codes
            </Link>
            <Link href="/reports" className="block rounded-xl border border-[#b9c7de] bg-[#edf2fb] px-3 py-2 text-sm font-medium text-[#24408f] hover:bg-[#e1e9f7]">
              Review student reports
            </Link>
          </div>
        </aside>
      </section>
    </div>
  )
}
