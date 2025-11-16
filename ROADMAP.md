# PDF Voice Tool - Roadmap for Next Session

## Feature Backlog (Prioritized)

Based on 2025-11-16 session discussion. All features designed to align with Rauno Freiberg's minimal aesthetic.

---

## 🎯 P0: Pause/Resume Functionality

### Problem
Currently no way to pause and resume from exact position. If user refreshes page or navigates away, playback position is lost.

### Solution: Bookmark System

**Implementation**:
1. **State Tracking**
   ```typescript
   interface PlaybackBookmark {
     jobId: string;
     fileName: string;
     chunkIndex: number;
     timeWithinChunk: number; // seconds
     timestamp: number; // when saved
   }
   ```

2. **Persistence** (localStorage for MVP)
   - Save position every 10 seconds while playing
   - Key: `pdf-voice-bookmark-${jobId}`
   - On mount, check for existing bookmark

3. **Resume UI**
   - On page load with bookmark: Show banner "Resume from 3:24?"
   - Minimal design: Small card above player with "Resume" button
   - If chunks expired (>1 hour), show "Previous session expired, re-process PDF?"

**Technical Approach**:
```typescript
// In StreamingPlayer.tsx
useEffect(() => {
  if (!isPlaying) return;

  const saveInterval = setInterval(() => {
    if (audioRef.current) {
      localStorage.setItem(`bookmark-${documentId}`, JSON.stringify({
        jobId: documentId,
        fileName,
        chunkIndex: currentChunkIndex,
        timeWithinChunk: audioRef.current.currentTime,
        timestamp: Date.now()
      }));
    }
  }, 10000); // Save every 10s

  return () => clearInterval(saveInterval);
}, [isPlaying, currentChunkIndex]);
```

**Edge Cases**:
- Chunks deleted (>1 hour): Clear bookmark, show "Session expired"
- Bookmark from different PDF: Ignore
- Bookmark mid-chunk that's not ready yet: Wait for chunk or skip to next ready chunk

**Time Estimate**: 2-3 hours
**Complexity**: Medium
**Dependencies**: None

---

## 🎛️ P1: Modern Playback Controls

### Problem
No speed control or rewind functionality. Users can't adjust playback or go back to rehear something.

### Solution: Minimal Control Set

**Features**:
1. **Speed Control** - Segmented options (not slider)
2. **Skip Back** - 30-second rewind button

**Design** (Rauno-aligned):
```
[⏪ 30s] [▶ Play] [1.0x ▼]
```

**Speed Options**:
- 0.75x (slower, detailed study)
- 1.0x (normal)
- 1.25x (slightly faster)
- 1.5x (faster)
- 2.0x (very fast)

**UI Implementation**:
```typescript
// Minimal speed selector
<button
  onClick={() => cycleSpeed()}
  className="text-sm font-medium px-3 py-2 border border-[var(--border)] rounded-lg"
>
  {speed}x
</button>

// Skip back button
<button
  onClick={() => skipBack(30)}
  className="px-3 py-2 border border-[var(--border)] rounded-lg"
>
  <SkipBack className="w-5 h-5" />
  <span className="text-xs">30s</span>
</button>
```

**Technical Details**:
- Use `audioRef.current.playbackRate = speed`
- Use `audioRef.current.currentTime -= 30` for skip back
- Handle chunk boundaries (if skip back goes to previous chunk)
- Persist speed preference to localStorage

**Design Principles**:
- No fine-grained controls (no 1.1x, 1.2x, etc.)
- Icon + text labels for clarity
- Consistent with Rauno's minimal button style
- Fast interaction, no animations

**Time Estimate**: 1-2 hours
**Complexity**: Low
**Dependencies**: None

---

## 📝 P2: Periodic Summaries ("What We Just Read")

### Problem
Long documents lack periodic recaps. Hard to retain information over 20-30 minute narrations.

### Solution: Streaming Summary Chunks

