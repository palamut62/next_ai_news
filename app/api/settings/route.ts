import { type NextRequest, NextResponse } from "next/server"
import { checkAuth, requireAuth } from "@/lib/auth"
import { supabaseStorage } from "@/lib/supabase-storage"
import fs from "fs/promises"
import path from "path"

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'settings.json')

const DEFAULT_SETTINGS = {
  automation: {
    enabled: true,
    checkInterval: 2,
    maxArticlesPerCheck: 10,
    minAiScore: 7.0,
    autoPost: true,
    requireApproval: true,
    rateLimitDelay: 30,
  },
  github: {
    enabled: true,
    languages: ["JavaScript", "Python", "TypeScript"],
    timeRange: "weekly",
    maxRepos: 5,
    minStars: 100,
  },
  notifications: {
    telegram: { enabled: false, botToken: "", chatId: "" },
    email: {
      enabled: false,
      smtpHost: "smtp.gmail.com",
      smtpPort: 587,
      username: "",
      password: "",
      fromEmail: "",
      toEmail: "",
    },
  },
  twitter: {
    apiKey: "",
    apiSecret: "",
    accessToken: "",
    accessTokenSecret: "",
  },
  ai: {
    provider: "gemini",
    apiKey: "",
    model: "gemini-2.0-flash",
    temperature: 0.7,
    maxTokens: 280,
  },
}

function mergeDeep(target: any, source: any) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {}
      mergeDeep(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
  return target
}

async function readSettingsFile() {
  try {
    const dataDir = path.join(process.cwd(), 'data')
    const settingsFile = path.join(dataDir, 'settings.json')
    const raw = await fs.readFile(settingsFile, 'utf-8')
    return JSON.parse(raw)
  } catch (e) {
    return null
  }
}

async function writeSettingsFile(settings: any) {
  const dataDir = path.join(process.cwd(), 'data')
  const settingsFile = path.join(dataDir, 'settings.json')
  await fs.mkdir(dataDir, { recursive: true })
  await fs.writeFile(settingsFile, JSON.stringify(settings, null, 2))
}

// Updated readSettings to prevent resetting settings on app start
async function readSettings() {
  try {
    await fs.access(SETTINGS_FILE);
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    // Merge file settings with full DEFAULT_SETTINGS to ensure shape
    const merged = mergeDeep(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), parsed);
    return merged;
  } catch (err) {
    // If the file doesn't exist, create it with DEFAULT_SETTINGS
    await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2));
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }
}

export async function GET(request: NextRequest) {
  // Temporarily disable authentication for testing
  // if (!checkAuth(request)) return requireAuth()

  try {
    // Try to get settings from Supabase first
    const settings = await supabaseStorage.getSettings();

    if (settings) {
      console.log('✅ Settings loaded from Supabase');
      return NextResponse.json(settings);
    }

    // Fallback to file-based settings if Supabase fails
    console.log('⚠️ Falling back to file-based settings');
    const fallbackSettings = await readSettings();
    console.log('GET settings from file:', fallbackSettings, 'File path:', SETTINGS_FILE);
    return NextResponse.json(fallbackSettings);
  } catch (err) {
    console.error('Error reading settings:', err);
    return NextResponse.json({ error: 'Failed to read settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Temporarily disable authentication for testing
  // if (!checkAuth(request)) return requireAuth()

  try {
    const update = await request.json();
    console.log('Received update:', update);

    // Validate the update data
    if (!update || typeof update !== 'object') {
      return NextResponse.json({ error: 'Invalid settings data' }, { status: 400 });
    }

    // Try to save to Supabase first
    const supabaseSaved = await supabaseStorage.saveSettings(update);

    if (supabaseSaved) {
      console.log('✅ Settings saved to Supabase');
      return NextResponse.json(update);
    }

    // Fallback to file-based storage if Supabase fails
    console.log('⚠️ Falling back to file-based settings storage');
    const current = await readSettings();

    // Deep merge update into current settings so nested keys aren't wiped
    const merged = mergeDeep(JSON.parse(JSON.stringify(current)), update || {});

    // Ensure data types are correct
    if (merged.automation && typeof merged.automation.minAiScore === 'number') {
      merged.automation.minAiScore = Number(merged.automation.minAiScore.toFixed(1));
    }

    await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(merged, null, 2));
    console.log('Settings saved to file:', merged);

    return NextResponse.json(merged);
  } catch (err) {
    console.error('Error saving settings:', err);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
