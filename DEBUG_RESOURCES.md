# Debug Guide: Embed Resources Not Loading

## Issue
Custom embed HTML (type: 'embed' with embedHtml field) works in preview but doesn't render during student sessions.

## Root Cause Analysis

### Data Flow
1. Teacher creates assessment → ResourceBuilder → `resources` array with `embedHtml`
2. Form submits → `supabase.from('assessments').insert({ resources })`
3. API route fetches → `assessment.resources as unknown[]`
4. Client receives → ResourcePanel renders

### Potential Issues
1. **Database serialization**: JSONB column may be stripping `embedHtml`
2. **API type casting**: `as unknown[]` may lose type information
3. **Database retrieval**: SELECT query may not include all fields

## Debugging Steps

### Step 1: Check Database Content

Run this SQL query in Supabase SQL Editor:

```sql
SELECT
  id,
  title,
  resources
FROM assessments
WHERE jsonb_array_length(resources) > 0
ORDER BY created_at DESC
LIMIT 5;
```

**Expected**: You should see full resource objects including `embedHtml` field.
**If missing**: Database is stripping the field during insert.

### Step 2: Check API Response

Add console logging to `/app/api/ai/question/route.ts`:

```typescript
// After line 68 (after fetching session)
console.log('[DEBUG] Raw assessment.resources:',
  JSON.stringify(assessment.resources, null, 2))
```

Then check browser DevTools Network tab:
- Look for `/api/ai/question` request
- Check the response JSON
- Verify `resources` array contains `embedHtml`

**Expected**: Full resource objects with all fields
**If missing**: API is not returning the field

### Step 3: Check Client State

Add logging to `/app/(student)/session/[id]/page.tsx`:

```typescript
// After line 193
if (Array.isArray(data.resources)) {
  console.log('[DEBUG] Resources received:', data.resources)
  setResources(data.resources as EmbedResource[])
}
```

Check browser console during session start.

**Expected**: Resources array with embedHtml intact
**If missing**: Data is being lost in transit

### Step 4: Check Component Rendering

Add logging to `/components/assessment/ResourcePanel.tsx`:

```typescript
// At the top of ResourceFrame function (line 19)
console.log('[DEBUG] ResourceFrame rendering:', resource)
```

**Expected**: You should see the full resource object
**If missing**: React is not receiving the data

## Common Fixes

### Fix 1: Explicit JSONB Handling

If database is stripping fields, ensure proper JSONB insert:

```typescript
// In NewAssessmentForm.tsx, line 112
resources: JSON.parse(JSON.stringify(resources)), // Force proper serialization
```

### Fix 2: Proper Type Casting in API

Change line 207 in `/app/api/ai/question/route.ts`:

```typescript
// Before (problematic)
resources: (assessment.resources as unknown[]) ?? [],

// After (explicit typing)
resources: (assessment.resources as EmbedResource[]) ?? [],
```

### Fix 3: Ensure SELECT Includes JSONB

Verify line 68 in `/app/api/ai/question/route.ts` has `resources` in SELECT:

```typescript
.select('*, assessments(topic, year_group, system_prompt, topic_context, max_questions, criteria, resources)')
```

This looks correct already.

### Fix 4: Check Resource Rendering Logic

In ResourcePanel.tsx, the logic at line 20-28 should handle embedHtml:

```typescript
if (resource.type === 'embed' && resource.embedHtml) {
  return (
    <div
      className="w-full rounded-xl overflow-hidden border border-[#b6c9cf]"
      style={{ minHeight: 340 }}
      dangerouslySetInnerHTML={{ __html: resource.embedHtml }}
    />
  )
}
```

This looks correct. The issue is likely earlier in the chain.

## Quick Test

Create a test assessment with a simple embed:

```html
<iframe src="https://www.example.com" width="800" height="500"></iframe>
```

Then immediately query the database to verify storage:

```sql
SELECT resources FROM assessments ORDER BY created_at DESC LIMIT 1;
```

If you see the embedHtml there, the issue is in retrieval/rendering.
If you don't see it, the issue is in storage.

## Next Steps

1. Run Step 1 (database check) first
2. Based on results, apply appropriate fix
3. Test with a new assessment
4. If still failing, add all debug logs and check the full data flow
