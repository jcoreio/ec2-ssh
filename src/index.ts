#!/usr/bin/env node

'use strict'

if (process.env.AWS_SDK_LOAD_CONFIG == null)
  process.env.AWS_SDK_LOAD_CONFIG = '1'
import { EC2Client, DescribeImagesCommand } from '@aws-sdk/client-ec2'
import {
  SSMClient,
  DescribeInstanceInformationCommand,
} from '@aws-sdk/client-ssm'
import { selectEC2Instance } from '@jcoreio/aws-select-cli-prompts'
import { spawn } from 'child_process'
import os from 'os'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

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
export default async function ec2ssh({
  ec2 = new EC2Client(),
  ssm = new SSMClient(),
}: { ec2?: EC2Client; ssm?: SSMClient } = {}): Promise<void> {
  const instance = await selectEC2Instance({
    ec2,
    Filters: [
      {
        Name: 'instance-state-name',
        Values: ['pending', 'running'],
      },
    ],
  })

  const { InstanceId, ImageId, KeyName, PrivateDnsName, PublicDnsName } =
    instance
  let host = PrivateDnsName || PublicDnsName
  if (!host)
    throw new Error(`instance doesn't have a PrivateDnsName or PublicDnsName`)

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
    } catch (error) {
      // ignore
    }
  }

  args.push(host, ...process.argv.slice(2))

  // eslint-disable-next-line no-console
  console.log('ssh', ...args)
  const child = spawn('ssh', args, {
    stdio: 'inherit',
  })
  return await new Promise<void>((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code, signal) => {
      if (code === 0) {
        resolve()
      }
      throw Object.assign(
        new Error(
          code != null
            ? `process exited with code ${code}`
            : `process was killed with signal ${signal}`
        ),
        { code, signal }
      )
    })
  })
}
