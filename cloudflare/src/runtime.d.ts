interface DurableObjectId {
  toString(): string;
}

interface DurableObjectStorage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
}

interface DurableObjectState {
  readonly id: DurableObjectId;
  readonly storage: DurableObjectStorage;
  acceptWebSocket(socket: WebSocket): void;
  getWebSockets(): WebSocket[];
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
}

interface WebSocket {
  serializeAttachment(value: unknown): void;
  deserializeAttachment(): unknown;
}

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  };
}

declare const WebSocketPair: {
  new (): {
    0: WebSocket;
    1: WebSocket;
  };
};
