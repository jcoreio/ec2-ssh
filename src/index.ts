import {
  EC2Client,
  DescribeImagesCommand,
  DescribeInstancesCommand,
  Instance,
} from '@aws-sdk/client-ec2'
import {
  SSMClient,
  DescribeInstanceInformationCommand,
} from '@aws-sdk/client-ssm'
import { selectEC2Instance } from '@jcoreio/aws-select-cli-prompts'
import os from 'os'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import type { Options, ResultPromise } from 'execa'

async function getAmiName(ec2: EC2Client, ImageId: string): Promise<string> {
  const { Images } = await ec2.send(
    new DescribeImagesCommand({
      ImageIds: [ImageId],
    })
  )
  const name = Images && Images[0] && Images[0].Name
  if (!name) throw new Error(`failed to get name for image: ${ImageId}`)
  return name
}
function getUser(ami: string) {
  if (/ubuntu|nanostack/i.test(ami)) return 'ubuntu'
  if (/debian/i.test(ami)) return 'admin'
  if (/fedora/i.test(ami)) return 'fedora'
  if (/centos/i.test(ami)) return 'centos'
  if (/bitnami/i.test(ami)) return 'bitnami'
  if (/turnkey|omni/i.test(ami)) return 'root'
  return 'ec2-user'
}
export async function ec2ssh<OptionsType extends Options>({
  ec2 = new EC2Client(),
  ssm = new SSMClient(),
  logCommand,
  Instance,
  InstanceId,
  args: additionalArgs,
  options,
}: {
  ec2?: EC2Client
  ssm?: SSMClient
  logCommand?: boolean
  Instance?: Instance
  InstanceId?: string
  args?: readonly string[]
  options?: OptionsType
} = {}): Promise<Awaited<ResultPromise<{} & OptionsType>>> {
  const { execa } = await import('execa')
  const chalk = new (await import('chalk')).Chalk()
  if (!Instance) {
    if (InstanceId != null) {
      Instance = (
        await ec2.send(
          new DescribeInstancesCommand({
            InstanceIds: [InstanceId],
          })
        )
      ).Reservations?.[0]?.Instances?.[0]
      if (!Instance) {
        throw new Error(`Instance not found: ${InstanceId}`)
      }
    } else {
      Instance = await selectEC2Instance({
        ec2,
        Filters: [
          {
            Name: 'instance-state-name',
            Values: ['pending', 'running'],
          },
        ],
      })
    }
  }

  if (InstanceId == null) {
    ;({ InstanceId } = Instance)
  }
  const { ImageId, KeyName, PrivateDnsName, PublicDnsName } = Instance
  let host = PrivateDnsName || PublicDnsName
  if (!host) {
    throw new Error(`instance doesn't have a PrivateDnsName or PublicDnsName`)
  }

  let user = ImageId ? getUser(await getAmiName(ec2, ImageId)) : null

  if (InstanceId) {
    const {
      InstanceInformationList: [
        { PlatformName } = { PlatformName: undefined },
      ] = [],
    } = await ssm.send(
      new DescribeInstanceInformationCommand({
        Filters: [
          {
            Key: 'InstanceIds',
            Values: [InstanceId],
          },
        ],
      })
    )
    if (PlatformName) {
      const userFromPlatform = getUser(PlatformName)
      if (userFromPlatform !== 'ec2-user') user = userFromPlatform
    }
  }

  if (user) host = `${user}@${host}`

  const args = ['-t']
  if (KeyName) {
    const identityFile = path.join(os.homedir(), '.ssh', `${KeyName}.pem`)
    try {
      await promisify(fs.stat)(identityFile)
      args.push('-i', identityFile)
    } catch {
      // ignore
    }
  }

  args.push(host, ...(additionalArgs || []))

  if (logCommand) {
    // eslint-disable-next-line no-console
    console.error(
      chalk.gray(
        '$ ssh',
        ...args.map((arg) =>
          /^[-_a-z0-9/.@:]+$/i.test(arg) ? arg : `'${arg.replace(/'/g, "\\'")}'`
        )
      )
    )
  }
  return await execa('ssh', args, options)
}
