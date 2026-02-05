# Phoenix Voice: Codebase Master Guide

> **Your goal**: After reading this guide, you'll be able to confidently navigate, understand, and modify any part of this codebase. You'll know *what* each piece does, *why* we built it that way, and *where* to go to change things.

**What this app does**: Converts PDF documents into natural-sounding audio, with streaming playback that starts in ~10 seconds while the rest generates in the background.

---

## Table of Contents

- [Part 0: How to Read This Code](#part-0-how-to-read-this-code)
- [Part 1: The Mental Model](#part-1-the-mental-model)
- [Part 2: The Journey of a PDF](#part-2-the-journey-of-a-pdf)
- [Part 3: TTS Deep Dive](#part-3-tts-deep-dive) (Priority Section)
- [Part 4: Module Reference Cards](#part-4-module-reference-cards)
- [Part 5: The Decision Log](#part-5-the-decision-log)
- [Part 6: Navigation Cheat Sheet](#part-6-navigation-cheat-sheet)
- [Part 7: Hands-On Exercises](#part-7-hands-on-exercises)

---

# Part 0: How to Read This Code

Before diving into *what* the code does, let's learn *how* to read it. This codebase uses TypeScript, React, and Next.js. Here's your survival guide using examples from YOUR actual code.

## File Types at a Glance

```
.ts   → Pure logic (no UI). Functions, classes, utilities.
.tsx  → UI components (React). Anything that renders something visual.
route.ts → API endpoints. Code that runs on the server when someone hits a URL.
```

**Examples from this codebase:**
- `lib/tts.ts` - Logic for generating audio (no UI)
- `components/StreamingPlayer.tsx` - The audio player UI (React component)
- `app/api/upload/route.ts` - The `/api/upload` endpoint (server code)

---

## Reading TypeScript: The Basics

### 1. Type Annotations (`: Type`)

When you see `: something`, it's telling you what type of data is expected.

```typescript
// From lib/tts/types.ts:6-10
export interface TTSProvider {
  name: string;                    // name must be text
  priority: number;                // priority must be a number
  costPer1MChars: number;          // cost must be a number
  maxCharsPerChunk: number;        // max chars must be a number
}
```

**Plain English**: "Any TTS provider must have these 4 properties, and they must be these specific types."

### 2. Interfaces (Contracts)

An `interface` is a contract. It says "anything claiming to be this type MUST have these properties."

```typescript
// From lib/tts/types.ts:6-32
export interface TTSProvider {
  name: string;
  priority: number;
  costPer1MChars: number;
  maxCharsPerChunk: number;

  // Methods this provider must have:
  isAvailable(): Promise<boolean>;
  synthesize(text: string, options?: TTSOptions): Promise<Buffer>;
  estimateCost(text: string | number): number;
  getMetrics(): TTSMetrics;
}
```

**Plain English**: "Every TTS provider in our system (DeepInfra, OpenAI, etc.) MUST implement all these methods. This is the contract they sign."

### 3. `async` / `await` (Waiting for Things)

When you see `async` and `await`, it means "this operation takes time, wait for it to finish."

```typescript
// From lib/deepseek.ts:122-125
export async function extractPDF(pdfPath: string): Promise<{
  markdown: string;
  pageCount: number;
}> {
```

**Plain English**:
- `async` = "This function does something that takes time (like calling an API)"
- `Promise<{...}>` = "Eventually, I'll give you back an object with markdown and pageCount"
- When calling this function, use `await` to wait for it:

```typescript
// From app/api/process-stream/[id]/route.ts:110
const { markdown: rawText, pageCount } = await extractPDF(pdfPath);
```

**Plain English**: "Call extractPDF, wait for it to finish, then store the results in rawText and pageCount."

### 4. Arrow Functions (`=>`)

These are just compact ways to write functions:

```typescript
// Traditional function
function add(a, b) {
  return a + b;
}

// Arrow function (same thing)
const add = (a, b) => a + b;

// From components/StreamingPlayer.tsx:18-22
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
```

### 5. Destructuring (`{ }`)

Pulling values out of objects:

```typescript
// Without destructuring
const result = await extractPDF(pdfPath);
const rawText = result.markdown;
const pageCount = result.pageCount;

// With destructuring (same thing, cleaner)
const { markdown: rawText, pageCount } = await extractPDF(pdfPath);
```

**Plain English**: "Get the markdown property and call it rawText, and also get pageCount."

---

## Reading React: The Basics

### 1. Components

A component is a reusable piece of UI. It's just a function that returns what to display.

```typescript
// From components/StreamingPlayer.tsx:38
export function StreamingPlayer({ documentId, fileName, file, onReset }: Props) {
  // ... component logic ...

  return (
    <motion.div style={{ width: '100%' }}>
      {/* This is what gets displayed */}
    </motion.div>
  );
}
```

**Plain English**: "StreamingPlayer is a component. Give it a documentId, fileName, file, and onReset callback, and it will render an audio player."

### 2. Props (Parameters for Components)

Props are the inputs to a component:

```typescript
// From components/StreamingPlayer.tsx:24-29
interface Props {
  documentId: string;    // The job ID
  fileName: string;      // Display name
  file: File;            // The actual PDF file
  onReset: () => void;   // Function to call when user clicks "close"
}
```

**Using it:**
```typescript
// From app/page.tsx:134-139
<StreamingPlayer
  documentId={jobId}
  fileName={fileName}
  file={file}
  onReset={reset}
/>
```

### 3. useState (Remembering Things)

`useState` creates a value that the component "remembers" and can update:

```typescript
// From components/StreamingPlayer.tsx:39-48
const [chunks, setChunks] = useState<AudioChunk[]>([]);
const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
const [isPlaying, setIsPlaying] = useState(false);
const [status, setStatus] = useState<'connecting' | 'extracting' | 'processing' | 'complete' | 'error'>('connecting');
```

**Pattern**: `const [value, setValue] = useState(initialValue);`

- `value` - The current value
- `setValue` - Function to update it
- `initialValue` - What it starts as

**Plain English**: "`isPlaying` starts as `false`. When we call `setIsPlaying(true)`, it becomes `true` and the component re-renders."

### 4. useEffect (Doing Things When Stuff Happens)

`useEffect` runs code when the component loads or when certain values change:

```typescript
// From components/StreamingPlayer.tsx:53-112
useEffect(() => {
  // This code runs when the component first appears
  async function start() {
    // Connect to the streaming API...
  }
  start();

  // This runs when the component is removed (cleanup)
  return () => {
    aborted = true;
    controller.abort();
  };
}, [documentId, file]); // Re-run if documentId or file changes
```

**Pattern**: `useEffect(() => { /* do stuff */ }, [dependencies]);`

- Empty `[]` = Run once when component loads
- `[documentId, file]` = Run when component loads AND whenever these values change
- Return function = Cleanup when component is removed

### 5. useRef (Grabbing DOM Elements)

`useRef` lets you directly access a DOM element (like an audio player):

```typescript
// From components/StreamingPlayer.tsx:50
const audioRef = useRef<HTMLAudioElement>(null);

// Later, in JSX:
<audio ref={audioRef} onEnded={handleChunkEnd} />

// Using it:
audioRef.current.play();  // Play the audio
audioRef.current.pause(); // Pause it
audioRef.current.src = newUrl; // Change the source
```

### 6. useCallback (Stable Function References)

`useCallback` creates a function that doesn't change every render:

```typescript
// From components/StreamingPlayer.tsx:168-183
const togglePlay = useCallback(() => {
  if (!audioRef.current) return;

  if (isPlaying) {
    audioRef.current.pause();
    setIsPlaying(false);
  } else {
    // ... play logic
  }
}, [isPlaying, chunks, currentChunkIndex]);
```

**Plain English**: "Create a togglePlay function. Only recreate it if isPlaying, chunks, or currentChunkIndex changes."

---

## Reading Next.js: API Routes

### The Pattern

API routes in Next.js App Router live in `app/api/[route-name]/route.ts`:

```
app/api/upload/route.ts        → POST /api/upload
app/api/process-stream/[id]/route.ts → POST /api/process-stream/abc123
app/api/download/[id]/route.ts → GET /api/download/abc123
```

### Anatomy of a Route

```typescript
// From app/api/upload/route.ts:16-62
export async function POST(req: NextRequest) {
  try {
    // 1. Get data from the request
    const formData = await req.formData();
    const file = formData.get('file') as File;

    // 2. Validate
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // 3. Do the work
    const jobId = randomUUID();
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(`/tmp/${jobId}.pdf`, buffer);

    // 4. Return response
    return NextResponse.json({ jobId, fileName: file.name, fileSize: file.size });
  } catch (error) {
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
```

**The function name matters:**
- `POST` = Handle POST requests
- `GET` = Handle GET requests
- `PUT`, `DELETE`, etc.

### Dynamic Routes (`[id]`)

The `[id]` in the path becomes a parameter:

```typescript
// From app/api/process-stream/[id]/route.ts:22-28
export async function POST(
  req: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  const { id } = params;  // 'id' is whatever was in the URL
```

**Plain English**: If someone calls `/api/process-stream/abc123`, then `id` will be `"abc123"`.

---

## Reading This Codebase: Common Patterns

### 1. The Provider Pattern (TTS)

We have multiple TTS providers that all follow the same interface:

```typescript
// Each provider implements TTSProvider:
class DeepInfraProvider implements TTSProvider { ... }
class OpenAIProvider implements TTSProvider { ... }
class OrpheusProvider implements TTSProvider { ... }

// The manager can use any of them interchangeably:
const provider = await this.getPrimaryProvider();
const audio = await provider.synthesize(text);
```

### 2. Streaming with SSE (Server-Sent Events)

The server sends events to the client in real-time:

```typescript
// Server side (process-stream route):
const sendEvent = (event: StreamEvent) => {
  controller.enqueue(encoder.encode(event));  // Send to client
};

sendEvent({ type: 'chunk_ready', audioData: base64Audio, ... });

// Client side (StreamingPlayer):
const reader = res.body?.getReader();
while (true) {
  const { done, value } = await reader.read();
  // Parse the event and update state
}
```

### 3. The Fallback Chain

Try the cheapest option first, fall back to more expensive ones:

```typescript
// From lib/tts/manager.ts:122-153
while (selectedProvider) {
  try {
    const audio = await selectedProvider.synthesize(text);
    return audio;  // Success!
  } catch (error) {
    // Try next provider
    selectedProvider = await this.getNextProvider(attemptedProviders);
  }
}
```

---

## Quick Reference: Syntax Cheat Sheet

| Syntax | Meaning | Example |
|--------|---------|---------|
| `: Type` | Type annotation | `name: string` |
| `interface X { }` | Define a contract | `interface TTSProvider { }` |
| `async/await` | Wait for async operations | `await extractPDF(path)` |
| `=>` | Arrow function | `(x) => x * 2` |
| `{ a, b }` | Destructure object | `const { markdown } = result` |
| `useState` | Component state | `const [x, setX] = useState(0)` |
| `useEffect` | Side effects | `useEffect(() => {}, [])` |
| `useRef` | DOM reference | `audioRef.current.play()` |
| `export` | Make available to other files | `export function foo() { }` |
| `import` | Use from another file | `import { foo } from './file'` |

---

# Part 1: The Mental Model

## The Big Picture: 4 Stations

Think of this app like a restaurant kitchen with 4 stations:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PHOENIX VOICE PIPELINE                          │
└─────────────────────────────────────────────────────────────────────────┘

  USER                                                              AUDIO
   │                                                                  ▲
   ▼                                                                  │
┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌────────────┐
│ STATION 1│───▶│  STATION 2   │───▶│  STATION 3   │───▶│ STATION 4  │
│  Upload  │    │  Processing  │    │     TTS      │    │  Streaming │
│          │    │              │    │              │    │            │
│ Receive  │    │ Extract text │    │ Generate     │    │ Send audio │
│ PDF file │    │ Clean it up  │    │ audio chunks │    │ to player  │
│          │    │ Narrate      │    │              │    │            │
│          │    │ tables/imgs  │    │              │    │            │
└──────────┘    └──────────────┘    └──────────────┘    └────────────┘
     │                 │                   │                   │
     ▼                 ▼                   ▼                   ▼
  /tmp/id.pdf    cleaned text         MP3 chunks          SSE events
```

### Station 1: Upload (Receiving)
**Files**: `app/api/upload/route.ts`, `components/Upload.tsx`

User drops a PDF → We validate it → Save to `/tmp/[jobId].pdf`

### Station 2: Processing (Prep Kitchen)
**Files**: `lib/deepseek.ts`, `lib/cleaning.ts`, `lib/claude.ts`

Extract text with OCR → Find tables and images → Have Claude describe them naturally → Clean up the text for narration

### Station 3: TTS (Audio Cooking)
**Files**: `lib/tts.ts`, `lib/tts/manager.ts`, `lib/tts/providers/*`

Split text into chunks → Send each chunk to TTS provider → Get back MP3 audio → Use cheapest provider that works

### Station 4: Streaming (Serving)
**Files**: `app/api/process-stream/[id]/route.ts`, `components/StreamingPlayer.tsx`

As each audio chunk is ready → Send it to the browser immediately → Player starts playing while next chunks generate

---

## The Magic of Streaming

**Without streaming** (old way):
```
Upload → Wait 2-5 minutes → Get all audio → Play
```

**With streaming** (what we built):
```
Upload → 10 seconds → First chunk plays
         │
         └──▶ While you're listening to chunk 1...
              chunks 2, 3, 4... are generating in the background
```

**Why this matters**: A 50-page PDF might take 3 minutes to fully process. But you start listening in 10 seconds.

---

## Data Flow Diagram

```
                             ┌─────────────────────────────────────────┐
                             │                USER                     │
                             │         (drops PDF file)                │
                             └────────────────┬────────────────────────┘
                                              │
                                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Browser)                            │
│  ┌──────────────┐    ┌───────────────────┐    ┌──────────────────────┐ │
│  │  Upload.tsx  │───▶│     page.tsx      │───▶│ StreamingPlayer.tsx  │ │
│  │  (drag-drop) │    │  (orchestrator)   │    │   (audio player)     │ │
│  └──────────────┘    └────────┬──────────┘    └──────────▲───────────┘ │
└───────────────────────────────┼───────────────────────────┼─────────────┘
                                │                           │
                    POST /api/  │                      SSE events
                    process-    │                     (chunk_ready)
                    stream/{id} │                           │
                                ▼                           │
┌─────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (Server)                              │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │              process-stream/[id]/route.ts                          │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │ │
│  │  │ extractPDF  │─▶│ narrateTables│─▶│ cleanText   │─▶│ chunkText │  │ │
│  │  │(deepseek.ts)│  │ (claude.ts) │  │(cleaning.ts)│  │           │  │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └─────┬─────┘  │ │
│  │                                                           │        │ │
│  │                                    ┌──────────────────────▼──────┐ │ │
│  │                                    │    FOR EACH CHUNK:          │ │ │
│  │                                    │    ┌─────────────────────┐  │ │ │
│  │                                    │    │ generateAudio()     │  │ │ │
│  │                                    │    │ (lib/tts.ts)        │  │ │ │
│  │                                    │    │        │            │  │ │ │
│  │                                    │    │        ▼            │  │ │ │
│  │                                    │    │ ┌───────────────┐   │  │ │ │
│  │                                    │    │ │  TTSManager   │   │  │ │ │
│  │                                    │    │ │ (manager.ts)  │   │  │ │ │
│  │                                    │    │ └───────┬───────┘   │  │ │ │
│  │                                    │    │         │           │  │ │ │
│  │                                    │    │ Try providers:      │  │ │ │
│  │                                    │    │ 1. DeepInfra $0.62  │  │ │ │
│  │                                    │    │ 2. Orpheus $15      │  │ │ │
│  │                                    │    │ 3. MiniMax $30      │  │ │ │
│  │                                    │    │ 4. OpenAI $30       │  │ │ │
│  │                                    │    └─────────────────────┘  │ │ │
│  │                                    │              │              │ │ │
│  │                                    │              ▼              │ │ │
│  │                                    │    Send SSE: chunk_ready   ─┼─┼─┘
│  │                                    │    with base64 audio        │ │
│  │                                    └─────────────────────────────┘ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## The File System: Where Everything Lives

```
pdf-voice-tool/
│
├── app/                          # Next.js App Router
│   ├── page.tsx                 # Main UI (the orchestrator)
│   ├── layout.tsx               # App shell (fonts, metadata)
│   ├── globals.css              # Global styles
│   │
│   └── api/                     # API Routes (server code)
│       ├── upload/route.ts             # POST /api/upload
│       ├── process-stream/[id]/route.ts # POST /api/process-stream/{id}
│       ├── process/[id]/route.ts       # POST /api/process/{id} (non-streaming)
│       ├── audio/[id]/route.ts         # GET /api/audio/{id}
│       ├── audio-chunk/[id]/[index]/route.ts # GET /api/audio-chunk/{id}/{index}
│       └── download/[id]/route.ts      # GET /api/download/{id}
│
├── components/                   # React Components (UI)
│   ├── StreamingPlayer.tsx      # The progressive audio player
│   ├── Upload.tsx               # File upload with drag-drop
│   ├── Player.tsx               # Simple audio player (non-streaming)
│   └── Preview.tsx              # Stats display
│
├── lib/                         # Business Logic (no UI)
│   ├── types.ts                 # Shared TypeScript types
│   │
│   ├── # EXTRACTION LAYER
│   ├── deepseek.ts              # PDF → text via OCR
│   ├── deepinfra-ocr.ts         # Alternative OCR endpoint
│   ├── html-tables.ts           # Find <table> elements
│   ├── images.ts                # Extract and describe images
│   │
│   ├── # INTELLIGENCE LAYER
│   ├── deepinfra-llm.ts         # DeepInfra LLM client (text + vision)
│   ├── claude.ts                # Table/image narration via DeepInfra
│   ├── fal.ts                   # Fal.ai artwork generation
│   │
│   ├── # TEXT PROCESSING
│   ├── cleaning.ts              # Main cleaning orchestrator
│   ├── text-cleaner.ts          # Detailed cleaning functions
│   │
│   ├── # TTS LAYER
│   ├── tts.ts                   # TTS entry point
│   ├── tts/
│   │   ├── types.ts             # TTSProvider interface
│   │   ├── manager.ts           # Provider selection & fallback
│   │   └── providers/
│   │       ├── deepinfra.ts     # $0.62/M chars (PRIMARY)
│   │       ├── orpheus.ts       # $15/M chars
│   │       ├── minimax.ts       # $30/M chars
│   │       └── openai.ts        # $30/M chars (FALLBACK)
│   │
│   ├── # STREAMING LAYER
│   ├── streaming/
│   │   ├── chunk-manager.ts     # Chunk storage & concatenation
│   │   ├── sse-helpers.ts       # SSE encoding utilities
│   │   └── types.ts             # Event types (incl. artwork_generating, artwork_ready)
│   │
│   ├── # UTILITIES
│   ├── cost.ts                  # Cost calculations (incl. artwork at $0.15)
│   └── motion.ts                # Animation configs
│
├── docs/                        # Documentation
│   ├── CODEBASE-EXPLAINER.md    # THIS FILE
│   └── ...
│
└── /tmp/                        # Temporary file storage (on server)
    ├── {jobId}.pdf              # Uploaded PDF
    ├── {jobId}.mp3              # Final concatenated audio
    └── {jobId}-chunks/          # Individual audio chunks
        ├── 0.mp3
        ├── 1.mp3
        └── ...
```

---

# Part 2: The Journey of a PDF

Let's follow a single PDF through the entire system, from upload to playback.

## Scene 1: The Upload

**You**: Drop a PDF file onto the upload zone

**Location**: `components/Upload.tsx`

```typescript
// components/Upload.tsx - The user drops a file
const handleDrop = async (e: React.DragEvent) => {
  const file = e.dataTransfer.files[0];
  // Validate it's a PDF...
  await uploadFile(file);
};
```

**What happens**:

1. User drops `quarterly-report.pdf` (5MB)
2. Frontend creates FormData with the file
3. Sends `POST /api/upload`

**Location**: `app/api/upload/route.ts:16-54`

```typescript
// app/api/upload/route.ts:16-54
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get('file') as File;

  // Validation
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: `File too large. Maximum: ${MAX_MB}MB` }, { status: 400 });
  }

  // Generate unique ID and save
  const jobId = randomUUID();  // e.g., "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(`/tmp/${jobId}.pdf`, buffer);

  return NextResponse.json({ jobId, fileName: file.name, fileSize: file.size });
}
```

**Result**:
- File saved to `/tmp/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf`
- Frontend receives `jobId` to use for next steps

---

## Scene 2: The Streaming Connection

**Location**: `app/page.tsx:42-63`

Once upload succeeds, the frontend renders `StreamingPlayer`:

```typescript
// app/page.tsx:126
{useStreaming && jobId && fileName && file && (
  <StreamingPlayer documentId={jobId} fileName={fileName} file={file} onReset={reset} />
)}
```

**Location**: `components/StreamingPlayer.tsx:53-112`

StreamingPlayer immediately connects to the streaming API:

```typescript
// components/StreamingPlayer.tsx:58-68
async function start() {
  setStatus('extracting');
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`/api/process-stream/${documentId}`, {
    method: 'POST',
    body: formData,
  });

  const reader = res.body?.getReader();
  // Start reading the stream...
}
```

---

## Scene 3: Text Extraction (The OCR Kitchen)

**Location**: `app/api/process-stream/[id]/route.ts:101-126`

The server receives the request and starts processing:

```typescript
// app/api/process-stream/[id]/route.ts:101-111
// Step 1: Extract PDF
const extractionStart: StreamEvent = {
  type: 'extraction_start',
  timestamp: Date.now(),
};
sendEvent(extractionStart);  // Tell frontend we're starting

console.log(`[${id}] Starting PDF extraction...`);
const { markdown: rawText, pageCount } = await extractPDF(pdfPath);
```

**What `extractPDF` does** (`lib/deepseek.ts:122-146`):

```typescript
// lib/deepseek.ts:122-146
export async function extractPDF(pdfPath: string): Promise<{ markdown: string; pageCount: number }> {
  // Try DeepInfra OCR first (handles scanned PDFs)
  if (process.env.DEEPINFRA_API_KEY) {
    try {
      const result = await extractPdfWithDeepInfra(pdfPath);
      if (result.markdown?.trim()) {
        return result;
      }
    } catch (error) {
      console.warn(`[DeepInfra] OCR failed, trying pdftotext fallback...`);
    }
  }

  // Fallback to pdftotext (for text-based PDFs only)
  return extractWithPdftotext(pdfPath);
}
```

**Example output** (rawText):
```
<--- Page Split --->
QUARTERLY EARNINGS REPORT
Q3 2024

<table>
<tr><td>Revenue</td><td>$4.2B</td></tr>
<tr><td>Net Income</td><td>$890M</td></tr>
</table>

The company showed strong performance...
```

---

## Scene 4: Table and Image Intelligence

**Location**: `app/api/process-stream/[id]/route.ts:127-173`

Now we make the text *listenable*. Tables and images don't work in audio!

### Step 4a: Find Tables

```typescript
// app/api/process-stream/[id]/route.ts:128-129
console.log(`[${id}] Extracting tables...`);
const tables = extractHTMLTables(rawText);
```

**Location**: `lib/html-tables.ts` - Finds all `<table>...</table>` blocks and their surrounding context.

### Step 4b: Extract and Narrate Images

```typescript
// app/api/process-stream/[id]/route.ts:132-147
const images = await extractImages(pdfPath, id);
if (images.length > 0) {
  const pageContexts = splitTextByPage(rawText);
  imageNarrations = await narrateImages(images, pageContexts);
}
```

### Step 4c: Narrate Tables with Claude

```typescript
// app/api/process-stream/[id]/route.ts:161-167
narrations = await narrateTables(tables);
```

**What `narrateTables` does** (`lib/claude.ts:60-87`):

```typescript
// lib/claude.ts:16-58
export async function narrateTable(table: HTMLTable): Promise<string> {
  const rows = parseHTMLTable(table.html);
  const markdown = tableToMarkdown(rows);

  const prompt = `You are narrating an audiobook. A listener cannot see the table...

Context before the table:
${table.contextBefore}

The table data:
${markdown}

Instructions:
1. Describe what the table shows in 2-4 sentences
2. Highlight the most important insights
3. Make it flow naturally as if explaining to someone
...`;

  const message = await client.messages.create({
    model: 'claude-3-5-haiku-20241022',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  return message.content[0].text.trim();
}
```

**Before (HTML table)**:
```html
<table><tr><td>Revenue</td><td>$4.2B</td></tr><tr><td>Net Income</td><td>$890M</td></tr></table>
```

**After (natural narration)**:
```
The quarterly financials show revenue of 4.2 billion dollars with net income of 890 million,
representing healthy margins for the period.
```

---

## Scene 5: The Text Refinery

**Location**: `app/api/process-stream/[id]/route.ts:175-179`

Now we clean the text so TTS can read it naturally:

```typescript
// app/api/process-stream/[id]/route.ts:176-177
const cleanText = processDeepSeekText(rawText, tables, narrations, imageNarrations);
```

**What `processDeepSeekText` does** (`lib/cleaning.ts:30-66`):

```typescript
// lib/cleaning.ts:30-66
export function processDeepSeekText(
  rawText: string,
  tables: HTMLTable[],
  tableNarrations: Map<number, string>,
  imageNarrations: ImageNarration[] = []
): string {
  let processed = rawText;

  // Step 0: Insert image narrations near their pages
  processed = injectImageNarrations(processed, imageNarrations);

  // Step 1: Replace HTML tables with Claude's narrations
  processed = replaceTablesWithNarrations(processed, tables, tableNarrations);

  // Step 2: Clean OCR artifacts
  processed = cleanDeepSeekOutput(processed);  // Remove "Page Split" markers, etc.

  // Step 3: Remove low-value sections
  processed = removeLowValueSections(processed);  // Drop TOC, legal boilerplate

  // Step 4: Prepare for narration
  processed = prepareForNarration(processed);  // Expand "e.g." → "for example"

  // Safety: If we cleaned too much, fall back to raw
  if (processed.length < rawText.length * 0.1) {
    console.warn('Cleaning removed too much, using raw text');
    return rawText;
  }

  return processed;
}
```

**Cleaning examples**:
- `<--- Page Split --->` → removed
- `e.g.` → `for example`
- `$100M` → `100 million dollars`
- `Table of Contents......3` → removed
- `Copyright 2024...` → removed

---

## Scene 6: The Audio Factory (TTS)

**Location**: `app/api/process-stream/[id]/route.ts:181-258`

Now we convert text to audio, chunk by chunk:

### Step 6a: Determine Chunk Size

```typescript
// app/api/process-stream/[id]/route.ts:183-186
const ttsManager = createTTSManager(providerPref);
const maxChunkSize = await ttsManager.getPrimaryChunkSize();
// Result: 8000 chars for DeepInfra, 4000 for OpenAI
```

### Step 6b: Split Text into Chunks

```typescript
// app/api/process-stream/[id]/route.ts:188
const textChunks = chunkText(cleanText, maxChunkSize);
```

**What `chunkText` does** (`lib/streaming/chunk-manager.ts:190-226`):

```typescript
// lib/streaming/chunk-manager.ts:190-226
export function chunkText(text: string, maxChars: number = 4000): string[] {
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining.trim());
      break;
    }

    let breakPoint = maxChars;

    // Try to break at paragraph boundary
    const paragraphEnd = remaining.lastIndexOf('\n\n', maxChars);
    if (paragraphEnd > maxChars * 0.7) {
      breakPoint = paragraphEnd + 2;
    } else {
      // Try sentence boundary
      const sentenceEnd = remaining.lastIndexOf('. ', maxChars);
      if (sentenceEnd > maxChars * 0.7) {
        breakPoint = sentenceEnd + 2;
      }
    }

    chunks.push(remaining.slice(0, breakPoint).trim());
    remaining = remaining.slice(breakPoint).trim();
  }

  return chunks;
}
```

**Why smart chunking matters**: We don't want to cut words in half or break in the middle of a sentence!

### Step 6c: Generate Audio for Each Chunk

```typescript
// app/api/process-stream/[id]/route.ts:211-258
for (let i = 0; i < textChunks.length; i++) {
  const chunkText = textChunks[i];

  // Tell frontend we're working on this chunk
  sendEvent({ type: 'chunk_processing', index: i, total: totalChunks });

  // Generate the audio
  const audioPath = await generateAudio(chunkText, `${id}-chunk-${i}`);

  // Read the audio file
  const chunkBuffer = await fs.readFile(audioPath);

  // Save for final concatenation
  await chunkManager.saveChunk(i, chunkBuffer);

  // Convert to base64 for streaming
  const audioBase64 = chunkBuffer.toString('base64');

  // Send to frontend immediately!
  sendEvent({
    type: 'chunk_ready',
    index: i,
    total: totalChunks,
    audioData: audioBase64,  // The actual audio, embedded in the event
    duration: estimateChunkDuration(chunkText),
  });
}
```

---

## Scene 7: The Stream (SSE Events)

**Location**: `components/StreamingPlayer.tsx:114-136`

The frontend receives these events in real-time:

```typescript
// components/StreamingPlayer.tsx:114-136
function handleEvent(event: StreamEvent) {
  switch (event.type) {
    case 'extraction_start':
      setStatus('extracting');
      break;
    case 'extraction_complete':
      setStatus('processing');
      setTotalChunks(event.totalChunks);
      break;
    case 'chunk_ready':
      handleChunkReady(event);  // Convert base64 to playable audio!
      break;
    case 'complete':
      setStatus('complete');
      setDownloadUrl(event.downloadUrl);
      break;
    case 'error':
      setStatus('error');
      setError(event.message);
      break;
  }
}
```

### Converting Base64 to Playable Audio

```typescript
// components/StreamingPlayer.tsx:9-16
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);  // Decode base64
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

// components/StreamingPlayer.tsx:138-152
function handleChunkReady(event: ChunkReadyEvent) {
  const blob = base64ToBlob(event.audioData, 'audio/mpeg');
  const url = URL.createObjectURL(blob);  // Creates a playable URL!

  setChunks(prev => {
    const updated = [...prev];
    updated[event.index] = { index: event.index, audioUrl: url, duration: event.duration, status: 'ready' };
    return updated;
  });

  // Auto-play first chunk
  if (event.index === 0 && audioRef.current) {
    audioRef.current.src = url;
    audioRef.current.play();
  }
}
```

---

## Scene 8: Playback

**Location**: `components/StreamingPlayer.tsx:155-166`

When one chunk finishes, automatically play the next:

```typescript
// components/StreamingPlayer.tsx:155-166
const handleChunkEnd = useCallback(() => {
  const nextIndex = currentChunkIndex + 1;
  const nextChunk = chunks[nextIndex];

  if (nextChunk?.status === 'ready' && audioRef.current) {
    setCurrentChunkIndex(nextIndex);
    audioRef.current.src = nextChunk.audioUrl;
    audioRef.current.play();
  } else {
    setIsPlaying(false);  // No more chunks ready yet
  }
}, [currentChunkIndex, chunks]);
```

**The magic**: By the time you finish listening to chunk 1, chunk 2 is already ready. Seamless playback!

---

## Timeline of Events

```
Time    Event                              What User Sees
─────   ─────                              ──────────────
0s      PDF dropped                        Upload animation
1s      Upload complete, SSE connected     "Extracting text..."
3s      extraction_complete received       "Generating audio · 0%"
8s      chunk_ready (index 0)              AUDIO PLAYS! Progress: 1/12
12s     chunk_ready (index 1)              Progress: 2/12
...     ...                                Progress: N/12
45s     complete                           Download button appears
```

---

# Part 3: TTS Deep Dive

This is the most complex subsystem - the one that actually costs money and has the most moving parts. Let's master it.

## Why TTS is Complex

1. **Multiple providers** with different APIs, pricing, and capabilities
2. **Fallback logic** - if one fails, try the next
3. **Cost optimization** - use the cheapest provider that works
4. **Text limits** - each provider has different max chunk sizes
5. **Quality metrics** - track which providers perform best

---

## The Provider Interface (The Contract)

Every TTS provider must implement this interface:

**Location**: `lib/tts/types.ts:6-32`

```typescript
// lib/tts/types.ts:6-32
export interface TTSProvider {
  name: string;                    // 'deepinfra', 'openai', etc.
  priority: number;                // Lower = higher priority (0 is highest)
  costPer1MChars: number;          // Cost in USD per 1 million characters
  maxCharsPerChunk: number;        // Max text length per API call

  // Check if this provider is configured and ready
  isAvailable(): Promise<boolean>;

  // Convert text to audio (returns MP3 buffer)
  synthesize(text: string, options?: TTSOptions): Promise<Buffer>;

  // Calculate cost for given text
  estimateCost(text: string | number): number;

  // Get performance metrics
  getMetrics(): TTSMetrics;
}
```

**Why this matters**: Because every provider implements this interface, the manager can use them interchangeably:

```typescript
// This code works with ANY provider!
const audio = await provider.synthesize("Hello world");
const cost = provider.estimateCost("Hello world");
```

---

## Provider-by-Provider Breakdown

### 1. DeepInfra Kokoro (PRIMARY) - $0.62/M chars

**Location**: `lib/tts/providers/deepinfra.ts`

**Why it's primary**: 98% cheaper than OpenAI!

```typescript
// lib/tts/providers/deepinfra.ts:9-13
export class DeepInfraProvider implements TTSProvider {
  name = 'deepinfra';
  priority = 0;              // Highest priority (tried first)
  costPer1MChars = 0.62;     // $0.62 per million characters
  maxCharsPerChunk = 8000;   // Can handle larger chunks
```

**How it works** (`lib/tts/providers/deepinfra.ts:39-120`):

```typescript
// lib/tts/providers/deepinfra.ts:39-120
async synthesize(text: string, options?: TTSOptions): Promise<Buffer> {
  // 1. Validate text length
  if (text.length > this.maxCharsPerChunk) {
    throw new TTSError(`Text too long: ${text.length} > ${this.maxCharsPerChunk}`, ...);
  }

  // 2. Select voice based on emotion
  const voice = this.selectVoiceForEmotion(options?.emotion) || this.defaultVoice;

  // 3. Call the API
  const response = await fetch('https://api.deepinfra.com/v1/inference/hexgrad/Kokoro-82M', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text,
      voice,
      speed: options?.speed || 1.05,
      output_format: 'mp3'
    })
  });

  // 4. Handle response (can be JSON with base64 or direct binary)
  if (contentType?.includes('application/json')) {
    const json = await response.json();
    return Buffer.from(json.audio, 'base64');
  } else {
    return Buffer.from(await response.arrayBuffer());
  }
}
```

**Voice options** (`lib/tts/providers/deepinfra.ts:122-136`):

```typescript
// lib/tts/providers/deepinfra.ts:122-136
private selectVoiceForEmotion(emotion?: string): string | null {
  const emotionVoiceMap: Record<string, string> = {
    neutral: 'af_bella',    // Default female voice
    calm: 'af_heart',
    excited: 'af_sky',
    happy: 'af_nova',
    serious: 'am_eric',     // Male voice for serious content
    sad: 'af_river',
  };
  return emotionVoiceMap[emotion] || null;
}
```

### 2. Orpheus (Together.ai) - $15/M chars

**Location**: `lib/tts/providers/orpheus.ts`

**Special feature**: Emotion tags! Can insert `<laugh>`, `<sigh>`, `<gasp>` for expressiveness.

```typescript
// Orpheus can do this:
const text = "That's incredible! <laugh> I can't believe it worked!";
```

### 3. MiniMax - $30/M chars

**Location**: `lib/tts/providers/minimax.ts`

**Special feature**: 40+ language support

### 4. OpenAI TTS-1-HD - $30/M chars (FALLBACK)

**Location**: `lib/tts/providers/openai.ts`

**Why it's the fallback**: Most reliable, but most expensive

```typescript
// lib/tts/providers/openai.ts
export class OpenAIProvider implements TTSProvider {
  name = 'openai';
  priority = 3;              // Lowest priority (last resort)
  costPer1MChars = 30;       // $30 per million characters
  maxCharsPerChunk = 4000;   // Smaller chunks
```

---

## The Manager: How It Decides

**Location**: `lib/tts/manager.ts`

The `TTSManager` orchestrates everything:

```typescript
// lib/tts/manager.ts:23-67
export class TTSManager {
  private providers: TTSProvider[] = [];

  private initializeProviders() {
    // Add providers in priority order
    if (this.config.deepinfra) {
      this.providers.push(new DeepInfraProvider(this.config.deepinfra));
    }
    if (this.config.orpheus) {
      this.providers.push(new OrpheusProvider(this.config.orpheus));
    }
    if (this.config.minimax) {
      this.providers.push(new MiniMaxProvider(this.config.minimax));
    }
    if (this.config.openai) {
      this.providers.push(new OpenAIProvider(this.config.openai));
    }

    // Sort by priority (lower number = higher priority)
    this.providers.sort((a, b) => a.priority - b.priority);
  }
}
```

### Finding the Primary Provider

```typescript
// lib/tts/manager.ts:72-85
private async getPrimaryProvider(): Promise<TTSProvider | null> {
  // Sort by cost (cheapest first)
  const sortedByCost = [...this.providers].sort(
    (a, b) => a.costPer1MChars - b.costPer1MChars
  );

  // Return first available provider
  for (const provider of sortedByCost) {
    if (await provider.isAvailable()) {
      return provider;
    }
  }

  return null;
}
```

---

## The Fallback Chain in Action

**Location**: `lib/tts/manager.ts:90-161`

Here's the complete `synthesize` method - this is the heart of the system:

```typescript
// lib/tts/manager.ts:90-161
async synthesize(text: string, options?: TTSOptions): Promise<{
  audio: Buffer;
  provider: string;
  cost: number;
  duration: number;
}> {
  const startTime = Date.now();

  // STEP 1: Select initial provider
  let selectedProvider: TTSProvider | null;

  // A/B Testing: Occasionally use alternative provider (10% of requests)
  if (this.abTestingEnabled && Math.random() < this.abTestingRatio) {
    selectedProvider = await this.getAlternativeProvider();
  } else {
    selectedProvider = await this.getPrimaryProvider();  // Usually DeepInfra
  }

  if (!selectedProvider) {
    throw new TTSError('No TTS providers available', 'manager', 'NO_PROVIDERS', false);
  }

  // STEP 2: Try providers in fallback chain
  let lastError: Error | null = null;
  const attemptedProviders = new Set<string>();

  while (selectedProvider) {
    try {
      attemptedProviders.add(selectedProvider.name);

      // Try to synthesize
      const audio = await selectedProvider.synthesize(text, options);
      const duration = Date.now() - startTime;
      const cost = selectedProvider.estimateCost(text);

      // Success! Record metrics and return
      this.recordMetrics({
        provider: selectedProvider.name,
        textLength: text.length,
        generationTime: duration,
        fileSize: audio.length,
      });

      return { audio, provider: selectedProvider.name, cost, duration };

    } catch (error) {
      // Provider failed - try the next one
      lastError = error as Error;
      console.error(`TTS provider ${selectedProvider.name} failed:`, error);

      // Get next provider that we haven't tried
      selectedProvider = await this.getNextProvider(attemptedProviders, text.length);
    }
  }

  // All providers failed
  throw new TTSError(`All TTS providers failed: ${lastError?.message}`, 'manager', 'ALL_FAILED', false);
}
```

**Visual of the fallback flow**:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SYNTHESIZE REQUEST                           │
│                      "Hello, world!" (12 chars)                     │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │ A/B Testing enabled?   │
                    │   (10% chance)         │
                    └───────────┬────────────┘
                       No (90%) │    │ Yes (10%)
                                │    │
                    ┌───────────▼────▼────────────┐
                    │   Get Primary Provider      │
                    │   (cheapest available)      │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────▼───────────────┐
                    │      TRY: DeepInfra         │
                    │      ($0.62/M chars)        │
                    └─────────────┬───────────────┘
                        Success?  │
                    ┌─────────────┴─────────────┐
                    │                           │
              Yes ──┘                           └── No (error)
                    │                                   │
          ┌─────────▼─────────┐            ┌───────────▼───────────┐
          │  RETURN AUDIO     │            │   TRY: Orpheus        │
          │  Cost: $0.000007  │            │   ($15/M chars)       │
          └───────────────────┘            └───────────┬───────────┘
                                               Success? │
                                           ┌───────────┴───────────┐
                                           │                       │
                                     Yes ──┘                       └── No
                                           │                            │
                                 ┌─────────▼─────────┐      ┌──────────▼──────────┐
                                 │  RETURN AUDIO     │      │   TRY: MiniMax      │
                                 │  Cost: $0.00018   │      │   ($30/M chars)     │
                                 └───────────────────┘      └──────────┬──────────┘
                                                                       │
                                                              ... and so on to OpenAI
```

---

## Cost Optimization: The Numbers

**Location**: `lib/tts.ts:363-381`

```typescript
// lib/tts.ts:363-381
export function getCostComparison(text: string): Record<string, number> {
  const charCount = text.length;

  return {
    deepinfra: (charCount / 1_000_000) * 0.62,     // Cheapest
    orpheus: (charCount / 1_000_000) * 15,
    minimax: (charCount / 1_000_000) * 30,
    openai_hd: (charCount / 1_000_000) * 30,       // Most expensive

    savings_vs_openai: openaiCost - deepinfraCost,
    savings_percent: Math.round((1 - (deepinfraCost / openaiCost)) * 100)
  };
}
```

**Real example**: A 50-page PDF (~150,000 characters)

| Provider | Cost |
|----------|------|
| DeepInfra | $0.093 |
| Orpheus | $2.25 |
| MiniMax | $4.50 |
| OpenAI | $4.50 |
| **Savings with DeepInfra** | **$4.41 (98%)** |

---

## Code Walkthrough: A Complete Synthesis Call

Let's trace through exactly what happens when we call `generateAudio`:

**Location**: `lib/tts.ts:104-210`

```typescript
// lib/tts.ts:104-210
export async function generateAudio(
  text: string,
  jobId: string,
  options: TTSOptions = {}
): Promise<string> {

  // STEP 1: Determine which mode to use
  const provider = process.env.TTS_PROVIDER || 'auto';
  const useManager = provider !== 'openai' &&
    (process.env.DEEPINFRA_API_KEY || process.env.TOGETHER_API_KEY);

  if (useManager) {
    return generateAudioWithManager(text, jobId, options);
  }

  // ... legacy OpenAI code (fallback)
}
```

**Inside `generateAudioWithManager`** (`lib/tts.ts:215-310`):

```typescript
// lib/tts.ts:215-310
async function generateAudioWithManager(text: string, jobId: string, options): Promise<string> {

  // STEP 1: Create manager with configured providers
  const manager = createTTSManager(options.provider || 'auto');

  // STEP 2: Get chunk size from primary provider
  const maxChunkSize = await manager.getPrimaryChunkSize();
  console.log(`Using chunk size of ${maxChunkSize} chars`);

  // STEP 3: Is text small enough for single call?
  if (text.length <= maxChunkSize) {
    // Single synthesis call
    const result = await manager.synthesize(text, {
      speed: options.speed || 1.05,
      emotion: options.emotion,
    });

    console.log(`Generated audio with ${result.provider} (cost: $${result.cost.toFixed(4)})`);

    // Save to file
    const audioPath = join('/tmp', `${jobId}.mp3`);
    await writeFile(audioPath, result.audio);
    return audioPath;
  }

  // STEP 4: Large text - chunk and synthesize each
  const chunks = chunkText(text, maxChunkSize);
  const audioBuffers: Buffer[] = [];
  let totalCost = 0;
  const providers = new Set<string>();

  for (let i = 0; i < chunks.length; i++) {
    console.log(`Generating chunk ${i + 1}/${chunks.length}...`);

    const result = await manager.synthesize(chunks[i], options);

    audioBuffers.push(result.audio);
    totalCost += result.cost;
    providers.add(result.provider);
  }

  // STEP 5: Concatenate all chunks
  const finalBuffer = Buffer.concat(audioBuffers);

  // STEP 6: Save and optionally fix with ffmpeg
  const audioPath = join('/tmp', `${jobId}.mp3`);
  // ... ffmpeg code ...

  console.log(`Total cost: $${totalCost.toFixed(4)}`);
  return audioPath;
}
```

---

## How to Add a New TTS Provider

Want to add ElevenLabs or another provider? Here's the pattern:

**Step 1**: Create the provider file in `lib/tts/providers/`

```typescript
// lib/tts/providers/elevenlabs.ts
import { TTSProvider, TTSOptions, TTSMetrics, TTSError } from '../types';

export class ElevenLabsProvider implements TTSProvider {
  name = 'elevenlabs';
  priority = 2;               // Between Orpheus and MiniMax
  costPer1MChars = 20;        // $20/M chars (hypothetical)
  maxCharsPerChunk = 5000;

  private apiKey: string;
  private voiceId: string;

  constructor(config: { apiKey: string; voiceId?: string }) {
    this.apiKey = config.apiKey;
    this.voiceId = config.voiceId || 'default-voice-id';
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async synthesize(text: string, options?: TTSOptions): Promise<Buffer> {
    if (text.length > this.maxCharsPerChunk) {
      throw new TTSError(`Text too long`, this.name, 'TEXT_TOO_LONG', false);
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
      }),
    });

    return Buffer.from(await response.arrayBuffer());
  }

  estimateCost(text: string | number): number {
    const chars = typeof text === 'number' ? text : text.length;
    return (chars / 1_000_000) * this.costPer1MChars;
  }

  getMetrics(): TTSMetrics {
    return { totalRequests: 0, totalCharacters: 0, totalCost: 0, averageLatency: 0, errors: 0 };
  }
}
```

**Step 2**: Register it in the manager (`lib/tts/manager.ts`):

```typescript
import { ElevenLabsProvider } from './providers/elevenlabs';

// In initializeProviders():
if (this.config.elevenlabs) {
  this.providers.push(new ElevenLabsProvider(this.config.elevenlabs));
}
```

**Step 3**: Add config in `lib/tts.ts`:

```typescript
// In buildTTSConfig():
if (process.env.ELEVENLABS_API_KEY) {
  config.elevenlabs = {
    apiKey: process.env.ELEVENLABS_API_KEY,
    voiceId: process.env.ELEVENLABS_VOICE_ID,
  };
}
```

**Step 4**: Add to types (`lib/tts/types.ts`):

```typescript
export interface TTSProviderConfig {
  // ...existing providers...
  elevenlabs?: {
    apiKey: string;
    voiceId?: string;
  };
}
```

---

# Part 4: Module Reference Cards

Quick-reference cards for every module. Scan in 30 seconds, know where to go.

---

## API Routes

### `/api/upload`
**Location**: `app/api/upload/route.ts`
**What it does**: Receives PDF file, validates, saves to /tmp
**In plain English**: "When someone uploads a file, check it's a valid PDF, then save it with a unique ID"

| Property | Value |
|----------|-------|
| Method | POST |
| Input | FormData with 'file' field |
| Output | `{ jobId, fileName, fileSize }` |
| Errors | 400 (invalid file), 500 (save failed) |
| Key lines | Validation: 27-40, Save: 46-48 |

---

### `/api/process-stream/[id]`
**Location**: `app/api/process-stream/[id]/route.ts`
**What it does**: The main streaming endpoint - extracts, processes, and streams audio
**In plain English**: "Process a PDF and send audio chunks to the client as they're generated"

| Property | Value |
|----------|-------|
| Method | POST |
| Input | FormData with PDF file |
| Output | SSE stream with events |
| Events | extraction_start, extraction_complete, chunk_processing, chunk_ready, complete, error |
| Key lines | Extract: 110, Narrate: 165, Generate audio: 227 |

---

### `/api/download/[id]`
**Location**: `app/api/download/[id]/route.ts`
**What it does**: Serves the concatenated MP3 file for download
**In plain English**: "Send the complete audio file with a download header"

---

## Extraction Layer

### `lib/deepseek.ts`
**Location**: `lib/deepseek.ts`
**What it does**: Extracts text from PDF using OCR
**In plain English**: "Turn a PDF into text, handling both scanned and digital PDFs"

| Property | Value |
|----------|-------|
| Main function | `extractPDF(pdfPath)` |
| Returns | `{ markdown: string, pageCount: number }` |
| Primary method | DeepInfra OCR (line 127-134) |
| Fallback | pdftotext (line 144-145) |

**Modify this to**: Change OCR provider, adjust retry logic

---

### `lib/html-tables.ts`
**Location**: `lib/html-tables.ts`
**What it does**: Finds HTML tables in OCR output
**In plain English**: "Find all `<table>...</table>` blocks and grab context around them"

| Property | Value |
|----------|-------|
| Main function | `extractHTMLTables(text)` |
| Returns | `HTMLTable[]` with html, context, positions |

---

### `lib/claude.ts`
**Location**: `lib/claude.ts`
**What it does**: Converts tables/images to natural narration using DeepInfra LLM
**In plain English**: "Ask DeepInfra Llama to describe tables as if explaining to a listener"

| Property | Value |
|----------|-------|
| Main functions | `narrateTable()`, `narrateTables()` |
| Model | DeepInfra Llama 3.3 70B (via `lib/deepinfra-llm.ts`) |
| Max tokens | 600 per table |
| Timeout | 30 seconds per table |
| Key line | Prompt at line 22-43 |

**Modify this to**: Change narration style, adjust the prompt

---

### `lib/deepinfra-llm.ts`
**Location**: `lib/deepinfra-llm.ts`
**What it does**: DeepInfra-hosted LLM integration for text and vision tasks
**In plain English**: "OpenAI-compatible client for DeepInfra models"

| Property | Value |
|----------|-------|
| Text model | `meta-llama/Llama-3.3-70B-Instruct-Turbo` |
| Vision model | `meta-llama/Llama-3.2-11B-Vision-Instruct` |
| Main functions | `chatCompletion()`, `visionCompletion()` |
| API | OpenAI-compatible at `api.deepinfra.com/v1/openai` |

**Used by**: `lib/claude.ts`, `lib/fal.ts`, `lib/images.ts`

---

### `lib/fal.ts`
**Location**: `lib/fal.ts`
**What it does**: Generates AI cover artwork using Fal.ai Nano Banana Pro
**In plain English**: "Create manuscript-style illustrations from document themes"

| Property | Value |
|----------|-------|
| Main function | `generateDocumentArtwork(cleanText, pageCount)` |
| Model | `fal-ai/nano-banana-pro` |
| Cost | $0.15 per image |
| Style | Minimalist hand-drawn manuscript sketch |
| Timeout | 30 seconds default |

**Flow**: Document text → DeepInfra extracts theme → Fal.ai generates artwork

---

## Text Processing

### `lib/cleaning.ts`
**Location**: `lib/cleaning.ts`
**What it does**: Orchestrates the text cleaning pipeline
**In plain English**: "Take raw OCR text, inject narrations, clean it up for audio"

| Property | Value |
|----------|-------|
| Main function | `processDeepSeekText(rawText, tables, narrations, imageNarrations)` |
| Steps | Inject images → Replace tables → Clean artifacts → Remove junk → Prepare for speech |
| Safety | Falls back to raw text if cleaning removes >90% |

---

### `lib/text-cleaner.ts`
**Location**: `lib/text-cleaner.ts`
**What it does**: Detailed text cleaning functions
**In plain English**: "Remove OCR artifacts, expand abbreviations, strip boilerplate"

| Functions | Purpose |
|-----------|---------|
| `cleanDeepSeekOutput()` | Remove page markers, fix formatting |
| `removeLowValueSections()` | Drop TOC, legal text, copyright |
| `prepareForNarration()` | Expand "e.g." → "for example" |

---

## TTS Layer

### `lib/tts.ts`
**Location**: `lib/tts.ts`
**What it does**: Main TTS entry point
**In plain English**: "Generate audio from text, handling chunking and provider selection"

| Property | Value |
|----------|-------|
| Main function | `generateAudio(text, jobId, options)` |
| Helper | `buildTTSConfig()` - builds provider config from env vars |
| Helper | `createTTSManager()` - creates manager instance |

---

### `lib/tts/manager.ts`
**Location**: `lib/tts/manager.ts`
**What it does**: Provider orchestration and fallback
**In plain English**: "Try the cheapest provider first, fall back if it fails"

| Property | Value |
|----------|-------|
| Main method | `synthesize(text, options)` |
| Selection | `getPrimaryProvider()` - cheapest available |
| Fallback | `getNextProvider()` - next in chain |
| A/B Testing | 10% of requests use alternative |

---

### `lib/tts/types.ts`
**Location**: `lib/tts/types.ts`
**What it does**: TypeScript interfaces for TTS system
**In plain English**: "The contracts that all TTS providers must follow"

| Interface | Purpose |
|-----------|---------|
| `TTSProvider` | What every provider must implement |
| `TTSOptions` | Voice, speed, emotion settings |
| `TTSProviderConfig` | Configuration for all providers |
| `TTSError` | Structured error with retry info |

---

## Streaming Layer

### `lib/streaming/chunk-manager.ts`
**Location**: `lib/streaming/chunk-manager.ts`
**What it does**: Manages audio chunk storage and concatenation
**In plain English**: "Save chunks to disk, concatenate them at the end"

| Property | Value |
|----------|-------|
| Class | `ChunkManager` |
| Storage | `/tmp/{jobId}-chunks/` |
| Methods | `saveChunk()`, `readChunk()`, `concatenateChunks()` |
| Utility | `chunkText()` - smart text splitting |

---

### `lib/streaming/sse-helpers.ts`
**Location**: `lib/streaming/sse-helpers.ts`
**What it does**: SSE encoding utilities
**In plain English**: "Format events for Server-Sent Events protocol"

| Property | Value |
|----------|-------|
| Class | `SSEEncoder` |
| Method | `encode(event)` - converts to SSE format |
| Constant | `KEEPALIVE_INTERVAL` - prevents timeout |

---

## Frontend Components

### `components/StreamingPlayer.tsx`
**Location**: `components/StreamingPlayer.tsx`
**What it does**: Progressive audio player
**In plain English**: "Connect to SSE stream, play audio chunks as they arrive"

| Property | Value |
|----------|-------|
| Props | documentId, fileName, file, onReset |
| State | chunks, currentChunkIndex, isPlaying, status |
| Key hooks | useEffect (SSE connection), useCallback (controls) |
| Keyboard | Space (play), R (restart), Esc (close) |

---

### `components/Upload.tsx`
**Location**: `components/Upload.tsx`
**What it does**: File upload with drag-drop
**In plain English**: "Let users drop a PDF and validate it"

---

### `app/page.tsx`
**Location**: `app/page.tsx`
**What it does**: Main page orchestrator
**In plain English**: "Show Upload, then StreamingPlayer, manage overall state"

| State | Purpose |
|-------|---------|
| jobId | Current processing job |
| fileName | Display name |
| file | The actual PDF file |
| processing | Loading state |
| result | Final result (non-streaming) |
| useStreaming | Toggle streaming mode |

---

# Part 5: The Decision Log

Why we built it this way. Understanding these decisions helps you know when to change things.

---

## Decision 1: SSE Instead of WebSockets

**What we chose**: Server-Sent Events (SSE)
**Alternative**: WebSockets

**Why SSE wins here**:
1. **One-way communication** - We only send server→client, never client→server during processing
2. **Simpler** - No connection management, automatic reconnection
3. **Vercel-friendly** - WebSockets require special infrastructure; SSE works with standard serverless
4. **HTTP-based** - Works through proxies, CDNs, corporate firewalls

**When to reconsider**: If you need bidirectional real-time communication (like a chat)

---

## Decision 2: Embed Audio in SSE Events (Base64)

**What we chose**: Send audio data as base64 strings inside SSE events
**Alternative**: Send URLs, let client fetch each chunk

**Why embedding wins**:
```typescript
// What we do:
sendEvent({ type: 'chunk_ready', audioData: base64Audio });

// Alternative (would cause problems):
sendEvent({ type: 'chunk_ready', audioUrl: '/api/audio-chunk/123/0' });
```

**The problem with URLs**: On Vercel, each serverless function invocation is isolated. The function that generated chunk 0 might not be the same one that handles a request for `/api/audio-chunk/123/0`. Result: 404 errors.

**Why embedding works**: The audio data travels in the same response stream that generated it. No separate requests, no isolation issues.

**Trade-off**: Larger SSE payloads (base64 is ~33% larger than binary), but reliability wins.

---

## Decision 3: Provider Fallback Chain

**What we chose**: Try providers in cost order, fall back on failure
**Alternative**: Single provider with error handling

**Why the chain**:
1. **Cost savings** - DeepInfra is 98% cheaper than OpenAI
2. **Resilience** - If DeepInfra is down, we don't fail completely
3. **Quality options** - Different providers have different strengths

**The economics**:
```
50-page PDF with DeepInfra: $0.09
50-page PDF with OpenAI:    $4.50
Savings: $4.41 per document
```

**When to change**: If a single provider becomes clearly superior in cost AND reliability

---

## Decision 4: Aggressive Text Cleaning

**What we chose**: Multiple cleaning passes that can remove up to 90% of text
**Alternative**: Minimal cleaning, keep most content

**Why aggressive cleaning**:
1. **TTS quality** - OCR artifacts sound terrible when spoken
2. **Cost** - Less text = less TTS cost
3. **Listener experience** - Nobody wants to hear "Page 3 of 47" or "Copyright 2024"

**The safety net** (`lib/cleaning.ts:56-63`):
```typescript
// If cleaning removes too much, fall back to raw text
if (processed.length < rawText.length * 0.1 && rawText.length > 200) {
  console.warn('Cleaning removed too much, using raw text');
  return rawText;
}
```

---

## Decision 5: Smart Chunking at Boundaries

**What we chose**: Split at paragraph, then sentence, then comma boundaries
**Alternative**: Hard split at character limit

**Why smart chunking**:
```typescript
// lib/streaming/chunk-manager.ts:200-219
// Try paragraph first
const paragraphEnd = remaining.lastIndexOf('\n\n', maxChars);
if (paragraphEnd > maxChars * 0.7) {
  breakPoint = paragraphEnd + 2;
} else {
  // Try sentence
  const sentenceEnd = remaining.lastIndexOf('. ', maxChars);
  // ...
}
```

**The problem with hard splits**: "The company reported reve" | "nue of $4.2 billion..." sounds terrible.

**The solution**: Always break at natural pauses. Accept slightly uneven chunk sizes for much better audio.

---

## Decision 6: /tmp Storage

**What we chose**: Store everything in `/tmp` directory
**Alternative**: Cloud storage (S3, GCS), database blobs

**Why /tmp**:
1. **Ephemeral is fine** - Audio files are temporary, don't need persistence
2. **Fast** - Local filesystem is faster than network storage
3. **Simple** - No additional infrastructure
4. **Free** - No storage costs
5. **Auto-cleanup** - Vercel clears /tmp between invocations

**The pattern**:
```
/tmp/{jobId}.pdf          # Input PDF (deleted after processing)
/tmp/{jobId}-chunks/      # Audio chunks (deleted after concatenation)
/tmp/{jobId}.mp3          # Final audio (deleted after ~1 hour)
```

**When to reconsider**: If you need persistent storage, multiple downloads, or very large files

---

# Part 6: Navigation Cheat Sheet

"I want to change X. Where do I go?"

| I want to... | Go to file | Look for |
|--------------|------------|----------|
| Change upload size limit | `app/api/upload/route.ts` | Line 10-12, `MAX_FILE_SIZE` |
| Add a new TTS provider | `lib/tts/providers/` | Copy `deepinfra.ts` as template |
| Change the default voice | `lib/tts/providers/deepinfra.ts` | Line 27, `defaultVoice` |
| Modify text cleaning rules | `lib/text-cleaner.ts` | `cleanDeepSeekOutput()` function |
| Change table narration prompt | `lib/claude.ts` | Line 22-43, the prompt string |
| Adjust streaming chunk size | `lib/streaming/chunk-manager.ts` | Line 190, `chunkText()` default |
| Change TTS speed | `lib/tts.ts` | Line 111, `speed = 1.05` |
| Add a keyboard shortcut | `components/StreamingPlayer.tsx` | Line 210-226, keyboard handler |
| Change the player UI | `components/StreamingPlayer.tsx` | Line 233-498, JSX |
| Modify cost calculations | `lib/cost.ts` | Cost functions |
| Add image narration | `lib/images.ts` | `narrateImages()` function |
| Change SSE keepalive interval | `lib/streaming/sse-helpers.ts` | `KEEPALIVE_INTERVAL` |
| Modify which providers are used | `lib/tts.ts` | Line 24-81, `buildTTSConfig()` |
| Add A/B testing | `lib/tts/manager.ts` | Line 200-203, `enableABTesting()` |

---

## Environment Variables Quick Reference

| Variable | Purpose | Default |
|----------|---------|---------|
| `DEEPINFRA_API_KEY` | Primary TTS, OCR, and LLM | Required |
| `OPENAI_API_KEY` | Fallback TTS | Optional |
| `FAL_KEY` | Fal.ai artwork generation | Optional |
| `TOGETHER_API_KEY` | Orpheus TTS | Optional |
| `MINIMAX_API_KEY` | MiniMax TTS | Optional |
| `TTS_PROVIDER` | Force specific provider | `auto` |
| `DEEPINFRA_VOICE` | Default voice | `af_bella` |
| `MAX_UPLOAD_MB` | Production file limit | `10` |
| `MAX_UPLOAD_MB_DEV` | Dev file limit | `250` |

---

# Part 7: Hands-On Exercises

Learn by doing. Each exercise includes exact file locations and verification steps.

---

## Tracing Exercises (Understand the Flow)

### Exercise 1: Trace a PDF's Journey

**Goal**: Follow a PDF through the system with console logs

**Steps**:

1. Open `app/api/process-stream/[id]/route.ts`

2. Add logging at key points:
```typescript
// After line 110 (extraction)
console.log('=== EXERCISE: Extraction complete ===');
console.log('Raw text length:', rawText.length);
console.log('Page count:', pageCount);

// After line 177 (cleaning)
console.log('=== EXERCISE: Cleaning complete ===');
console.log('Clean text length:', cleanText.length);
console.log('Reduction:', Math.round((1 - cleanText.length/rawText.length) * 100) + '%');

// After line 227 (each chunk)
console.log(`=== EXERCISE: Chunk ${i} generated ===`);
```

3. Run the dev server: `npm run dev`

4. Upload a small PDF

5. Check the terminal output - you'll see the journey!

**What to look for**:
- How much does cleaning reduce the text?
- How many chunks are created?
- Which TTS provider is used?

---

### Exercise 2: Watch the Fallback Chain

**Goal**: See what happens when a provider fails

**Steps**:

1. Open `lib/tts/providers/deepinfra.ts`

2. Temporarily break it:
```typescript
// Around line 58, change:
const response = await fetch('https://api.deepinfra.com/v1/inference/hexgrad/Kokoro-82M', {

// To:
const response = await fetch('https://api.deepinfra.com/BROKEN-URL', {
```

3. Upload a PDF and watch the terminal

4. You should see:
```
TTS provider deepinfra failed: ...
[Using fallback provider...]
```

5. **Revert the change!**

---

### Exercise 3: Inspect SSE Events

**Goal**: See the events flowing in real-time

**Steps**:

1. Open your browser's DevTools (F12)
2. Go to the Network tab
3. Upload a PDF
4. Find the `process-stream` request
5. Click on it and look at the EventStream tab

**What you'll see**:
```
data: {"type":"extraction_start","timestamp":1234567890}

data: {"type":"extraction_complete","charCount":15000,"totalChunks":5}

data: {"type":"chunk_ready","index":0,"audioData":"//uQxAAAAAANI..."}
```

---

### Exercise 4: Debug Chunk Boundaries

**Goal**: See how text gets split

**Steps**:

1. Open `lib/streaming/chunk-manager.ts`

2. Add logging to `chunkText()`:
```typescript
// Around line 221, before chunks.push:
console.log(`=== CHUNK ${chunks.length} ===`);
console.log('Length:', remaining.slice(0, breakPoint).length);
console.log('Ends with:', remaining.slice(breakPoint - 50, breakPoint));
```

3. Process a PDF and observe how chunks are split

---

## Code Modification Exercises (Make Real Changes)

### Exercise 5: Change the Default Voice

**Goal**: Switch DeepInfra from `af_bella` to `am_eric` (male voice)

**Location**: `lib/tts/providers/deepinfra.ts:27`

**Current code**:
```typescript
this.defaultVoice = config.voice || 'af_bella';
```

**Change to**:
```typescript
this.defaultVoice = config.voice || 'am_eric';
```

**Verify**: Process a PDF - the voice should sound different!

**Revert**: Change it back to `af_bella`

---

### Exercise 6: Tweak the Narration Prompt

**Goal**: Make table narrations more concise

**Location**: `lib/claude.ts:22-43`

**Current instruction** (line 33-37):
```typescript
1. Describe what the table shows in 2-4 sentences
2. Highlight the most important insights or comparisons
```

**Change to**:
```typescript
1. Describe what the table shows in 1-2 sentences ONLY
2. Focus on the single most important number or trend
```

**Verify**: Process a PDF with tables, check if narrations are shorter

---

### Exercise 7: Add Provider Name to UI

**Goal**: Show which TTS provider is being used in the player

**Location**: `components/StreamingPlayer.tsx`

**Steps**:

1. Add state for provider (around line 48):
```typescript
const [providerName, setProviderName] = useState<string | null>(null);
```

2. In `handleEvent`, extract provider from complete event:
```typescript
case 'complete':
  setStatus('complete');
  setDownloadUrl(event.downloadUrl);
  // Add this:
  if (event.stats?.provider) {
    setProviderName(event.stats.provider);
  }
  break;
```

3. Display it in the UI (around line 283):
```typescript
<p style={{ fontSize: '0.75rem', color: 'var(--faint)' }}>
  {pageCount && `${pageCount} pages · `}
  {providerName && `via ${providerName} · `}
  {status === 'complete' && 'Ready'}
</p>
```

---

### Exercise 8: Adjust Chunk Size

**Goal**: Experiment with different chunk sizes

**Location**: `lib/tts/providers/deepinfra.ts:13`

**Current**:
```typescript
maxCharsPerChunk = 8000;
```

**Try**:
```typescript
maxCharsPerChunk = 4000;  // Smaller chunks = more but faster
```

**Observe**:
- More chunks generated
- Possibly faster first-audio time
- Slightly higher cost (more API calls)

**Revert** after observing

---

## Verification Checklist

After each exercise, verify:

- [ ] The change took effect
- [ ] No errors in terminal or browser console
- [ ] The app still works end-to-end
- [ ] You reverted the change (unless it's an improvement you want to keep)

---

# Appendix: Quick Command Reference

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run type checking
npx tsc --noEmit

# Check what's in /tmp (server files)
ls -la /tmp/*.pdf /tmp/*.mp3 2>/dev/null

# Watch logs in real-time
# (Just use the terminal where npm run dev is running)
```

---

# What's Next

You've now covered:
- How to read TypeScript/React/Next.js patterns in this codebase
- The mental model and data flow
- The TTS system in depth
- Where every module lives and what it does
- Why we made the architectural choices we did

**To solidify your understanding**: Pick one exercise from Part 7 and do it today. Actually seeing the logs or hearing the voice change makes everything click.

**When you're ready to make real changes**: Use the Navigation Cheat Sheet (Part 6) to find where to go, then read that specific file before modifying it.

**When something breaks**: Check the terminal logs first - the codebase is heavily logged. The error usually tells you exactly where to look.
