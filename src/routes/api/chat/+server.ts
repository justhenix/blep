import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { blepPhase1OutputSchema } from '$lib/blep/schema';
import { PHASE2_SYSTEM_PROMPT, buildPhase2Content } from '$lib/blep/prompt.phase2';
import { generatePhase2Chat } from '$lib/server/gemini';

// ── Request schema ──────────────────────────────────
const chatMessageSchema = z.object({
	role: z.enum(['user', 'assistant']),
	content: z.string().trim().min(1).max(2000)
});

const chatRequestSchema = z
	.object({
		originalInput: z.string().trim().max(500),
		phase1Result: blepPhase1OutputSchema,
		messages: z.array(chatMessageSchema).max(10),
		question: z.string().trim().min(1).max(500)
	})
	.strict();

// ── Response helpers ────────────────────────────────
type Phase2Response = {
	ok: true;
	reply: string;
	needsNewScan: boolean;
	reason?: string;
};

type Phase2ErrorResponse = {
	ok: false;
	error: string;
};

const stripJsonFence = (text: string) =>
	text
		.trim()
		.replace(/^```json\s*/i, '')
		.replace(/^```\s*/i, '')
		.replace(/\s*```$/i, '');

/**
 * Try to extract { reply, needsNewScan, reason? } from Gemini output.
 * Falls back to raw text as reply if JSON parsing fails.
 */
const parsePhase2Response = (rawText: string): Phase2Response => {
	const cleaned = stripJsonFence(rawText);

	try {
		const firstBrace = cleaned.indexOf('{');
		const lastBrace = cleaned.lastIndexOf('}');

		if (firstBrace >= 0 && lastBrace > firstBrace) {
			const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
			const parsed = JSON.parse(jsonStr);

			if (typeof parsed.reply === 'string') {
				return {
					ok: true,
					reply: parsed.reply.trim(),
					needsNewScan: Boolean(parsed.needsNewScan),
					...(parsed.reason ? { reason: String(parsed.reason) } : {})
				};
			}
		}
	} catch {
		// JSON parse failed — fall through to raw text fallback
	}

	// Fallback: use raw text as reply
	return {
		ok: true,
		reply: cleaned.slice(0, 800),
		needsNewScan: false
	};
};

// ── Handler ─────────────────────────────────────────
// IMPORTANT: This endpoint does NOT import firecrawl.ts
// IMPORTANT: This endpoint does NOT import quota.ts
// IMPORTANT: This endpoint does NOT decrement Brain Juice / scan quota

export const POST: RequestHandler = async ({ request }) => {
	let body: unknown;

	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'bad_json' } satisfies Phase2ErrorResponse, { status: 400 });
	}

	const parsed = chatRequestSchema.safeParse(body);

	if (!parsed.success) {
		const paths = parsed.error.issues
			.map((i) => i.path.join('.') || 'body')
			.slice(0, 5);
		console.warn(`[blep chat] bad_input paths=${JSON.stringify(paths)}`);

		return json({ ok: false, error: 'bad_input' } satisfies Phase2ErrorResponse, { status: 400 });
	}

	const { originalInput, phase1Result, messages, question } = parsed.data;

	console.info(
		`[blep chat] mode=${phase1Result.mode} question="${question.slice(0, 60)}" history=${messages.length}`
	);

	// Cap messages to last 10 (already enforced by schema, but belt-and-suspenders)
	const recentMessages = messages.slice(-10);

	// Build prompt content
	const userContent = buildPhase2Content(originalInput, phase1Result, recentMessages, question);

	try {
		const rawText = await generatePhase2Chat(PHASE2_SYSTEM_PROMPT, userContent);
		const response = parsePhase2Response(rawText);

		return json(response);
	} catch (error) {
		const errorName = error && typeof error === 'object' && 'name' in error
			? String((error as { name: unknown }).name)
			: 'unknown';
		console.warn(`[blep chat] gemini_error name=${errorName}`);

		return json(
			{ ok: false, error: 'chat_failed' } satisfies Phase2ErrorResponse,
			{ status: 502 }
		);
	}
};
