import axios, { AxiosRequestConfig } from 'axios'
import { IProcessStreamContext } from '@/types'
import { GroupName } from '../types'

export const getGroupMember = async (
  memberInfoId: string,
  groupName: GroupName,
  cookie: string,
  ctx: IProcessStreamContext,
) => {
  const group = groupName.split('@')[0]
  const config: AxiosRequestConfig = {
    method: 'get',
    url: `https://groups.io/api/v1/getmember?member_info_id=${memberInfoId}&group_name=${group}`,
    headers: {
      Cookie: cookie,
    },
  }

  try {
    const response = await axios(config)
    return response.data
  } catch (err) {
    ctx.log.error(err, { memberInfoId }, 'Error fetching member by memberInfoId!')
    throw err
  }
}
