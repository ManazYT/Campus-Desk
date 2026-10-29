import { router, json, error } from '@appdeploy/sdk';

export const handler = router({
  'POST /api/assistant': [async ({ body }) => {
    const input = body as { endpoint?: string; model?: string; apiKey?: string; prompt?: string; context?: Array<{ title: string; subject: string; due: string; done: boolean }>; history?: Array<{ role: string; content: string }> };
    const endpoint = String(input.endpoint || '').replace(/\/$/, '');
    const apiKey = String(input.apiKey || '');
    const model = String(input.model || '');
    const prompt = String(input.prompt || '');
    if (!apiKey || !model || !prompt) return error('Missing API key, model, or prompt.', 400);
    let parsed: URL;
    try { parsed = new URL(endpoint); } catch { return error('Invalid provider URL.', 400); }
    if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') return error('Provider URL must use HTTPS.', 400);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return error('Local provider endpoints are not reachable from the hosted backend.', 400);
    const tasks = Array.isArray(input.context) ? input.context.slice(0, 100) : [];
    const history = Array.isArray(input.history) ? input.history.slice(-8).filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').map(m => ({ role: m.role, content: m.content.slice(0, 3000) })) : [];
    const systemPrompt = 'You are Campus Desk, a practical study and planning assistant for a school student. Use the provided planner context only when relevant. Help prioritize tasks, explain study concepts, and make realistic plans. Never claim to know school announcements or official dates unless the user provides them. Be clear about uncertainty. Planner context (JSON): ' + JSON.stringify(tasks);
    try {
      const response = await fetch(endpoint + '/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, ...history] }),
      });
      const result = await response.json() as { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
      if (!response.ok) return error('Provider request failed (' + response.status + '): ' + String(result.error?.message || 'Check the key, model, endpoint and provider billing.' ).slice(0, 300), 502);
      const answer = result.choices?.[0]?.message?.content;
      if (typeof answer !== 'string') return error('The provider returned an unexpected response format.', 502);
      return json({ answer });
    } catch {
      return error('Could not connect to the configured AI provider. Check the endpoint and try again.', 502);
    }
  }],
});
