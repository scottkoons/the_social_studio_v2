# The Social Studio — V1 Spec

## Overview

The Social Studio is a bulk social media scheduling tool for restaurants. Users create posts with starter text and images, AI generates platform-optimized captions and selects optimal posting times, and the app exports Buffer-compatible CSV files for upload.

**Core Principle:** One post = one piece of content that goes to BOTH Facebook and Instagram. Same image, same starter text, same date — but AI generates different captions and picks different optimal times for each platform.

---

## Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Database:** Firebase Firestore
- **Storage:** Firebase Storage (images)
- **Functions:** Firebase Cloud Functions (AI generation, image import)
- **AI:** OpenAI API (caption generation)
- **Styling:** Tailwind CSS
- **Auth:** Firebase Auth (Google sign-in)

---

## Data Model

### Post (Firestore: `workspaces/{workspaceId}/posts/{date}`)

Each post is keyed by date (YYYY-MM-DD). One post per day maximum.

```typescript
interface Post {
  date: string;                    // YYYY-MM-DD (also the doc ID)
  starterText: string;             // User's description of the post
  imageAssetId?: string;           // Reference to uploaded image
  imageUrl?: string;               // Direct URL (from CSV import)
  
  // AI-generated content (populated after generation)
  facebook?: {
    caption: string;
    hashtags: string[];
    scheduledTime: string;         // HH:MM (24hr, Denver time)
    timeSource: 'ai' | 'manual';   // Track if user overrode
  };
  instagram?: {
    caption: string;
    hashtags: string[];
    scheduledTime: string;         // HH:MM (24hr, Denver time)
    timeSource: 'ai' | 'manual';   // Track if user overrode
  };
  
  // Metadata
  status: 'draft' | 'generated' | 'edited' | 'exported';
  aiMeta?: {
    model: string;
    generatedAt: Timestamp;
    confidence: number;
  };
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Asset (Firestore: `workspaces/{workspaceId}/assets/{assetId}`)

```typescript
interface Asset {
  id: string;
  storagePath: string;
  fileName: string;
  contentType: string;
  size: number;
  downloadUrl?: string;
  createdAt: Timestamp;
}
```

### Workspace Settings (Firestore: `workspaces/{workspaceId}`)

```typescript
interface WorkspaceSettings {
  name: string;
  settings: {
    ai: {
      brandVoice: string;          // Custom brand voice instructions
      hashtagStyle: 'minimal' | 'moderate' | 'heavy';
      emojiStyle: 'low' | 'medium' | 'high';
    };
    scheduling: {
      timezone: string;            // Default: 'America/Denver'
      // Future: custom time windows per platform
    };
  };
}
```

---

## AI Scheduling Logic

### Optimal Posting Times (Restaurant-Focused)

The AI scheduler should distribute posts across proven high-engagement windows:

**Facebook:**
- **Primary:** 11:00 AM - 1:00 PM (lunch decision window)
- **Secondary:** 4:30 PM - 6:30 PM (dinner planning)
- People check Facebook during work breaks and planning meals

**Instagram:**
- **Primary:** 11:30 AM - 1:30 PM (lunch scroll)
- **Secondary:** 7:00 PM - 9:00 PM (evening browsing)
- More visual platform, evening engagement is stronger

### Scheduling Rules

1. **Same day, different times:** FB and IG posts for the same content should be scheduled at different times (minimum 2 hour gap recommended)
2. **Vary the windows:** Alternate between primary and secondary windows across the week
3. **Randomize within windows:** Add 5-minute increment randomization to avoid robotic patterns
4. **Weekend adjustments:** Slightly later times on weekends (shift windows +1 hour)

### Day Selection Logic

When generating a schedule for X posts over a date range:
1. Calculate available days (excluding days with existing posts)
2. Prioritize high-engagement days: Thursday, Friday, Saturday, Sunday
3. Spread posts evenly — avoid clustering
4. If posts_per_week > 4, include Tuesday and Wednesday
5. Avoid Monday (lowest restaurant social engagement)

---

## Application Pages

### 1. Dashboard (/)

**Purpose:** Overview and quick stats

**Features:**
- Summary cards: Posts this week, Posts pending generation, Posts ready to export
- Quick actions: "Create Post", "Generate All", "Export to Buffer"
- Recent activity feed
- Link to other sections

**UI Notes:**
- Clean, minimal dashboard
- Use cards with subtle shadows
- Primary accent color for CTAs

---

### 2. Planning (/planning)

**Purpose:** AI-powered bulk schedule generation

**Workflow:**
1. User sets date range (start date, end date)
2. User sets posts per week (slider: 3-7, default 5)
3. Click "Generate Schedule"
4. AI creates schedule with optimal days and times
5. Preview table shows: Date, Day, FB Time, IG Time
6. User can regenerate or manually adjust in preview
7. Click "Apply Schedule" to create posts

**Features:**
- Date range picker (shared for both platforms)
- Posts per week slider with recommendation hint
- "Generate Schedule" button
- Preview table with all scheduled posts
- Edit time inline in preview (before applying)
- "Apply Schedule" creates all posts in Firestore
- CSV Upload option (columns: date, starterText, imageUrl)
  - If date column is empty, AI assigns dates
  - Validates and shows preview before applying

**UI Notes:**
- Two-panel layout: controls on left, preview on right
- Preview table should be scrollable with sticky header
- Use color coding: AI-assigned (default), Manual override (highlighted)
- Drag-and-drop CSV upload zone

---

### 3. Input (/input)

**Purpose:** Add content to scheduled posts

**Features:**
- Table view of all posts sorted by date
- Columns: Date, Day, Image, Starter Text, Status
- Inline editing for starter text (auto-save with debounce)
- Image upload via drag-drop or click
- Image preview with expand/remove options
- Add single post button (date picker modal)
- Bulk select + delete
- Filter: All / Has Content / Missing Content
- Hide past posts toggle

**UI Notes:**
- Clean table with generous row height
- Image thumbnails should be consistent size (aspect ratio preserved)
- Subtle row hover states
- Status badges: Draft (gray), Ready (blue), Generated (green)

---

### 4. Review (/review)

**Purpose:** Generate AI captions and fine-tune

**Features:**
- Card or table view of posts
- Each post shows:
  - Image thumbnail
  - Starter text (read-only here)
  - Facebook caption (editable)
  - Facebook hashtags (editable, pill UI)
  - Facebook scheduled time (editable)
  - Instagram caption (editable)
  - Instagram hashtags (editable, pill UI)
  - Instagram scheduled time (editable)
- "Generate" button per post (or regenerate)
- "Generate All" bulk action
- Regenerate passes previous output to AI for variation
- Visual diff or indicator when user edits AI output
- Platform filter: All / Facebook / Instagram

**UI Notes:**
- Side-by-side layout for FB and IG content
- Editable captions should be textarea with character count
- Time picker should be simple dropdown or input
- Show "AI" badge on times, changes to "Manual" after edit
- Hashtags as removable pills with add input

---

### 5. Calendar (/calendar)

**Purpose:** Visual overview of schedule

**Features:**
- Monthly calendar grid
- Each day shows:
  - Image thumbnail (if exists)
  - FB time badge
  - IG time badge
  - Status indicator
- Click day to open edit modal
- Edit modal allows: change date, edit times, view/edit captions
- Navigate months with arrows
- Today highlighted
- Export month to PDF (optional)

**UI Notes:**
- Clean calendar grid
- Days with posts should stand out (subtle background)
- Compact view — don't overcrowd cells
- Modal for editing, not inline

---

### 6. Export (/export or modal from Review)

**Purpose:** Generate Buffer-compatible CSV files

**Features:**
- Select platforms to export (FB, IG, or both)
- Preview export: count of posts, date range
- Show warnings: posts missing images, posts missing captions
- Export options:
  - Single CSV (if one platform)
  - ZIP with separate CSVs (if both platforms)
- Download button

**Buffer CSV Format:**
```csv
Text,Media URL,Scheduled Date,Scheduled Time
"Caption with hashtags",https://...,2025-01-20,11:30
```

**UI Notes:**
- Can be a modal triggered from Review page
- Clean summary before download
- Success state after download

---

### 7. Settings (/settings)

**Purpose:** Configure workspace and AI behavior

**Features:**
- **Brand Voice:** Textarea for custom AI instructions
- **Hashtag Style:** Radio/toggle (Minimal / Moderate / Heavy)
- **Emoji Style:** Radio/toggle (Low / Medium / High)
- **Timezone:** Dropdown (default America/Denver)
- **Theme:** Light / Dark / System toggle
- **Account:** Display email, sign out button

**UI Notes:**
- Simple form layout
- Auto-save or explicit save button
- Group related settings

---

## UI/UX Guidelines

### Design Principles

1. **Clean & Modern:** Minimal visual clutter, generous whitespace
2. **Logical Flow:** Planning → Input → Review → Export
3. **Forgiving:** Easy to undo, clear confirmations for destructive actions
4. **Responsive:** Works on desktop and tablet (mobile is secondary)
5. **Fast:** Optimistic UI, instant feedback, lazy loading

### Color Palette

Use a cohesive color system:
- **Background:** Light gray (#F9FAFB) / Dark (#111827)
- **Cards:** White (#FFFFFF) / Dark gray (#1F2937)
- **Primary Accent:** Teal/Cyan (#0D9488 or #06B6D4)
- **Facebook indicator:** Blue (#1877F2)
- **Instagram indicator:** Pink/Magenta (#E1306C)
- **Success:** Green (#10B981)
- **Warning:** Amber (#F59E0B)
- **Error:** Red (#EF4444)
- **Text Primary:** Gray 900 / White
- **Text Secondary:** Gray 600 / Gray 400
- **Text Muted:** Gray 400 / Gray 500

### Typography

- **Font:** Inter or system font stack
- **Headings:** Semi-bold, tracking tight
- **Body:** Regular weight, relaxed line height
- **Monospace:** For dates, times, code

### Components to Build

- **PageHeader:** Title, subtitle, action buttons
- **Card:** Container with optional header, padding variants
- **Table:** Sticky header, row hover, selection checkboxes
- **Modal:** Centered, backdrop blur, ESC to close
- **Toast:** Bottom-right notifications, auto-dismiss
- **Button:** Primary, secondary, ghost, danger variants
- **Input:** Text, textarea, date picker, time picker
- **Badge/Pill:** Status indicators, hashtags, platform labels
- **Dropdown:** Select menus, filter options
- **Checkbox/Toggle:** For boolean options
- **Empty State:** Icon, message, CTA for empty views
- **Loading:** Spinner, skeleton loaders

### Interaction Patterns

- **Auto-save:** Debounced saves for text inputs (1 second delay)
- **Optimistic updates:** Update UI immediately, rollback on error
- **Confirmation modals:** For delete, overwrite, bulk actions
- **Drag and drop:** For image uploads, CSV uploads
- **Keyboard shortcuts:** ESC to close modals, Enter to submit

---

## Implementation Phases

### Phase 1: Foundation
- [ ] Project setup (Next.js, Tailwind, Firebase config)
- [ ] Auth flow (Google sign-in, AuthContext)
- [ ] Base layout (Navbar, page structure)
- [ ] Theme system (light/dark mode)
- [ ] Core UI components (Button, Card, Modal, Toast, etc.)

### Phase 2: Data Layer
- [ ] Firestore structure and security rules
- [ ] Post CRUD operations
- [ ] Asset upload to Firebase Storage
- [ ] Real-time listeners for posts

### Phase 3: Planning Page
- [ ] Date range picker
- [ ] Posts per week slider
- [ ] AI scheduling algorithm (day + time selection)
- [ ] Schedule preview table
- [ ] Apply schedule (batch create posts)
- [ ] CSV upload with parsing and validation

### Phase 4: Input Page
- [ ] Posts table with sorting
- [ ] Inline starter text editing (auto-save)
- [ ] Image upload (drag-drop + click)
- [ ] Image preview and remove
- [ ] Add single post
- [ ] Bulk select and delete
- [ ] Filters and hide past toggle

### Phase 5: Review Page
- [ ] Posts list/card view
- [ ] AI caption generation (Cloud Function)
- [ ] Editable captions and hashtags
- [ ] Editable posting times
- [ ] Generate single / Generate all
- [ ] Regenerate with variation
- [ ] Platform filter

### Phase 6: Calendar Page
- [ ] Monthly calendar grid
- [ ] Post indicators on days
- [ ] Click to open edit modal
- [ ] Month navigation
- [ ] Basic responsiveness

### Phase 7: Export
- [ ] Buffer CSV generation
- [ ] Single platform export
- [ ] Multi-platform ZIP export
- [ ] Export modal with preview/warnings

### Phase 8: Settings & Polish
- [ ] Settings page (brand voice, styles, timezone)
- [ ] Dashboard with stats
- [ ] Error handling and edge cases
- [ ] Loading states and skeletons
- [ ] Final UI polish and consistency pass

---

## Firebase Cloud Functions

### generatePostCaptions

Generates AI captions for a single post.

**Input:**
```typescript
{
  workspaceId: string;
  postDate: string;        // YYYY-MM-DD
  regenerate?: boolean;    // If true, create variation
  previousOutputs?: {      // For regeneration
    fbCaption?: string;
    igCaption?: string;
  };
}
```

**Behavior:**
1. Load post data and workspace settings
2. Build prompt with starter text, brand voice, style settings
3. Call OpenAI to generate FB and IG captions
4. Enforce emoji limits server-side
5. Save to Firestore
6. Return success/error

**AI Prompt Structure:**
- System: You are a social media copywriter for a restaurant/brewpub
- Include brand voice instructions
- Specify hashtag density and emoji usage
- Request JSON output with fb and ig objects
- Each contains: caption, hashtags array

### importImageFromUrl

Downloads image from URL and saves to Firebase Storage.

**Input:**
```typescript
{
  workspaceId: string;
  postDate: string;
  imageUrl: string;
}
```

**Behavior:**
1. Validate URL format
2. Fetch image (with timeout)
3. Validate content-type and size
4. Upload to Storage
5. Create asset document
6. Link asset to post
7. Return success with downloadUrl or skip reason

---

## Success Criteria

The app is complete when:

1. **Planning works:** Can generate a schedule, preview it, and apply it
2. **CSV import works:** Can upload CSV with dates/text/imageUrls, drag-drop functional
3. **Image upload works:** Can drag-drop or click to upload images on Input page
4. **AI generation works:** Can generate captions for all posts, with platform-specific optimization
5. **Time editing works:** Can manually override AI-suggested times
6. **Export works:** Can export Buffer-compatible CSVs for both platforms
7. **UI is polished:** Clean, modern, responsive, consistent
8. **No console errors:** Clean browser console in normal operation

---

## Notes for Ralph

- **Start fresh:** Do not try to migrate or preserve existing code patterns
- **Reimagine the UI:** Feel free to improve layouts, flows, component design
- **Test drag-and-drop:** Ensure react-dropzone is configured correctly with `useFsAccessApi: false`
- **Document IDs:** Posts use date (YYYY-MM-DD) as the doc ID — simple and clean
- **Timezone:** All times are Denver timezone (America/Denver)
- **Error handling:** Show user-friendly errors, log details to console
- **Mobile:** Desktop-first, but should be usable on tablet

---

## Appendix: Sample AI Prompt

```
You are a social media copywriter for Colorado Mountain Brewery, a craft brewpub in Colorado Springs.

BRAND VOICE: {brandVoice from settings}

Create engaging social media posts for both Facebook and Instagram based on this description:
"{starterText}"

REQUIREMENTS:
- Facebook: Conversational tone, can be slightly longer, focus on community and experience
- Instagram: Punchy, visual-first language, strong hook in first line
- Hashtags: {hashtagStyle} density
- Emojis: {emojiStyle} usage
- Do NOT reference or describe images — only use the text description provided
- Include a call-to-action when appropriate (visit us, stop by, try it today, etc.)

Return JSON only:
{
  "facebook": {
    "caption": "...",
    "hashtags": ["...", "..."]
  },
  "instagram": {
    "caption": "...",
    "hashtags": ["...", "..."]
  },
  "confidence": 0.0-1.0
}
```
