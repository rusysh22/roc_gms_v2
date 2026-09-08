import type { IconType } from 'react-icons'
import {
  GiBasketballBall,
  GiBowArrow,
  GiBullseye,
  GiChessKing,
  GiConsoleController,
  GiPingPongBat,
  GiRunningShoe,
  GiShuttlecock,
  GiSoccerBall,
  GiSoccerField,
  GiSoccerKick,
  GiSwimfins,
  GiTable,
  GiTennisCourt,
  GiTennisRacket,
  GiTrophyCup,
  GiVolleyballBall,
} from 'react-icons/gi'

// Keyed by a lowercase keyword to look for in the sport's name - checked in this order, so a more
// specific phrase (e.g. "table tennis") is tried before a shorter one it contains ("tennis"). Used
// by both the public sports-browse page and the event home page's sport tiles so every listing of
// a sport shows the same icon.
//
// A sport with no name match falls back to its `sport_type` bucket (a coarse court/field/table/...
// grouping - see Sports.ts), then to a generic trophy, rather than erroring - a custom sport an
// event admin adds still gets *a* reasonable icon. An admin can also force one of these icons
// directly (independent of the sport's name) by typing its keyword into the sport's own `icon`
// field ("icon key or URL" - currently free text, not yet validated against this list).
const NAME_KEYWORD_ICONS: Array<[string, IconType]> = [
  ['table tennis', GiPingPongBat],
  ['ping pong', GiPingPongBat],
  ['badminton', GiShuttlecock],
  ['basketball', GiBasketballBall],
  ['volleyball', GiVolleyballBall],
  ['futsal', GiSoccerKick],
  ['football', GiSoccerBall],
  ['soccer', GiSoccerBall],
  ['padel', GiTennisRacket],
  ['tennis', GiTennisRacket],
  ['chess', GiChessKing],
  ['swim', GiSwimfins],
  ['athletics', GiRunningShoe],
  ['running', GiRunningShoe],
  ['sprint', GiRunningShoe],
  ['archery', GiBowArrow],
  ['petanque', GiBullseye],
  ['boules', GiBullseye],
  ['bocce', GiBullseye],
  ['esports', GiConsoleController],
  ['e-sports', GiConsoleController],
]

const SPORT_TYPE_ICONS: Record<string, IconType> = {
  court: GiTennisCourt,
  field: GiSoccerField,
  table: GiTable,
  board: GiChessKing,
  esport: GiConsoleController,
  track: GiRunningShoe,
  other: GiTrophyCup,
}

export const getSportIcon = (sport: {
  name?: string | null
  sport_type?: string | null
  icon?: string | null
}): IconType => {
  const iconKey = sport.icon?.trim().toLowerCase().replace(/[\s-]+/g, '')
  if (iconKey) {
    const byKey = NAME_KEYWORD_ICONS.find(([keyword]) => keyword.replace(/[\s-]+/g, '') === iconKey)
    if (byKey) return byKey[1]
  }

  const name = (sport.name || '').toLowerCase()
  const byName = NAME_KEYWORD_ICONS.find(([keyword]) => name.includes(keyword))
  if (byName) return byName[1]

  return SPORT_TYPE_ICONS[sport.sport_type || 'other'] || GiTrophyCup
}
