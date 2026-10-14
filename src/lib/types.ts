export interface Chunk {
  id: string;
  section: string;
  url: string;
  text: string;
}

export interface SearchHit extends Chunk {
  score: number;
}

export interface VectorChunk extends Chunk {
  vector: number[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources?: SearchHit[];
  latencyMs?: number;
}
