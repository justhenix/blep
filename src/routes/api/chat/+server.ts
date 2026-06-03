import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { blepPhase1OutputSchema } from '$lib/blep/schema';
import { PHASE2_SYSTEM_PROMPT, buildPhase2Content } from '$lib/blep/prompt.phase2';
import { generatePhase2Chat } from '$lib/server/ai';
import { blepEnv } from '$lib/server/env';

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

	// Truncate massively long inputs to prevent persistent Zod failures
	if (body && typeof body === 'object') {
		const typedBody = body as Record<string, unknown>;
		if (Array.isArray(typedBody.messages)) {
			typedBody.messages = typedBody.messages.map((m: unknown) => {
				if (m && typeof m === 'object') {
					const msg = m as Record<string, unknown>;
					return {
						...msg,
						content: typeof msg.content === 'string' ? msg.content.slice(0, 1999) : msg.content
					};
				}
				return m;
			});
		}
		if (typeof typedBody.originalInput === 'string') {
			typedBody.originalInput = typedBody.originalInput.slice(0, 500);
		}
	}

	const parsed = chatRequestSchema.safeParse(body);

	if (!parsed.success) {
		// Before failing on length, check if it's a jailbreak attempt hiding in a huge string
		const rawQuestion =
			typeof (body as Record<string, unknown>)?.question === 'string'
				? ((body as Record<string, unknown>).question as string).toLowerCase()
				: '';
		if (
			rawQuestion.includes('ignore all') ||
			rawQuestion.includes('jailbreak') ||
			rawQuestion.includes('dan') ||
			rawQuestion.includes('system prompt') ||
			rawQuestion.includes('forget previous') ||
			rawQuestion.includes('discard any') ||
			rawQuestion.includes('write a python') ||
			rawQuestion.includes('developer mode')
		) {
			return json({
				ok: true,
				reply: "You think you're smart eh? Try again, I dare you.",
				needsNewScan: false
			} satisfies Phase2Response);
		}

		const paths = parsed.error.issues.map((i) => i.path.join('.') || 'body').slice(0, 5);
		const codes = parsed.error.issues.map((i) => i.code).slice(0, 5);
		console.warn(
			`[blep chat] bad_input paths=${JSON.stringify(paths)} codes=${JSON.stringify(codes)}`
		);

		// Generate friendly error
		let friendlyError = 'BLEP did not understand that input. Keep it simple and short.';
		if (codes.includes('too_big')) {
			friendlyError = 'That message is too long! BLEP only reads short questions (max 500 chars).';
		}

		return json({ ok: false, error: friendlyError } satisfies Phase2ErrorResponse, { status: 400 });
	}

	const { originalInput, phase1Result, messages, question } = parsed.data;

	console.info(
		`[blep chat] mode=${phase1Result.mode} question="${question.slice(0, 60)}" history=${messages.length}`
	);

	// Cap messages to last 10 (already enforced by schema, but belt-and-suspenders)
	const recentMessages = messages.slice(-10);

	// Build prompt content
	const userContent = buildPhase2Content(originalInput, phase1Result, recentMessages, question);

	// Mock bypass
	if (blepEnv.useMock) {
		console.info('[blep mock] returning mock chat response');
		// Artificial delay to make it feel real
		await new Promise((resolve) => setTimeout(resolve, 800));
		return json({
			ok: true,
			reply:
				"This is a mocked response from BLEP. The real API is turned off locally to save credits. But basically: the seller is lying, the specs are bad, and you shouldn't buy it.",
			needsNewScan: false
		} satisfies Phase2Response);
	}

	try {
		const rawText = await generatePhase2Chat(PHASE2_SYSTEM_PROMPT, userContent);
		const response = parsePhase2Response(rawText);

		return json(response);
	} catch (error) {
		const errorName =
			error && typeof error === 'object' && 'name' in error
				? String((error as { name: unknown }).name)
				: 'unknown';
		console.warn(`[blep chat] gemini_error name=${errorName}`);

		return json({ ok: false, error: 'chat_failed' } satisfies Phase2ErrorResponse, { status: 502 });
	}
};