**Behavior**:
- Every ~5 minutes of audio (roughly 1,000-1,250 words of text)
- Generate 1-paragraph summary of content just covered
- Stream as special chunk type
- Visual indicator: Different styling for summary chunks
- User toggle: "Include summaries" (default: on)

**Implementation**:

1. **Summary Trigger Logic**
   ```typescript
   // In process-stream route
   let wordsNarratedSinceLastSummary = 0;
   const SUMMARY_THRESHOLD = 1200; // words

   for (let i = 0; i < textChunks.length; i++) {
     const wordCount = textChunks[i].split(/\s+/).length;
     wordsNarratedSinceLastSummary += wordCount;

     // Generate audio for chunk...

     if (wordsNarratedSinceLastSummary >= SUMMARY_THRESHOLD) {
       // Generate summary
       const recentText = getCombinedText(lastSummaryIndex, i);
       const summary = await generateSummary(recentText);
       const summaryAudio = await generateAudio(summary, `${id}-summary-${summaryCount}`);

       // Send as special chunk
       const summaryEvent: StreamEvent = {
         type: 'summary_ready',
         index: i + 0.5, // Between chunks
         summary: summary,
         audioUrl: summaryAudioUrl,
         duration: estimateDuration(summary)
       };

       wordsNarratedSinceLastSummary = 0;
       summaryCount++;
     }
   }
   ```

2. **Summary Generation** (Claude)
   ```typescript
   async function generateSummary(text: string): Promise<string> {
     const response = await anthropic.messages.create({
       model: 'claude-haiku-4-5',
       max_tokens: 150,
       messages: [{
         role: 'user',
         content: `In exactly one clear paragraph (3-4 sentences), summarize the key points from this section:\n\n${text}\n\nFocus on main concepts and takeaways.`
       }]
     });

     return response.content[0].text;
   }
   ```

3. **UI Handling**
   ```typescript
   // In StreamingPlayer
   interface AudioChunk {
     index: number;
     audioUrl: string;
     duration: number;
     status: 'pending' | 'ready' | 'played';
     type: 'content' | 'summary'; // NEW
     summary?: string; // Summary text for display
   }

   // Different styling for summary chunks
   {chunk.type === 'summary' && (
     <div className="p-3 border-l-2 border-[var(--accent)] bg-[var(--surface)] text-sm text-muted">
       <span className="font-medium">Summary:</span> {chunk.summary}
     </div>
   )}
   ```

4. **Toggle Control**
   ```typescript
   const [includeSummaries, setIncludeSummaries] = useState(true);

   // In header
   <label className="flex items-center gap-2 text-sm">
     <input
       type="checkbox"
       checked={includeSummaries}
       onChange={(e) => setIncludeSummaries(e.target.checked)}
     />
     <span>Include summaries</span>
   </label>

   // During playback, skip summary chunks if toggled off
   if (!includeSummaries && nextChunk.type === 'summary') {
     // Skip to next content chunk
   }
   ```

**Cost Analysis**:
- Summary generation: ~100 tokens output per summary
- Haiku pricing: $0.25 per 1M input, $1.25 per 1M output
- Cost per summary: ~$0.0001-0.0002 (negligible)
- 10-page PDF might have 2-3 summaries: $0.0006 total

**Benefits**:
- Improved retention and comprehension
- Natural break points in long narrations
- Reinforces key concepts
- Minimal cost (<$0.001 per document)

**Time Estimate**: 4-6 hours
**Complexity**: Medium-High
**Dependencies**: None (but benefits from pause/resume)

---

## 📚 P3: Reading History & Learning Log

### Problem
No persistence of what's been read. Can't build up knowledge over time or recall previous PDFs.

### Solution: Reading History System

**MVP Scope**:
- Save metadata for each processed PDF
- Claude-generated summary (2-3 paragraphs)
- Extracted key topics
- Searchable history page
- Export capability

