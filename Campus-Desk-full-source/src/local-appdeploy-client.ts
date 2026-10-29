type LocalAssistantResponse = {
  answer?: string;
  error?: string;
  message?: string;
};

export const api = {
  async post(
    url: string,
    body?: unknown
  ): Promise<{ data: LocalAssistantResponse }> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });

    const data = (await response.json().catch(() => ({
      error: 'The local server returned an invalid response.',
    }))) as LocalAssistantResponse;

    if (!response.ok) {
      throw new Error(
        data.error ||
          data.message ||
          'Local API request failed (' + response.status + ').'
      );
    }

    return { data };
  },
};
