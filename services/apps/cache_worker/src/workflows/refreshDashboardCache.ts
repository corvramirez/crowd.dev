import { proxyActivities } from '@temporalio/workflow'
import * as activities from '../activities/dashboard-cache/refreshDashboardCache'

import { IProcessRefreshDashboardCacheArgs } from '@crowd/types'
import { DashboardTimeframe } from '../enums'
import {
  IActiveMembersTimeseriesResult,
  IActiveOrganizationsTimeseriesResult,
  IActivityBySentimentMoodResult,
  IActivityByTypeAndPlatformResult,
  IActivityTimeseriesResult,
  IDashboardData,
  INewMembersTimeseriesResult,
  INewOrganizationsTimeseriesResult,
  ITimeframe,
} from 'types'
import moment from 'moment'

const activity = proxyActivities<typeof activities>({ startToCloseTimeout: '5 minute' })

export async function refreshDashboardCache(
  args: IProcessRefreshDashboardCacheArgs,
): Promise<void> {
  console.log(args)

  // if no segments were sent, set current segment as default one
  if (!args.segmentId) {
    const defaultSegment = await activity.getDefaultSegment(args.tenantId)
    args.segmentId = defaultSegment.segmentId
    args.leafSegmentIds = [defaultSegment.segmentId]
  }

  const dashboardLastRefreshedAt = await activity.getDashboardCacheLastRefreshedAt(args.segmentId)

  const activePlatforms = await activity.getActivePlatforms(args.leafSegmentIds)

  if (!dashboardLastRefreshedAt) {
    // main view with no platform filter
    await refreshDashboardCacheForAllTimeranges(args.tenantId, args.segmentId, args.leafSegmentIds)

    // for each platform also cache dashboard values
    for (const platform of activePlatforms) {
      await refreshDashboardCacheForAllTimeranges(
        args.tenantId,
        args.segmentId,
        args.leafSegmentIds,
        platform,
      )
    }
  } else {
    // first check if there's a new activity between dashboardLastRefreshedAt and now()
    const platforms = await activity.findNewActivityPlatforms(
      dashboardLastRefreshedAt,
      args.leafSegmentIds,
    )

    // only refresh the main view and returned platform views if there are new activities
    if (platforms && platforms.length > 0) {
      // refresh the main view
      await refreshDashboardCacheForAllTimeranges(
        args.tenantId,
        args.segmentId,
        args.leafSegmentIds,
      )

      for (const platform of platforms) {
        await refreshDashboardCacheForAllTimeranges(
          args.tenantId,
          args.segmentId,
          args.leafSegmentIds,
          platform,
        )
      }
    } else {
      console.log('No new activities found.. not calculating cache again!')
    }
  }

  // update dashboardLastRefreshedAt
  await activity.updateMemberMergeSuggestionsLastGeneratedAt(args.segmentId)
  console.log(
    `Done generating dashboard cache for tenant ${args.tenantId}, segment: ${args.segmentId}`,
  )
}

async function refreshDashboardCacheForAllTimeranges(
  tenantId: string,
  segmentId: string,
  leafSegmentIds: string[],
  platform?: string,
) {
  const info = platform ?? 'all'
  console.log(`Refreshing cache for ${info}!`)
  for (const timeframe in DashboardTimeframe) {
    const data = await getDashboardCacheData(
      tenantId,
      leafSegmentIds,
      DashboardTimeframe[timeframe],
      platform,
    )

    // try saving it to cache
    await activity.saveToCache(tenantId, segmentId, DashboardTimeframe[timeframe], data, platform)
  }
}

