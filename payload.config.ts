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
import { EventMemberships } from './src/collections/EventMemberships'
import { Groups } from './src/collections/Groups'
import { Matches } from './src/collections/Matches'
import { MatchSets } from './src/collections/MatchSets'
import { MedalRecords } from './src/collections/MedalRecords'
import { Media } from './src/collections/Media'
import { Players } from './src/collections/Players'
import { RegistrationSubmissions } from './src/collections/RegistrationSubmissions'
import { Rosters } from './src/collections/Rosters'
import { Rulesets } from './src/collections/Rulesets'
import { SiteConfigs } from './src/collections/SiteConfigs'
import { Sponsors } from './src/collections/Sponsors'
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
    // AUDIT_UI_UX_CSS UI-13/section 11.13: Payload Admin still used the framework's own default
    // "Payload" title/branding, reading as a third, unrelated product next to the public site and
    // the custom workspace. This is meant to be an internal technical console, not an organizer
    // destination - the browser tab now says so explicitly rather than implying it's part of the
    // main app. A full custom login-screen notice/logo swap (Payload's
    // admin.components.graphics.Logo / beforeLogin) is a larger, separately-scoped follow-up.
    meta: {
      titleSuffix: ' - InTourney Internal',
    },
    importMap: {
      baseDir: path.resolve(dirname, 'src'),
    },
    autoLogin:
      process.env.NODE_ENV === 'development' && process.env.PAYLOAD_ADMIN_AUTOLOGIN === 'true'
        ? {
            email: process.env.SEED_ADMIN_EMAIL || 'admin@intourney.local',
            password: process.env.SEED_ADMIN_PASSWORD || 'ChangeMe123!',
            prefillOnly: true,
          }
        : false,
  },
  collections: [
    Users,
    SiteConfigs,
    Events,
    EventMemberships,
    Rulesets,
    Sports,
    CompetitionCategories,
    Stages,
    Groups,
    Matches,
    MatchSets,
    Standings,
    Brackets,
    MedalRecords,
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
    RegistrationSubmissions,
    Venues,
    Courts,
    Sponsors,
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
