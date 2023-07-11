import axios, { AxiosRequestConfig } from 'axios'
import { Logger } from '@crowd/logging'
import { timeout } from '@crowd/common'
import { SlackGetMemberInput, SlackGetMemberOutput } from '../../types/slackTypes'
import { handleSlackError } from './errorHandler'

async function getMembers(
  input: SlackGetMemberInput,
  logger: Logger,
): Promise<SlackGetMemberOutput> {
  await timeout(2000)

  const config: AxiosRequestConfig<any> = {
    method: 'get',
    url: `https://slack.com/api/users.info`,
    params: {
      user: input.userId,
    },
    headers: {
      Authorization: `Bearer ${input.token}`,
    },
  }

  try {
    const response = await axios(config)

    if (response.data.ok === true) {
      const member = response.data.user
      return {
        records: member,
        nextPage: '',
      }
    }

    if (response.data.error === 'user_not_found' || response.data.error === 'user_not_visible') {
      return {
        records: undefined,
        nextPage: '',
      }
    }

    throw new Error(`Slack API error ${response.data.error}!`)
  } catch (err) {
    const newErr = handleSlackError(err, config, input, logger)
    throw newErr
  }
}

export default getMembers