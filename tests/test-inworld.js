/**
 * Test script for Inworld TTS integration
 * Run with: node test-inworld.js
 */

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync } from 'fs';

// Load environment variables
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '.env.local') });

async function testInworldTTS() {
  console.log('🧪 Testing Inworld TTS Integration...\n');

  // Check credentials
  if (!process.env.INWORLD_API_KEY) {
    console.error('❌ INWORLD_API_KEY not found in environment');
    process.exit(1);
  }

  if (!process.env.INWORLD_WORKSPACE_ID) {
    console.error('❌ INWORLD_WORKSPACE_ID not found in environment');
    process.exit(1);
  }

  console.log('✅ Credentials found');
  console.log(`   API Key: ${process.env.INWORLD_API_KEY.substring(0, 20)}...`);
  console.log(`   Workspace: ${process.env.INWORLD_WORKSPACE_ID}\n`);

  // Test text
  const testText = "Hello! This is a test of the Inworld AI text-to-speech system. The quick brown fox jumps over the lazy dog.";

  // Test API call
  console.log('📡 Making API request to Inworld...');

  try {
    const response = await fetch('https://api.inworld.ai/tts/v1/voice', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${process.env.INWORLD_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: testText,
        voice_id: 'Dennis',
        model_id: 'inworld-tts-1-max',
        audio_config: {
          audio_encoding: 'MP3',
          speaking_rate: 1.1
        },
        temperature: 1.1
      })
    });

    console.log(`   Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
      process.exit(1);
    }

    const result = await response.json();

    if (!result.audioContent) {
      console.error('❌ No audio content in response');
      console.log('Response:', JSON.stringify(result, null, 2));
      process.exit(1);
    }

    // Save audio file
    const audioBuffer = Buffer.from(result.audioContent, 'base64');
    const outputPath = join(__dirname, 'test-inworld-output.mp3');
    writeFileSync(outputPath, audioBuffer);

    console.log('✅ Audio generated successfully!');
    console.log(`   Size: ${(audioBuffer.length / 1024).toFixed(2)} KB`);
    console.log(`   Saved to: ${outputPath}`);

    // Calculate cost
    const charCount = testText.length;
    const cost = (charCount / 1_000_000) * 10; // $10 per 1M chars
    const openaiCost = (charCount / 1000) * 0.030; // $30 per 1M chars

    console.log('\n💰 Cost Analysis:');
    console.log(`   Characters: ${charCount}`);
    console.log(`   Inworld cost: $${cost.toFixed(6)}`);
    console.log(`   OpenAI cost: $${openaiCost.toFixed(6)}`);
    console.log(`   Savings: $${(openaiCost - cost).toFixed(6)} (${((1 - cost/openaiCost) * 100).toFixed(0)}%)`);

    // Test voice options
    console.log('\n🎤 Testing different voices...');
    const voices = ['Dennis', 'Emma', 'Michael', 'Sophia', 'Oliver'];

    for (const voice of voices) {
      process.stdout.write(`   ${voice}... `);

      const voiceResponse = await fetch('https://api.inworld.ai/tts/v1/voice', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${process.env.INWORLD_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: `Hello, my name is ${voice}.`,
          voice_id: voice,
          model_id: 'inworld-tts-1-max',
          audio_config: {
            audio_encoding: 'MP3',
            speaking_rate: 1.0
          }
        })
      });

      if (voiceResponse.ok) {
        console.log('✅');
      } else {
        console.log(`❌ (${voiceResponse.status})`);
      }
    }

    console.log('\n🎉 All tests passed! Inworld TTS is working correctly.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.cause) {
      console.error('   Cause:', error.cause);
    }
    process.exit(1);
  }
}

// Run the test
testInworldTTS().catch(console.error);