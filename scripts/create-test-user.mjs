import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const TEST_EMAIL = process.env.TEST_TEACHER_EMAIL || 'test.teacher@voiceiq.local'
const TEST_PASSWORD = process.env.TEST_TEACHER_PASSWORD || 'TestPass!123'
const TEST_FULL_NAME = process.env.TEST_TEACHER_NAME || 'Test Teacher'
const TEST_SCHOOL = process.env.TEST_TEACHER_SCHOOL || 'Demo School'

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.')
  process.exit(1)
}

if (!SUPABASE_URL.includes('.supabase.co')) {
  console.error('NEXT_PUBLIC_SUPABASE_URL must be a Supabase API URL like https://<project-ref>.supabase.co')
  process.exit(1)
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function ensureTestUser() {
  const { data: usersData, error: listError } = await admin.auth.admin.listUsers()
  if (listError) {
    throw listError
  }

  const existing = usersData.users.find((u) => u.email?.toLowerCase() === TEST_EMAIL.toLowerCase())
  if (existing) {
    console.log('Test user already exists.')
    console.log(`Email: ${TEST_EMAIL}`)
    console.log(`Password: ${TEST_PASSWORD}`)
    return
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: TEST_FULL_NAME,
      school_name: TEST_SCHOOL,
      role: 'teacher',
    },
  })

  if (error) {
    throw error
  }

  console.log('Created test teacher account.')
  console.log(`User ID: ${data.user.id}`)
  console.log(`Email: ${TEST_EMAIL}`)
  console.log(`Password: ${TEST_PASSWORD}`)
}

ensureTestUser().catch((err) => {
  console.error('Failed to ensure test user:', err?.message || err)
  process.exit(1)
})
