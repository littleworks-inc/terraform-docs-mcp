// Use ES module import
import * as streamPolyfill from 'web-streams-polyfill';
import fetch from 'node-fetch';

// Add to global scope
(globalThis as any).ReadableStream = streamPolyfill.ReadableStream;
(globalThis as any).WritableStream = streamPolyfill.WritableStream;
(globalThis as any).TransformStream = streamPolyfill.TransformStream;
(globalThis as any).fetch = fetch;

export {};