import { ChannelUser, ChannelUserAttribute, ChannelUserAttributes, GetOrCreateResult } from 'botpress-module-sdk'
import { inject, injectable } from 'inversify'

import Database from '../database'
import { TYPES } from '../misc/types'

export interface UserRepository {
  getOrCreate(channel: string, id: string): GetOrCreateResult<ChannelUser>
  updateAttributes(channel: string, id: string, attributes: ChannelUserAttribute[]): Promise<void>
}

function channelUserAttributes(arr: ChannelUserAttribute[] = []): ChannelUserAttributes {
  (arr as ChannelUserAttributes).get = (key: string): string | undefined => {
    const match = arr.find(x => x.key.toLowerCase() === key.toLowerCase())
    return (match && match.value) || undefined
  }

  return arr as ChannelUserAttributes
}

@injectable()
export class KnexUserRepository implements UserRepository {
  private readonly tableName = 'srv_channel_users'

  constructor(@inject(TYPES.Database) private database: Database) {}

  async getOrCreate(channel: string, id: string): GetOrCreateResult<ChannelUser> {
    channel = channel.toLowerCase()

    const ug = await this.database
      .knex(this.tableName)
      .where({
        channel,
        user_id: id
      })
      .limit(1)
      .select('attributes', 'created_at', 'updated_at')

    if (ug) {
      const user: ChannelUser = {
        channel: ug.channel,
        id: ug.user_id,
        createdOn: ug.created_at,
        updatedOn: ug.updated_at,
        attributes: channelUserAttributes(this.database.knex.json.get(ug.attributes)),
        otherChannels: []
      }

      return { result: user, created: false }
    }

    await this.database.knex(this.tableName).insert({
      channel,
      user_id: id,
      attributes: this.database.knex.json.set([])
    })

    const newUser: ChannelUser = {
      attributes: channelUserAttributes([]),
      channel: channel,
      id,
      createdOn: new Date(),
      updatedOn: new Date(),
      otherChannels: []
    }

    return { result: newUser, created: true }
  }

  async updateAttributes(channel: string, id: string, attributes: ChannelUserAttribute[]): Promise<void> {
    channel = channel.toLowerCase()

    if (!attributes || attributes.length === undefined) {
      throw new Error('Attributes must be an array of ChannelUserAttribute')
    }

    await this.database
      .knex(this.tableName)
      .update({
        attributes: this.database.knex.json.set(attributes)
      })
      .where({ channel, user_id: id })
  }
}