async function getDashboardCacheData(
  tenantId: string,
  segmentIds: string[],
  timeframe: DashboardTimeframe,
  platform?: string,
): Promise<IDashboardData> {
  // build dateranges
  const { startDate, endDate, previousPeriodStartDate, previousPeriodEndDate } =
    buildTimeframe(timeframe)

  // new members total
  const newMembersTotal = await activity.getNewMembers<number>({
    tenantId,
    segmentIds,
    startDate,
    endDate,
    platform,
  })

  // new members previous period total
  const newMembersPreviousPeriodTotal = await activity.getNewMembers<number>({
    tenantId,
    segmentIds,
    startDate: previousPeriodStartDate,
    endDate: previousPeriodEndDate,
    platform,
  })

  // new members timeseries
  const newMembersTimeseries = await activity.getNewMembers<INewMembersTimeseriesResult[]>({
    tenantId,
    segmentIds,
    startDate: previousPeriodStartDate,
    endDate: previousPeriodEndDate,
    granularity: 'day',
    platform,
    rawResult: true,
  })

  // active members total
  const activeMembersTotal = await activity.getActiveMembers<number>({
    tenantId,
    segmentIds,
    startDate,
    endDate,
    platform,
  })

  // active members previous period total
  const activeMembersPreviousPeriodTotal = await activity.getActiveMembers<number>({
    tenantId,
    segmentIds,
    startDate: previousPeriodStartDate,
    endDate: previousPeriodEndDate,
    platform,
  })

  // active members timeseries
  const activeMembersTimeseries = await activity.getActiveMembers<IActiveMembersTimeseriesResult[]>(
    {
      tenantId,
      segmentIds,
      startDate: previousPeriodStartDate,
      endDate: previousPeriodEndDate,
      granularity: 'day',
      platform,
      rawResult: true,
    },
  )

  // new organizations total
  const newOrganizationsTotal = await activity.getNewOrganizations<number>({
    tenantId,
    segmentIds,
    startDate,
    endDate,
    platform,
  })

  // new organizations previous period total
  const newOrganizationsPreviousPeriodTotal = await activity.getNewOrganizations<number>({
    tenantId,
    segmentIds,
    startDate: previousPeriodStartDate,
    endDate: previousPeriodEndDate,
    platform,
  })

  // new organizations timeseries
  const newOrganizationsTimeseries = await activity.getNewOrganizations<
    INewOrganizationsTimeseriesResult[]
  >({
    tenantId,
    segmentIds,
    startDate: previousPeriodStartDate,
    endDate: previousPeriodEndDate,
    granularity: 'day',
    platform,
    rawResult: true,
  })

  // active organizations total
  const activeOrganizationsTotal = await activity.getActiveOrganizations<number>({
    tenantId,
    segmentIds,
    startDate,
    endDate,
    platform,
  })

  // active organizations previous period total
  const activeOrganizationsPreviousPeriodTotal = await activity.getActiveOrganizations<number>({
    tenantId,
    segmentIds,
    startDate: previousPeriodStartDate,
    endDate: previousPeriodEndDate,
    platform,
  })

  // active organizations timeseries
  const activeOrganizationsTimeseries = await activity.getActiveOrganizations<
    IActiveOrganizationsTimeseriesResult[]
  >({
    tenantId,
    segmentIds,
    startDate: previousPeriodStartDate,
    endDate: previousPeriodEndDate,
    granularity: 'day',
    platform,
    rawResult: true,
  })

  // activities total
  const activitiesTotal = await activity.getActivities<number>({
    tenantId,
    segmentIds,
    startDate,
    endDate,
    platform,
  })

  // activities previous period total
  const activitiesPreviousPeriodTotal = await activity.getActivities<number>({
    tenantId,
    segmentIds,
    startDate: previousPeriodStartDate,
    endDate: previousPeriodEndDate,
    platform,
  })

  // activities timeseries
  const activitiesTimeseries = await activity.getActivities<IActivityTimeseriesResult[]>({
    tenantId,
    segmentIds,
    startDate: previousPeriodStartDate,
    endDate: previousPeriodEndDate,
    granularity: 'day',
    platform,
    rawResult: true,
  })

  // activities by sentiment mood
  const activitiesBySentimentMood = await activity.getActivities<IActivityBySentimentMoodResult[]>({
    tenantId,
    segmentIds,
    startDate,
    endDate,
    dimensions: ['Activities.sentimentMood'],
    platform,
    rawResult: true,
  })

  // activities by type and platform
  const activitiesByTypeAndPlatform = await activity.getActivities<
    IActivityByTypeAndPlatformResult[]
  >({
    tenantId,
    segmentIds,
    startDate,
    endDate,
    dimensions: ['Activities.type', 'Activities.platform'],
    platform,
    rawResult: true,
  })

  return {
    newMembers: {
      total: newMembersTotal,
      previousPeriodTotal: newMembersPreviousPeriodTotal,
      timeseries: newMembersTimeseries,
    },
    activeMembers: {
      total: activeMembersTotal,
      previousPeriodTotal: activeMembersPreviousPeriodTotal,
      timeseries: activeMembersTimeseries,
    },
    newOrganizations: {
      total: newOrganizationsTotal,
      previousPeriodTotal: newOrganizationsPreviousPeriodTotal,
      timeseries: newOrganizationsTimeseries,
    },
    activeOrganizations: {
      total: activeOrganizationsTotal,
      previousPeriodTotal: activeOrganizationsPreviousPeriodTotal,
      timeseries: activeOrganizationsTimeseries,
    },
    activity: {
      total: activitiesTotal,
      previousPeriodTotal: activitiesPreviousPeriodTotal,
      timeseries: activitiesTimeseries,
      bySentimentMood: activitiesBySentimentMood,
      byTypeAndPlatform: activitiesByTypeAndPlatform,
    },
  }
}

function buildTimeframe(timeframe: DashboardTimeframe): ITimeframe {
  if (timeframe === DashboardTimeframe.LAST_7_DAYS) {
    const startDate = moment().subtract(6, 'days').startOf('day').toISOString()
    const endDate = moment().endOf('day').toISOString()
    const previousPeriodStartDate = moment().subtract(13, 'days').startOf('day').toISOString()
    const previousPeriodEndDate = moment().subtract(7, 'days').endOf('day').toISOString()

    return {
      startDate,
      endDate,
      previousPeriodStartDate,
      previousPeriodEndDate,
    }
  }

  if (timeframe === DashboardTimeframe.LAST_14_DAYS) {
    const startDate = moment().subtract(13, 'days').startOf('day').toISOString()
    const endDate = moment().endOf('day').toISOString()
    const previousPeriodStartDate = moment().subtract(27, 'days').startOf('day').toISOString()
    const previousPeriodEndDate = moment().subtract(14, 'days').endOf('day').toISOString()

    return {
      startDate,
      endDate,
      previousPeriodStartDate,
      previousPeriodEndDate,
    }
  }

  if (timeframe === DashboardTimeframe.LAST_30_DAYS) {
    const startDate = moment().subtract(29, 'days').startOf('day').toISOString()
    const endDate = moment().endOf('day').toISOString()
    const previousPeriodStartDate = moment().subtract(59, 'days').startOf('day').toISOString()
    const previousPeriodEndDate = moment().subtract(30, 'days').endOf('day').toISOString()

    return {
      startDate,
      endDate,
      previousPeriodStartDate,
      previousPeriodEndDate,
    }
  }

  throw new Error(`Unsupported timerange ${timeframe}!`)
}
