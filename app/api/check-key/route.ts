import { NextResponse, type NextRequest } from "next/server";
import { ApiError, GoogleGenAI } from "@google/genai";
import { getCurrentUser } from "@/lib/supabase/server";

/** Checks that a user's own Gemini key works, without generating anything (free). */
export async function POST(request: NextRequest) {
  if (!(await getCurrentUser())) return NextResponse.json({ ok: false, error: "Please log in first." }, { status: 401 });

  const key = request.headers.get("x-gemini-key")?.trim();
  if (!key) return NextResponse.json({ ok: false, error: "Paste a key first." }, { status: 400 });

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    await ai.models.get({ model: process.env.GEMINI_MODEL || "gemini-3.5-flash" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    const error =
      status === 400 || status === 401 || status === 403
        ? "This key doesn't work. Copy it again from Google AI Studio."
        : "Couldn't reach Google right now. Try again in a minute.";
    return NextResponse.json({ ok: false, error }, { status: 200 });
  }
}