**Data Model**:
```typescript
interface ReadingHistoryEntry {
  id: string; // jobId
  fileName: string;
  dateRead: number; // timestamp
  pageCount: number;
  charCount: number;
  tableCount: number;
  audioDuration: number; // seconds
  cost: number;

  // Generated content
  summary: string; // 2-3 paragraph overview
  keyTopics: string[]; // Extracted topics
  keyInsights: string[]; // Main takeaways

  // Metadata
  processingTime: number; // seconds
  provider: string; // 'inworld' | 'openai'
}
```

**Implementation**:

1. **Summary Generation** (after processing complete)
   ```typescript
   async function generateDocumentSummary(cleanText: string): Promise<{
     summary: string;
     topics: string[];
     insights: string[];
   }> {
     const response = await anthropic.messages.create({
       model: 'claude-haiku-4-5',
       max_tokens: 400,
       messages: [{
         role: 'user',
         content: `Analyze this document and provide:

   1. A 2-3 paragraph summary covering the main content and purpose
   2. 5-7 key topics (comma-separated)
   3. 3-5 key insights or takeaways (one per line)

   Document:
   ${cleanText.slice(0, 8000)} // First ~8K chars for context

   Format:
   SUMMARY:
   [your summary]

   TOPICS:
   [topic1, topic2, topic3...]

   INSIGHTS:
   - [insight 1]
   - [insight 2]
   ...`
       }]
     });

     // Parse structured response
     return parseAnalysis(response.content[0].text);
   }
   ```

2. **Storage** (localStorage for MVP)
   ```typescript
   // Save after processing complete
   const historyEntry: ReadingHistoryEntry = {
     id: jobId,
     fileName,
     dateRead: Date.now(),
     pageCount,
     charCount: cleanText.length,
     tableCount: tables.length,
     audioDuration: totalDuration,
     cost: totalCost,
     summary: analysis.summary,
     keyTopics: analysis.topics,
     keyInsights: analysis.insights,
     processingTime: processingTimeSeconds,
     provider: 'inworld' // or detected provider
   };

   // Append to history array
   const history = JSON.parse(localStorage.getItem('reading-history') || '[]');
   history.unshift(historyEntry); // Most recent first
   localStorage.setItem('reading-history', JSON.stringify(history));
   ```

3. **History Page** (`/history`)
   ```typescript
   // Simple list view
   export default function HistoryPage() {
     const [history, setHistory] = useState<ReadingHistoryEntry[]>([]);
     const [search, setSearch] = useState('');

     useEffect(() => {
       const data = JSON.parse(localStorage.getItem('reading-history') || '[]');
       setHistory(data);
     }, []);

     const filtered = history.filter(entry =>
       entry.fileName.toLowerCase().includes(search.toLowerCase()) ||
       entry.keyTopics.some(t => t.toLowerCase().includes(search.toLowerCase()))
     );

     return (
       <div className="container max-w-4xl py-8">
         <h1 className="mb-6">Reading History</h1>

         <input
           type="text"
           placeholder="Search by filename or topic..."
           value={search}
           onChange={(e) => setSearch(e.target.value)}
           className="w-full mb-6"
         />

         <div className="space-y-4">
           {filtered.map(entry => (
             <HistoryCard key={entry.id} entry={entry} />
           ))}
         </div>
       </div>
     );
   }
   ```

4. **History Card** (Minimal design)
   ```typescript
   function HistoryCard({ entry }: { entry: ReadingHistoryEntry }) {
     return (
       <div className="card">
         <div className="flex justify-between items-start mb-3">
           <div>
             <h3 className="font-medium">{entry.fileName}</h3>
             <p className="text-sm text-muted">
               {new Date(entry.dateRead).toLocaleDateString()}
             </p>
           </div>
           <div className="text-right text-sm text-muted">
             <div>{Math.floor(entry.audioDuration / 60)} min</div>
             <div>{entry.pageCount} pages</div>
           </div>
         </div>

         <p className="text-sm mb-3">{entry.summary}</p>

         <div className="flex flex-wrap gap-2">
           {entry.keyTopics.map(topic => (
             <span
               key={topic}
               className="text-xs px-2 py-1 bg-[var(--surface)] border border-[var(--border)] rounded"
             >
               {topic}
             </span>
           ))}
         </div>
       </div>
     );
   }
   ```

