/** File contents for the simulated disk; a key ending in '/' with value null is a directory. */
export type FileValue = string | Uint8Array | { data: string | Uint8Array; mtime?: number; mode?: number } | null;
export type Files = Record<string, FileValue>;

export interface RunOptions {
  /** argv after argv[0], e.g. ['-q', '/var/www/index.php'] (php-cgi flags: -q -s -l -v -i -m -d k=v). */
  args?: string[];
  /** The process environment (replaces the default one). */
  env?: Record<string, string>;
  /** Fed to stdin (the POST body in CGI mode). */
  stdin?: string | Uint8Array;
  /** Absolute paths written into a fresh filesystem before the run. /etc/php.ini is read if present. */
  files?: Files;
  /** Working directory. */
  cwd?: string;
  /** Set false to leave the MySQL server out of this run. */
  mysqld?: boolean;
  /** Abort once stdout reaches this many bytes (default 64 MiB). */
  maxOutput?: number;
  /** Set false to skip reading the filesystem back into result.files. */
  collectFiles?: boolean;
  /** Include the JS stack in crash.detail. */
  debug?: boolean;
}

export interface RunResult {
  stdout: Uint8Array;
  stderr: Uint8Array;
  /** null when the run was aborted. */
  exitCode: number | null;
  /** Why the run was cut short (output limit, internal error), else null. */
  aborted: string | null;
  /** Set when the native binary would have died on a signal (e.g. runaway recursion). */
  crash: { signal: 'SIGSEGV'; number: 11; detail: string } | null;
  /**
   * The persistent directories (/var/www, /tmp, /etc, /home, /var/mail,
   * /var/lib/mysql) after the run; pass back as `files` to keep state.
   */
  files: Record<string, { data: Uint8Array; mtime: number } | null>;
  elapsedMs: number;
}

export interface CGIResponse {
  status: number;
  reason: string;
  headers: [string, string][];
  body: Uint8Array;
}

export interface RequestOptions extends Omit<RunOptions, 'env' | 'stdin'> {
  /** Default 'GET'. */
  method?: string;
  /** Path and query on the server, e.g. '/index.php?id=3'. Maps to /var/www. */
  url: string;
  /** Request headers, turned into HTTP_* (and CONTENT_TYPE/CONTENT_LENGTH). */
  headers?: Record<string, string>;
  body?: string | Uint8Array;
  /** Script to run instead of /var/www + the URL path. */
  scriptFilename?: string;
  /** Extra or overriding CGI variables. */
  env?: Record<string, string>;
}

export declare class SimPHP {
  static create(opts: {
    createPHP: (moduleArgs: object) => Promise<any>;
    wasmBinary?: BufferSource;
    wasmModule?: WebAssembly.Module;
    SQL?: any;
    MysqlServer?: any;
  }): Promise<SimPHP>;
  /** Split CGI output into status, headers and body like a web server does. */
  static parseCGI(bytes: Uint8Array): CGIResponse;
  static REASONS: Record<number, string>;

  /** 'php' or 'php-jspi' (set by createSimPHP). */
  build?: 'php' | 'php-jspi';
  /** The emulated MySQL server, when enabled. */
  mysqld: any;
  /** Run the php CGI binary once, in a fresh process. */
  run(opts?: RunOptions): Promise<RunResult>;
  /** Serve one HTTP request through PHP as a CGI (Apache 1.3 environment). A crash is a 500. */
  request(req: RequestOptions): Promise<CGIResponse & { result: RunResult }>;
}

export interface CreateOptions {
  /** Use the JS Promise Integration build (deeper recursion). Default 'auto'. */
  jspi?: boolean | 'auto';
  /** true for the emulated MySQL 3.23 server on the bundled sql.js, or your own initialised sql.js. */
  mysql?: boolean | object;
  /** Web Worker only: URL of the package's dist/ directory. */
  baseUrl?: string;
}

/** Compile the engine once; the instance runs any number of scripts. */
export declare function createSimPHP(opts?: CreateOptions): Promise<SimPHP>;

/** The CGI/1.1 environment Apache 1.3 gives PHP for a request. */
export declare function cgiEnv(req: Omit<RequestOptions, 'args' | 'files' | 'cwd' | 'mysqld' | 'maxOutput' | 'collectFiles' | 'debug'>): Record<string, string>;

declare const _default: { createSimPHP: typeof createSimPHP; cgiEnv: typeof cgiEnv; SimPHP: typeof SimPHP };
export default _default;
