import { defineEnv, LocalEnvSource } from 'envkit-core'

export default defineEnv({
  source: LocalEnvSource({ path: '.env' }),

  envGroups: [
    { slug: 'server',   name: 'Server',          description: 'HTTP server settings' },
    { slug: 'database', name: 'Database',         description: 'PostgreSQL connection' },
    { slug: 'redis',    name: 'Redis',            description: 'Cache and session store' },
    { slug: 'auth',     name: 'Authentication',   description: 'JWT and OAuth secrets' },
    { slug: 'email',    name: 'Email',            description: 'Transactional email (Resend)' },
    { slug: 'storage',  name: 'Object Storage',   description: 'S3-compatible file storage' },
    { slug: 'observability', name: 'Observability', description: 'Logging and error tracking' },
  ],

  envSchema: {
    // ── Server ────────────────────────────────────────────────────────────────
    NODE_ENV: {
      type: ['development', 'staging', 'production'] as const,
      default: 'development',
      description: 'Application runtime environment',
      group: 'server',
      required: true,
    },
    PORT: {
      type: 'number',
      default: 3000,
      description: 'HTTP server port',
      howToGet: 'Pick any free port on your machine',
      group: 'server',
      required: false,
      min: 1,
      max: 65535,
    },
    HOST: {
      type: 'string',
      default: '0.0.0.0',
      description: 'Network interface to bind to (use 127.0.0.1 to restrict to localhost)',
      group: 'server',
      required: false,
    },
    APP_URL: {
      type: 'url',
      description: 'Public-facing base URL of the application (no trailing slash)',
      howToGet: 'Use http://localhost:3000 for local dev, your domain for prod',
      group: 'server',
      required: true,
      example: 'https://myapp.com',
    },
    LOG_LEVEL: {
      type: ['error', 'warn', 'info', 'debug'] as const,
      default: 'info',
      description: 'Minimum log level to emit',
      group: 'server',
      required: false,
    },

    // ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: {
      type: 'url',
      description: 'PostgreSQL connection string',
      howToGet: 'Get from your DB provider dashboard, or run: docker compose up db',
      group: 'database',
      required: true,
      example: 'postgresql://user:pass@localhost:5432/myapp',
    },
    DATABASE_POOL_SIZE: {
      type: 'number',
      default: 10,
      description: 'Maximum number of database connections in the pool',
      group: 'database',
      required: false,
      min: 1,
      max: 100,
    },
    DATABASE_SSL: {
      type: 'boolean',
      default: false,
      description: 'Require SSL for database connections (always true in production)',
      group: 'database',
      required: false,
    },

    // ── Redis ─────────────────────────────────────────────────────────────────
    REDIS_URL: {
      type: 'url',
      description: 'Redis connection URL for caching and sessions',
      howToGet: 'Run: docker compose up redis  →  redis://localhost:6379',
      group: 'redis',
      required: true,
      example: 'redis://localhost:6379',
    },
    REDIS_TTL_SECONDS: {
      type: 'number',
      default: 3600,
      description: 'Default cache TTL in seconds',
      group: 'redis',
      required: false,
      min: 60,
    },

    // ── Authentication ────────────────────────────────────────────────────────
    JWT_SECRET: {
      type: 'string',
      description: 'Secret key for signing JWT access tokens',
      howToGet: 'Generate with: openssl rand -hex 64',
      group: 'auth',
      required: true,
      secret: true,
      minLength: 32,
    },
    JWT_EXPIRES_IN: {
      type: 'string',
      default: '15m',
      description: 'JWT access token lifetime (e.g. 15m, 1h, 7d)',
      group: 'auth',
      required: false,
    },
    REFRESH_TOKEN_SECRET: {
      type: 'string',
      description: 'Separate secret for signing refresh tokens',
      howToGet: 'Generate with: openssl rand -hex 64',
      group: 'auth',
      required: true,
      secret: true,
      minLength: 32,
    },
    REFRESH_TOKEN_EXPIRES_IN: {
      type: 'string',
      default: '30d',
      description: 'Refresh token lifetime',
      group: 'auth',
      required: false,
    },
    OAUTH_GOOGLE_CLIENT_ID: {
      type: 'string',
      description: 'Google OAuth 2.0 client ID',
      howToGet: 'Create credentials at console.cloud.google.com → APIs & Services → Credentials',
      group: 'auth',
      required: false,
      example: '123456789-abc.apps.googleusercontent.com',
    },
    OAUTH_GOOGLE_CLIENT_SECRET: {
      type: 'string',
      description: 'Google OAuth 2.0 client secret',
      howToGet: 'Found alongside the client ID in Google Cloud Console',
      group: 'auth',
      required: false,
      secret: true,
    },

    // ── Email ─────────────────────────────────────────────────────────────────
    RESEND_API_KEY: {
      type: 'string',
      description: 'Resend API key for sending transactional emails',
      howToGet: 'Get from resend.com → API Keys',
      group: 'email',
      required: true,
      secret: true,
    },
    EMAIL_FROM: {
      type: 'string',
      description: 'Default sender address for outgoing emails',
      group: 'email',
      required: true,
      example: 'MyApp <noreply@myapp.com>',
    },

    // ── Object Storage ────────────────────────────────────────────────────────
    S3_BUCKET: {
      type: 'string',
      description: 'S3 bucket name for file uploads',
      howToGet: 'Create a bucket in your AWS / R2 / MinIO console',
      group: 'storage',
      required: true,
      example: 'myapp-uploads',
    },
    S3_REGION: {
      type: 'string',
      default: 'us-east-1',
      description: 'AWS region for the S3 bucket',
      group: 'storage',
      required: false,
    },
    S3_ACCESS_KEY_ID: {
      type: 'string',
      description: 'AWS / R2 access key ID',
      howToGet: 'IAM → Users → Security credentials → Create access key',
      group: 'storage',
      required: true,
      secret: true,
    },
    S3_SECRET_ACCESS_KEY: {
      type: 'string',
      description: 'AWS / R2 secret access key',
      group: 'storage',
      required: true,
      secret: true,
    },

    // ── Observability ─────────────────────────────────────────────────────────
    SENTRY_DSN: {
      type: 'url',
      description: 'Sentry DSN for error tracking',
      howToGet: 'Get from sentry.io → Project Settings → Client Keys (DSN)',
      group: 'observability',
      required: false,
      example: 'https://abc123@o123456.ingest.sentry.io/123456',
    },
    SENTRY_ENVIRONMENT: {
      type: 'string',
      description: 'Environment tag sent to Sentry (defaults to NODE_ENV)',
      group: 'observability',
      required: false,
    },
  },

  computed: {
    IS_PRODUCTION: {
      description: 'True when running in production mode',
      compute: ({ env }) => env.NODE_ENV === 'production',
    },
    IS_DEVELOPMENT: {
      description: 'True when running in local development mode',
      compute: ({ env }) => env.NODE_ENV === 'development',
    },
    DATABASE_URL_SAFE: {
      description: 'DATABASE_URL with password redacted — safe to log',
      compute: ({ env }) =>
        env.DATABASE_URL
          ? String(env.DATABASE_URL).replace(/:([^:@]+)@/, ':***@')
          : undefined,
    },
    CORS_ORIGIN: {
      description: 'Allowed CORS origin derived from APP_URL',
      compute: ({ env }) => {
        try {
          const { origin } = new URL(String(env.APP_URL))
          return origin
        } catch {
          return '*'
        }
      },
    },
    OAUTH_ENABLED: {
      description: 'True when Google OAuth credentials are configured',
      compute: ({ env }) =>
        Boolean(env.OAUTH_GOOGLE_CLIENT_ID && env.OAUTH_GOOGLE_CLIENT_SECRET),
    },
  },
})
