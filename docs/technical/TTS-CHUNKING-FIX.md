# TTS Chunking Fix - Implementation Complete

## Problem Solved
The Inworld TTS provider was failing with the error: "text length should not exceed 2000 characters" because the system was using a hardcoded chunk size of 4000 characters (designed for OpenAI's limit).

## Solution Implemented: Provider-Aware Dynamic Chunking

### Changes Made

1. **Added `maxCharsPerChunk` to TTSProvider interface** (`lib/tts/types.ts`)
   - Each provider now declares its maximum character limit

2. **Updated Providers with their limits**:
   - **InworldProvider** (`lib/tts/providers/inworld.ts`):
     - Added `maxCharsPerChunk = 2000`
     - Added validation in `synthesize()` to reject oversized chunks
   - **OpenAIProvider** (`lib/tts/providers/openai.ts`):
     - Added `maxCharsPerChunk = 4000`

3. **Enhanced TTS Manager** (`lib/tts/manager.ts`)
   - Added `getMaxChunkSize()` method that:
     - Queries all available providers
     - Returns the minimum (most restrictive) limit
     - Defaults to 2000 if no providers available

4. **Updated Chunking Logic**:
   - **`lib/tts.ts`**:
     - `generateAudioWithManager()` now calls `manager.getMaxChunkSize()`
     - Uses dynamic chunk size instead of hardcoded 4000
   - **`app/api/process-stream/[id]/route.ts`**:
     - Initializes TTS Manager to get chunk size
     - Passes dynamic chunk size to `chunkText()`

## How It Works Now

1. When processing starts, the system:
   - Checks which TTS providers are available
   - Gets their character limits (Inworld: 2000, OpenAI: 4000)
   - Uses the most restrictive limit for chunking

2. Behavior by configuration:
   - **Inworld only**: Chunks at 2000 chars
   - **OpenAI only**: Chunks at 4000 chars
   - **Both configured**: Chunks at 2000 chars (most restrictive)

3. Defensive validation:
   - Inworld provider validates chunk size before API call
   - Throws clear error if chunk exceeds limit

## Testing the Fix

1. **Upload a PDF** with more than 2000 characters
2. **Verify in console**:
   - Should see: "Using chunk size of 2000 chars based on available providers"
   - Chunks should be created at ≤2000 characters
3. **Audio generation** should succeed without the "text length should not exceed 2000 characters" error

## Benefits

- **Automatic adaptation**: System adapts to available providers
- **No manual configuration**: Chunk size is determined dynamically
- **Future-proof**: New providers just declare their limit
- **Cost optimization**: OpenAI still uses larger chunks when used alone
- **Error prevention**: Validation catches oversized chunks before API calls

## Files Modified

- `lib/tts/types.ts` - Added maxCharsPerChunk to interface
- `lib/tts/providers/inworld.ts` - Added limit and validation
- `lib/tts/providers/openai.ts` - Added limit
- `lib/tts/manager.ts` - Added getMaxChunkSize method
- `lib/tts.ts` - Use dynamic chunk size
- `app/api/process-stream/[id]/route.ts` - Get and use dynamic chunk size

The fix is complete and ready for testing!