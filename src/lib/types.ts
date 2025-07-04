export interface AuthResult {
  method: 'env' | 'claude-cli' | 'config' | 'prompt';
  key: string | null;
}

export interface ExecOptions {
  throwOnError?: boolean;
  shell?: boolean;
  stdio?: 'inherit' | 'pipe';
  timeout?: number;
  input?: string;
  env?: Record<string, string>;
}