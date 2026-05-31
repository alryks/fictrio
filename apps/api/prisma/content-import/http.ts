import { sleep } from './common';

type QueryValue = string | number | boolean | null | undefined;

export class HttpClient {
  private lastRequestAt = 0;

  constructor(
    private readonly baseUrl: string,
    private readonly delayMs: number,
    private readonly headers: Record<string, string> = {},
  ) {}

  async getJson<T>(
    path: string,
    query: Record<string, QueryValue> = {},
  ): Promise<T> {
    const elapsed = Date.now() - this.lastRequestAt;

    if (elapsed < this.delayMs) {
      await sleep(this.delayMs - elapsed);
    }

    const url = new URL(path, this.baseUrl);

    Object.entries(query).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });

    const response = await fetch(url, {
      headers: {
        accept: 'application/json',
        ...this.headers,
      },
    });

    this.lastRequestAt = Date.now();

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `GET ${url.toString()} failed with ${response.status}: ${body}`,
      );
    }

    return (await response.json()) as T;
  }
}
