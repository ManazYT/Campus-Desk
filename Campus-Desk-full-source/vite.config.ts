import { Buffer } from 'node:buffer';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

type LocalTask = {
  title: string;
  subject: string;
  due: string;
  done: boolean;
};

type LocalChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type LocalAssistantInput = {
  endpoint?: string;
  model?: string;
  apiKey?: string;
  prompt?: string;
  context?: LocalTask[];
  history?: Array<{ role: string; content: string }>;
};

type ChatCompletionResult = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

function sendJson(
  response: ServerResponse,
  status: number,
  payload: unknown
): void {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}

async function handleLocalAssistantRequest(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  try {
    const chunks: Buffer[] = [];
    let size = 0;

    for await (const chunk of request) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.byteLength;

      if (size > 1_000_000) {
        sendJson(response, 413, { error: 'The request is too large.' });
        return;
      }
      chunks.push(buffer);
    }

    const input = JSON.parse(
      Buffer.concat(chunks).toString('utf8')
    ) as LocalAssistantInput;

    const endpoint = String(input.endpoint || '').replace(/\/$/, '');
    const apiKey = String(input.apiKey || '');
    const model = String(input.model || '');
    const prompt = String(input.prompt || '');

    if (!apiKey || !model || !prompt) {
      sendJson(response, 400, {
        error: 'Missing API key, model, or prompt. Check Settings.',
      });
      return;
    }

    let providerUrl: URL;
    try {
      providerUrl = new URL(endpoint);
    } catch {
      sendJson(response, 400, { error: 'Invalid provider URL.' });
      return;
    }

    const localHosts = ['localhost', '127.0.0.1', '::1', '[::1]'];
    const isLocalProvider = localHosts.includes(providerUrl.hostname);
    if (
      providerUrl.protocol !== 'https:' &&
      !(isLocalProvider && providerUrl.protocol === 'http:')
    ) {
      sendJson(response, 400, {
        error: 'Provider URL must use HTTPS, except for a local provider on this computer.',
      });
      return;
    }

    const tasks = Array.isArray(input.context)
      ? input.context.slice(0, 100)
      : [];
    const history: LocalChatMessage[] = Array.isArray(input.history)
      ? input.history
          .slice(-8)
          .filter(
            (message) =>
              (message.role === 'user' || message.role === 'assistant') &&
              typeof message.content === 'string'
          )
          .map((message) => ({
            role: message.role as LocalChatMessage['role'],
            content: message.content.slice(0, 3000),
          }))
      : [];

    const systemPrompt =
      'You are Campus Desk, a practical study and planning assistant for a school student. ' +
      'Use the provided planner context only when relevant. Help prioritize tasks, explain study concepts, ' +
      'and make realistic plans. Never claim to know school announcements or official dates unless the user ' +
      'provides them. Be clear about uncertainty. Planner context (JSON): ' +
      JSON.stringify(tasks);

    let providerResponse: Response;
    try {
      providerResponse = await fetch(endpoint + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKey,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: systemPrompt }, ...history],
        }),
      });
    } catch {
      sendJson(response, 502, {
        error: 'Could not connect to the configured AI provider. Check the endpoint and try again.',
      });
      return;
    }

    const result = (await providerResponse
      .json()
      .catch(() => ({}))) as ChatCompletionResult;

    if (!providerResponse.ok) {
      sendJson(response, 502, {
        error:
          'Provider request failed (' +
          providerResponse.status +
          '): ' +
          String(
            result.error?.message ||
              'Check the key, model, endpoint and provider billing.'
          ).slice(0, 300),
      });
      return;
    }

    const answer = result.choices?.[0]?.message?.content;
    if (typeof answer !== 'string') {
      sendJson(response, 502, {
        error: 'The provider returned an unexpected response format.',
      });
      return;
    }

    sendJson(response, 200, { answer });
  } catch {
    sendJson(response, 400, {
      error: 'Could not read the local assistant request.',
    });
  }
}

function localAssistantPlugin(): Plugin {
  return {
    name: 'campus-desk-local-assistant-api',
    configureServer(server) {
      server.middlewares.use('/api/assistant', (request, response, next) => {
        if (request.method !== 'POST') {
          next();
          return;
        }

        void handleLocalAssistantRequest(request, response);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const localMode = mode === 'local';
  const localClientPath = fileURLToPath(
    new URL('./src/local-appdeploy-client.ts', import.meta.url)
  );

  return {
    base: './',
    resolve: {
      alias: localMode
        ? [
            {
              find: '@appdeploy/client',
              replacement: localClientPath,
            },
          ]
        : [],
    },
    plugins: localMode ? [localAssistantPlugin()] : [],
    build: {
      outDir: process.env.APPDEPLOY_VITE_OUT_DIR || 'dist',
      sourcemap:
        process.env.APPDEPLOY_VITE_SOURCEMAP === 'hidden' ? 'hidden' : false,
      rollupOptions: {
        maxParallelFileOps: 128,
      },
    },
  };
});
