import { defineEnv } from 'envkit-core'

export default defineEnv({
  source: { type: 'combined', path: '.env' },
  envGroups: [
    { slug: 'server',   name: 'Server Configuration', description: 'Core server settings' },
    { slug: 'database', name: 'Database',              description: 'Database connection settings' },
    { slug: 'auth',     name: 'Authentication',        description: 'Auth secrets and settings' },
  ],
  envSchema: {
    NODE_ENV: {
      type: ['development', 'staging', 'production'],
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
      description: 'Server bind address',
      group: 'server',
      required: false,
    },
    DATABASE_URL: {
      type: 'string',
      description: 'PostgreSQL connection string',
      howToGet: 'Get from your database provider or use: postgresql://user:pass@localhost:5432/mydb',
      group: 'database',
      required: true,
      example: 'postgresql://user:pass@localhost:5432/mydb',
    },
    JWT_SECRET: {
      type: 'string',
      description: 'Secret key for signing JWT tokens',
      howToGet: 'Generate with: openssl rand -hex 64',
      group: 'auth',
      required: true,
      secret: true,
      minLength: 32,
    },
    ENABLE_FEATURE_X: {
      type: 'boolean',
      default: false,
      description: 'Feature flag for experimental feature X',
      group: 'server',
      required: false,
    },
  },
  computed: {
    APP_URL: {
      description: 'Full application URL derived from HOST and PORT',
      compute: ({ env }) => `${env.HOST}:${env.PORT}`,
    },
    IS_PRODUCTION: {
      description: 'True when running in production mode',
      compute: ({ env }) => env.NODE_ENV === 'production',
    },
  },
})
