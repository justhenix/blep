import { env } from '$env/dynamic/private';
import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';

const cspDirectives = [
	"default-src 'self'",
	"base-uri 'self'",
	"object-src 'none'",
	dev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : "script-src 'self'",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob:",
	"font-src 'self' data:",
	"connect-src 'self' ws: wss:",
	"frame-src 'none'",
	"frame-ancestors 'none'",
	"form-action 'self'",
	"manifest-src 'self'",
	"worker-src 'self'"
];

const permissionsPolicy = [
	'accelerometer=()',
	'ambient-light-sensor=()',
	'autoplay=()',
	'browsing-topics=()',
	'camera=()',
	'display-capture=()',
	'encrypted-media=()',
	'fullscreen=()',
	'geolocation=()',
	'gyroscope=()',
	'magnetometer=()',
	'microphone=()',
	'midi=()',
	'payment=()',
	'picture-in-picture=()',
	'publickey-credentials-get=()',
	'usb=()',
	'web-share=()',
	'xr-spatial-tracking=()'
].join(', ');

export const handle: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);

	response.headers.set('Content-Security-Policy', cspDirectives.join('; '));
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('X-Frame-Options', 'DENY');
	response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
	response.headers.set('Permissions-Policy', permissionsPolicy);

	if (env.NODE_ENV === 'production') {
		response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
	}

	return response;
};
