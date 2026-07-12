import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { AuditLogs } from './src/collections/AuditLogs'
import { Announcements } from './src/collections/Announcements'
import { Articles } from './src/collections/Articles'
import { Brackets } from './src/collections/Brackets'
import { Clubs } from './src/collections/Clubs'
import { Comments } from './src/collections/Comments'
import { CompetitionCategories } from './src/collections/CompetitionCategories'
import { CompetitionEntries } from './src/collections/CompetitionEntries'
import { Courts } from './src/collections/Courts'
import { DocumentationAssets } from './src/collections/DocumentationAssets'
import { Events } from './src/collections/Events'
import { Groups } from './src/collections/Groups'
import { Matches } from './src/collections/Matches'
import { MatchSets } from './src/collections/MatchSets'
import { Media } from './src/collections/Media'
import { Players } from './src/collections/Players'
import { Rosters } from './src/collections/Rosters'
import { Rulesets } from './src/collections/Rulesets'
import { SiteConfigs } from './src/collections/SiteConfigs'
import { Sports } from './src/collections/Sports'
import { Stages } from './src/collections/Stages'
import { Standings } from './src/collections/Standings'
import { Teams } from './src/collections/Teams'
import { Users } from './src/collections/Users'
import { Venues } from './src/collections/Venues'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

if (process.env.NODE_ENV === 'production' && !process.env.PAYLOAD_SECRET) {
  throw new Error('PAYLOAD_SECRET must be set in production.')
}

if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set in production.')
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname, 'src'),
    },
    autoLogin:
      process.env.NODE_ENV === 'development' && process.env.PAYLOAD_ADMIN_AUTOLOGIN === 'true'
        ? {
            email: process.env.SEED_ADMIN_EMAIL || 'admin@roc-gms.local',
            password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
            prefillOnly: true,
          }
        : false,
  },
  collections: [
    Users,
    SiteConfigs,
    Events,
    Rulesets,
    Sports,
    CompetitionCategories,
    Stages,
    Groups,
    Matches,
    MatchSets,
    Standings,
    Brackets,
    Media,
    Articles,
    Announcements,
    DocumentationAssets,
    Comments,
    AuditLogs,
    Clubs,
    Players,
    Teams,
    Rosters,
    CompetitionEntries,
    Venues,
    Courts,
  ],
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
  }),
  editor: lexicalEditor(),
  graphQL: {
    schemaOutputFile: path.resolve(dirname, 'src/generated/schema.graphql'),
  },
  secret: process.env.PAYLOAD_SECRET || '',
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'src/generated/payload-types.ts'),
  },
})
