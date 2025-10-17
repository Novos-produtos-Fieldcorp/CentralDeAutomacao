# Fix: Tag Creation on Netlify Deployment

## Problem
Tag creation was failing in the Netlify deployment with a **422 Unprocessable Content** error when calling the Supabase Edge Function endpoint:
- **Endpoint**: `POST /api/wiseapp/{accountId}/labels`
- **Error**: 422 Unprocessable Content
- **Root Cause**: Request body format mismatch

## Root Cause Analysis

The frontend was sending:
```json
{
  "name": "tag-name",
  "color": "#3B82F6"
}
```

But the WiseApp API expects:
```json
{
  "title": "tag-name",
  "color": "#3B82F6",
  "description": ""
}
```

The Supabase Edge Function was **not transforming** the request body, just passing it through directly to the WiseApp API, causing the validation error.

## Solution

Updated the Supabase Edge Function (`supabase/functions/api/index.ts`) to:

1. **Parse the request body as JSON** (instead of raw text)
2. **Transform the format** from `{name, color}` to `{title, color, description}`
3. **Handle duplicate tags** (422 error) by fetching and returning the existing tag
4. **Transform the response** back to our format `{id, name, color, description}`

### Key Changes

```typescript
// Before (line 347):
const requestBody = await req.text()

// After (lines 352-362):
const requestData = await req.json()
const wiseAppPayload = {
  title: requestData.name,
  color: requestData.color || '#3B82F6',
  description: requestData.description || ''
}
```

## Deployment

To deploy the fix to production:

```bash
cd supabase
npx supabase functions deploy api
```

Or push to your repository if you have CI/CD configured to auto-deploy Supabase Edge Functions.

## Testing

After deployment, create a new tag:
1. Go to Tag Administration
2. Click "Novo Marcador"
3. Enter a tag name (e.g., "teste-tag")
4. Select a color
5. Click Save

The tag should now be created successfully in both the local database and WiseApp.

## Files Changed

- ✅ `supabase/functions/api/index.ts` - Fixed POST /wiseapp/:companyId/labels handler

## Additional Notes

- The fix also handles the case where a tag already exists in WiseApp (422 error)
- When a duplicate is detected, it fetches and returns the existing tag instead of failing
- All responses are properly formatted to match the frontend's expected structure
