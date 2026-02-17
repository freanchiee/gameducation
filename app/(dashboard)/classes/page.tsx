import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PlusCircle, Users, BookOpen } from 'lucide-react'

export default async function ClassesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: classes } = await supabase
    .from('classes')
    .select('*, class_enrolments(count)')
    .eq('teacher_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Classes</h1>
          <p className="text-gray-500 mt-1">Manage your MYP and IB classes</p>
        </div>
        <Link
          href="/classes/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          <PlusCircle size={16} />
          New Class
        </Link>
      </div>

      {classes && classes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <Link
              key={cls.id}
              href={`/classes/${cls.id}`}
              className="block p-6 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex justify-between items-start mb-3">
                <span className="px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-full">
                  {cls.programme} {cls.year_group}
                </span>
                <span className="text-xs text-gray-400">{cls.subject}</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{cls.name}</h3>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Users size={14} />
                  {cls.class_enrolments?.[0]?.count ?? 0} students
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen size={14} />
                  View assessments
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <Users size={40} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No classes yet</h3>
          <p className="text-gray-500 mb-6">Create your first class to get started with VoiceIQ.</p>
          <Link
            href="/classes/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
          >
            <PlusCircle size={16} />
            Create a class
          </Link>
        </div>
      )}
    </div>
  )
}
