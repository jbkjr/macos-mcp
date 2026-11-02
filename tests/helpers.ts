import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createServer } from '../src/server.js';

/** A real MCP client wired to the real server over an in-memory transport. */
export async function connect() {
  const server = createServer();
  const client = new Client({ name: 'test', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  return { client, close: async () => { await client.close(); await server.close(); } };
}

export function text(result: unknown): string {
  return (result as { content: { text: string }[] }).content[0].text;
}