5. **Export Functionality**
   ```typescript
   function exportHistory() {
     const history = JSON.parse(localStorage.getItem('reading-history') || '[]');
     const blob = new Blob([JSON.stringify(history, null, 2)], {
       type: 'application/json'
     });
     const url = URL.createObjectURL(blob);
     const a = document.createElement('a');
     a.href = url;
     a.download = `reading-history-${Date.now()}.json`;
     a.click();
   }
   ```

**Cost Analysis**:
- Summary per document: ~300 tokens output
- Haiku: $0.25 input + $1.25 output per 1M tokens
- Cost per summary: ~$0.0004
- Even 100 documents: $0.04 total

**Future Enhancements**:
- Backend storage (Postgres/Supabase)
- Multi-device sync
- Search by insights/topics
- "Read again" to reprocess with same settings
- Analytics dashboard (total pages read, time spent, topics covered)

**Time Estimate**: 6-8 hours
**Complexity**: Medium-High
**Dependencies**: None (standalone feature)

---

## 🎨 Design Principles for All Features

Following Rauno Freiberg's aesthetic:

1. **Minimal Controls**
   - No sliders (use discrete options)
   - Icon + label for clarity
   - Consistent spacing (8px grid)
   - Borders over backgrounds

2. **Typography**
   - System fonts only
   - Clear hierarchy
   - 150ms transitions only

3. **Colors**
   - Monochromatic palette
   - Use accent color sparingly
   - Summary chunks: subtle left border

4. **Interactions**
   - Instant feedback
   - No decorative animations
   - Clear states (enabled/disabled)

---

## 📊 Implementation Priority & Timeline

**Session 1 (Next)**: P0 + P1
- Pause/Resume: 2-3 hours
- Playback Controls: 1-2 hours
- **Total**: 3-5 hours

**Session 2**: P2
- Periodic Summaries: 4-6 hours
- Testing & refinement: 1 hour
- **Total**: 5-7 hours

**Session 3**: P3
- Reading History: 6-8 hours
- Testing & polish: 1-2 hours
- **Total**: 7-10 hours

---

## 🔧 Technical Notes

**Storage Strategy**:
- MVP: localStorage (5-10MB limit, sufficient for 50-100 documents)
- Future: Backend (Supabase free tier supports 500MB)

**Cost Implications**:
- Summaries add ~$0.0004-0.0006 per document
- Negligible compared to TTS costs (~$0.02-0.10)
- Total cost increase: <1%

**Performance Considerations**:
- Summary generation: 1-2 seconds (doesn't block playback)
- History page: Fast with localStorage (even with 100 entries)
- Export: Instant (<1MB JSON files)

**Testing Checklist**:
- [ ] Pause/resume across page refreshes
- [ ] Resume with expired chunks (graceful failure)
- [ ] Speed changes during playback
- [ ] Skip back across chunk boundaries
- [ ] Summary generation quality
- [ ] Summary skipping functionality
- [ ] History search performance
- [ ] Export/import functionality

---

## 💡 Key Insights

**Why These Features Matter**:

1. **Pause/Resume**: Respects user's time - no one finishes a 30-min narration in one sitting
2. **Playback Controls**: Different use cases (study vs. quick scan) need different speeds
3. **Summaries**: Cognitive science - periodic recaps improve retention by 30-40%
4. **History**: Builds compound knowledge over time, transforms tool from one-off to knowledge system

**Alignment with Product Vision**:
- These features transform PDF Voice from "converter" to "learning companion"
- History system creates habit loop (return to see progress)
- Summaries increase value without increasing cost
- All maintain minimal, elegant aesthetic

---

**Document Version**: 1.0
**Created**: 2025-11-16
**Next Review**: Before starting P0 implementation
**Author**: Session planning based on user requirements